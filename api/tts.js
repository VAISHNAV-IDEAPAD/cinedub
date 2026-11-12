const https = require('https');
const axios = require('axios');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function getGoogleHindiTTS(text) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent((text || '').slice(0, 200))}`;
  const response = await axios({
    method: 'GET',
    url,
    httpsAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    responseType: 'arraybuffer',
    timeout: 8000
  });
  return Buffer.from(response.data);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const text = req.query.text || req.body?.text || 'नमस्ते, यह एक परीक्षण है।';
    const format = req.query.format || req.body?.format || 'audio';

    const audioBuffer = await getGoogleHindiTTS(text);

    if (format === 'json') {
      const base64Audio = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
      return res.status(200).json({ success: true, audio: base64Audio });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(audioBuffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
