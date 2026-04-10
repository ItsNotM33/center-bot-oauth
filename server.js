import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// CONFIG
const CLIENT_ID = "1474946784043208846";
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "https://center-bot-oauth.onrender.com/callback";

// PAGE ACCUEIL
app.get("/", (req, res) => {
  res.send(`
    <h1>Login Discord</h1>
    <a href="/login">Se connecter</a>
  `);
});

// LOGIN
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify guilds`;

  res.redirect(url);
});

// CALLBACK
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.send("Pas de code");

  try {
    // TOKEN
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
console.log("TOKEN DATA:", tokenData);

    if (!tokenData.access_token) {
      return res.send("Erreur OAuth");
    }

    // USER
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const user = await userRes.json();

    // GUILDS
    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const guilds = await guildsRes.json();

    res.send(`
      <h1>✅ Connecté</h1>
      <p>Utilisateur: ${user.username}</p>
      <p>Serveurs: ${guilds.length}</p>
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