const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const BOT_API_KEY = process.env.BOT_API_KEY;

const DATA_FILE = path.join(__dirname, 'authorized_users.json');

function readStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { users: {} };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return { users: {} };
    return JSON.parse(raw);
  } catch {
    return { users: {} };
  }
}

function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function ensureStore() {
  if (!fs.existsSync(DATA_FILE)) {
    writeStore({ users: {} });
  }
}

function buildDiscordAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'identify guilds',
    prompt: 'consent',
    state: crypto.randomBytes(16).toString('hex')
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'center-bot-oauth'
  });
});

app.get('/', (req, res) => {
  res.send('center-bot-oauth online');
});

app.get('/discord/login', (req, res) => {
  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).send('OAuth not configured.');
  }

  return res.redirect(buildDiscordAuthUrl());
});

app.get('/discord/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Missing OAuth code.');
    }

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      return res.status(500).send(`Token exchange failed: ${text}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const meResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!meResponse.ok) {
      const text = await meResponse.text();
      return res.status(500).send(`Failed to fetch user: ${text}`);
    }

    const me = await meResponse.json();

    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!guildsResponse.ok) {
      const text = await guildsResponse.text();
      return res.status(500).send(`Failed to fetch guilds: ${text}`);
    }

    const guilds = await guildsResponse.json();

    const store = readStore();
    store.users[me.id] = {
      guildIds: guilds.map(g => g.id),
      username: me.username,
      globalName: me.global_name || null,
      syncedAt: Date.now()
    };
    writeStore(store);

    return res.send(
      `Compte Discord autorise avec succes.<br>` +
      `Utilisateur : ${me.username} (${me.id})<br>` +
      `Serveurs detectes : ${guilds.length}<br><br>` +
      `Vous pouvez maintenant revenir sur Discord.`
    );
  } catch (error) {
    console.error('[oauth callback error]', error);
    return res.status(500).send('OAuth callback error.');
  }
});

app.get('/api/user-guilds/:userId', (req, res) => {
  const providedKey = req.headers['x-api-key'];

  if (!BOT_API_KEY || providedKey !== BOT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const store = readStore();
  const entry = store.users[req.params.userId];

  if (!entry) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    userId: req.params.userId,
    guildIds: Array.isArray(entry.guildIds) ? entry.guildIds : [],
    syncedAt: entry.syncedAt || null,
    username: entry.username || null,
    globalName: entry.globalName || null
  });
});

ensureStore();

app.listen(PORT, () => {
  console.log(`OAuth server listening on port ${PORT}`);
});
