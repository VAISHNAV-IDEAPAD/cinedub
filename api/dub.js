const https = require('https');
const axios = require('axios');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function translateFree(text) {
  if (!text) return '';

  // Tier 1: Google Translate GTX endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url, { httpsAgent, timeout: 6000 });
    if (res.data && res.data[0]) {
      return res.data[0].map(item => item[0]).join('').trim();
    }
  } catch (err) {
    console.warn('Google translate error:', err.message);
  }

  // Tier 2: MyMemory API (high availability fallback across Indian networks)
  try {
    const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hi`;
    const res2 = await axios.get(mmUrl, { httpsAgent, timeout: 6000 });
    if (res2.data?.responseData?.translatedText) {
      return res2.data.responseData.translatedText.trim();
    }
  } catch (err2) {
    console.warn('MyMemory translate error:', err2.message);
  }

  return text;
}

async function getGoogleHindiTTS(text) {
  if (!text) return null;
  const cleanText = text.slice(0, 180);

  // Tier 1: Google Translate tw-ob client
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
    const response = await axios({
      method: 'GET',
      url,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
      },
      responseType: 'arraybuffer',
      timeout: 6000
    });
    return `data:audio/mpeg;base64,${Buffer.from(response.data).toString('base64')}`;
  } catch (err) {
    console.warn('TTS tw-ob error:', err.message);
  }

  // Tier 2: Google Translate gtx client fallback
  try {
    const url2 = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=hi&client=gtx&q=${encodeURIComponent(cleanText)}`;
    const response2 = await axios({
      method: 'GET',
      url: url2,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      responseType: 'arraybuffer',
      timeout: 6000
    });
    return `data:audio/mpeg;base64,${Buffer.from(response2.data).toString('base64')}`;
  } catch (err2) {
    console.warn('TTS gtx error:', err2.message);
  }

  return null;
}

function parseSrt(srtContent) {
  const segments = [];
  const blocks = srtContent.replace(/\r\n/g, '\n').split('\n\n');

  function timeToSeconds(timeStr) {
    const match = timeStr.trim().match(/(\d+):(\d+):(\d+)[,\.](\d+)/);
    if (!match) return 0;
    const [_, h, m, s, ms] = match;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  }

  let counter = 1;
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 2) {
      const timeLineIndex = lines[0].includes('-->') ? 0 : 1;
      const timeLine = lines[timeLineIndex];
      if (timeLine && timeLine.includes('-->')) {
        const [startStr, endStr] = timeLine.split('-->');
        const text = lines.slice(timeLineIndex + 1).join(' ').replace(/<[^>]*>/g, '').trim();
        if (text) {
          segments.push({
            id: counter++,
            start: timeToSeconds(startStr),
            end: timeToSeconds(endStr),
            text,
            speaker: 'Speaker 1'
          });
        }
      }
    }
  }
  return segments;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { duration = 10, srtContent = null, dialogues = [] } = req.body || {};

    // 1. Get dialogue segments
    let segments = [];
    if (srtContent && srtContent.trim()) {
      segments = parseSrt(srtContent);
    } else if (dialogues && dialogues.length > 0) {
      segments = dialogues;
    } else {
      // Default cinematic dialogue segments dynamically timed to video length
      const totalSec = Math.max(5, parseFloat(duration) || 10);
      const sampleSentences = [
        "Listen to me! We only have a few moments before the mission begins. Are you ready?",
        "We need to find the truth before it's too late for all of us.",
        "Hold on tight, everything is about to change forever.",
        "Look over there! That is our target.",
        "Stay close, no matter what happens do not let go.",
        "Together, we can accomplish anything."
      ];

      let t = 1.0;
      let count = 1;
      while (t < totalSec - 1.5 && count <= 8) {
        const segDur = Math.min(3.5, Math.max(2.0, (totalSec - t) / 2));
        segments.push({
          id: count,
          start: parseFloat(t.toFixed(2)),
          end: parseFloat((t + segDur).toFixed(2)),
          text: sampleSentences[(count - 1) % sampleSentences.length],
          speaker: `Character ${(count % 2) + 1}`,
          gender: count % 2 === 0 ? 'female' : 'male'
        });
        t += segDur + 1.2;
        count++;
      }
    }

    // 2. Translate and synthesize each segment with India network redundancy
    const processedSegments = [];
    for (const seg of segments) {
      const hindi = await translateFree(seg.text);
      const audioUrl = await getGoogleHindiTTS(hindi);
      processedSegments.push({
        ...seg,
        original: seg.text,
        hindi,
        audioUrl,
        audioStreamUrl: `/api/tts?text=${encodeURIComponent(hindi)}`
      });
    }

    return res.status(200).json({
      success: true,
      segmentsCount: processedSegments.length,
      segments: processedSegments
    });
  } catch (error) {
    console.error('Dub error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
