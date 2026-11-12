const https = require('https');
const axios = require('axios');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function translateFree(text) {
  if (!text) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url, { httpsAgent, timeout: 8000 });
    if (res.data && res.data[0]) {
      return res.data[0].map(item => item[0]).join('').trim();
    }
  } catch (err) {
    console.warn('Translate error:', err.message);
  }
  return text;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { text, segments } = req.body || {};

    if (text) {
      const translated = await translateFree(text);
      return res.status(200).json({ success: true, original: text, hindi: translated });
    }

    if (segments && Array.isArray(segments)) {
      const results = [];
      for (const seg of segments) {
        const hindi = await translateFree(seg.text || seg.original || '');
        results.push({
          ...seg,
          hindi,
          gender: seg.gender || (seg.id % 2 === 0 ? 'female' : 'male')
        });
      }
      return res.status(200).json({ success: true, segments: results });
    }

    return res.status(400).json({ error: 'Please provide text or segments array' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
