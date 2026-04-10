import express from "express";
import fetch from "node-fetch";

const app = express();

// 🔑 CONFIG
const CLIENT_ID = "1474946784043208846";
const CLIENT_SECRET = "MkwQ7Pk6spj6hCZ3n2rB46DwI56h4x9i";
const REDIRECT_URI = "https://center-bot-oauth.onrender.com/discord/callback";

// page d'accueil
app.get("/", (req, res) => {
  res.send(`
    <h1>Connexion Discord</h1>
    <a href="/login">Se connecter avec Discord</a>
  `);
});

// redirection vers Discord
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify guilds`;

  res.redirect(url);
});

// callback OAuth
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.send("Erreur: pas de code");

  try {
    // échange code → token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenRes.json();

    // récup user
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const user = await userRes.json();

    // récup serveurs
    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const guilds = await guildsRes.json();

    // réponse simple (PAS DE REDIRECTION EN BOUCLE)
    res.send(`
      <h1>Connecté ✅</h1>
      <p>Bienvenue ${user.username}</p>
      <p>Tu es dans ${guilds.length} serveurs</p>
      <a href="https://discord.gg/TON_INVITE">Rejoindre le serveur</a>
    `);

  } catch (err) {
    console.error(err);
    res.send("Erreur serveur");
  }
});

app.listen(3000, () => {
  console.log("Serveur lancé");
});
