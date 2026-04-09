const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'center-bot-oauth'
  });
});

app.get('/', (req, res) => {
  res.send('center-bot-oauth online');
});

app.listen(PORT, () => {
  console.log(`OAuth server listening on port ${PORT}`);
});
