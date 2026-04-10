const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  BOT_API_KEY
} = process.env;

const authorizedUsers = new Map();

function buildDiscordAuthUrl() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: 'identify guilds',
    prompt: 'consent'
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
  if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
    return res.status(500).send('OAuth non configure.');
  }

  return res.redirect(buildDiscordAuthUrl());
});

app.get('/discord/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Code OAuth manquant.');
    }

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return res.status(500).send(`Echec token OAuth: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok || !guildsResponse.ok) {
      return res.status(500).send('Impossible de recuperer les informations Discord.');
    }

    const user = await userResponse.json();
    const guilds = await guildsResponse.json();

    authorizedUsers.set(user.id, {
      userId: user.id,
      username: user.username,
      globalName: user.global_name || null,
      guildIds: guilds.map(g => g.id),
      syncedAt: Date.now()
    });

    return res.send(
      `Autorisation terminee pour ${user.username}. Tu peux retourner sur Discord.`
    );
  } catch (error) {
    console.error('[discord callback error]', error);
    return res.status(500).send('Erreur interne pendant l autorisation Discord.');
  }
});

app.get('/verif/:userId', (req, res) => {
  const apiKey = req.headers['x-bot-api-key'];
  if (!BOT_API_KEY || apiKey !== BOT_API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const userId = req.params.userId;
  const data = authorizedUsers.get(userId);

  if (!data) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Utilisateur non autorise ou non synchronise.'
    });
  }

  return res.json(data);
});

app.listen(PORT, () => {
  console.log(`OAuth server listening on port ${PORT}`);
});
