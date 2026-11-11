process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const axios = require('axios');

/**
 * Free Google Translate Web Endpoint fallback (Zero API key required)
 */
async function translateWithFreeWeb(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url, { timeout: 8000 });
    if (res.data && res.data[0]) {
      return res.data[0].map(item => item[0]).join('').trim();
    }
  } catch (err) {
    console.warn(`Web translate fallback warning for "${text}":`, err.message);
  }
  return text;
}

/**
 * Cinematic translation using Google Gemini API
 */
async function translateWithGemini(segments, apiKey) {
  const prompt = `You are an elite Hollywood movie dubbing director translating English dialogue into natural, cinematic, colloquial Hindi (Bollywood dubbing style).

Guidelines:
1. Translate contextually, not literally. Adapt English idioms and humor to natural Hindi conversation.
2. Maintain character personality, emotion, and tone (serious, witty, heroic, aggressive).
3. Try to match the syllable length and duration of the original English line so audio lip-sync works well.
4. Detect character gender if implied (male/female).

Input JSON array of dialogue segments:
${JSON.stringify(segments.map(s => ({ id: s.id, text: s.text, speaker: s.speaker })), null, 2)}

Respond with ONLY valid JSON array with this structure (no markdown fences, no extra text):
[
  {
    "id": 1,
    "hindi": "हिंदी अनुवाद यहाँ",
    "gender": "male"
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json'
    }
  }, { timeout: 20000 });

  const rawJson = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) throw new Error('No content from Gemini API');
  
  const parsed = JSON.parse(rawJson);
  const translationMap = new Map(parsed.map(item => [item.id, item]));

  return segments.map(seg => {
    const match = translationMap.get(seg.id);
    return {
      ...seg,
      original: seg.text,
      hindi: match?.hindi || seg.text,
      gender: match?.gender || (seg.speaker?.includes('2') ? 'female' : 'male')
    };
  });
}

/**
 * Cinematic translation using OpenAI / Groq
 */
async function translateWithOpenAI(segments, apiKey, baseURL = 'https://api.openai.com/v1', model = 'gpt-4o-mini') {
  const prompt = `Translate these English movie subtitles into natural Bollywood-style cinematic Hindi dialogue. Keep syllable counts similar for dubbing sync. Detect speaker gender.
Return ONLY valid JSON array with format: [{"id": number, "hindi": string, "gender": "male"|"female"}]
Subtitles:
${JSON.stringify(segments.map(s => ({ id: s.id, text: s.text })), null, 2)}`;

  const response = await axios.post(`${baseURL}/chat/completions`, {
    model,
    messages: [
      { role: 'system', content: 'You are a professional Hollywood to Hindi movie dubbing localization engine. Output pure JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3
  }, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 25000
  });

  const content = response.data.choices[0].message.content.trim();
  const cleanJson = content.replace(/^```json/, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleanJson);
  const translationMap = new Map(parsed.map(item => [item.id, item]));

  return segments.map(seg => {
    const match = translationMap.get(seg.id);
    return {
      ...seg,
      original: seg.text,
      hindi: match?.hindi || seg.text,
      gender: match?.gender || 'male'
    };
  });
}

/**
 * Master translator: selects Gemini, OpenAI, Groq, or falls back to Web Translator
 */
async function translateDialogueSegments(segments, options = {}) {
  const {
    geminiKey = process.env.GEMINI_API_KEY,
    openaiKey = process.env.OPENAI_API_KEY,
    groqKey = process.env.GROQ_API_KEY
  } = options;

  // 1. Try Gemini
  if (geminiKey && geminiKey.trim().length > 10) {
    try {
      console.log('Translating dialogue with Google Gemini 1.5 Flash...');
      return await translateWithGemini(segments, geminiKey.trim());
    } catch (err) {
      console.warn('Gemini translation failed, trying next method:', err.message);
    }
  }

  // 2. Try OpenAI
  if (openaiKey && openaiKey.trim().length > 10) {
    try {
      console.log('Translating dialogue with OpenAI...');
      return await translateWithOpenAI(segments, openaiKey.trim());
    } catch (err) {
      console.warn('OpenAI translation failed, trying next method:', err.message);
    }
  }

  // 3. Try Groq Llama 3
  if (groqKey && groqKey.trim().length > 10) {
    try {
      console.log('Translating dialogue with Groq...');
      return await translateWithOpenAI(segments, groqKey.trim(), 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile');
    } catch (err) {
      console.warn('Groq translation failed, falling back to Web Translate:', err.message);
    }
  }

  // 4. Zero-Config Fallback: Free Web Translation
  console.log('Translating dialogue using high-speed web translation engine...');
  const results = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const hindi = await translateWithFreeWeb(seg.text);
    results.push({
      ...seg,
      original: seg.text,
      hindi: hindi || seg.text,
      gender: i % 2 === 0 ? 'male' : 'female'
    });
  }
  return results;
}

module.exports = {
  translateDialogueSegments,
  translateWithGemini,
  translateWithOpenAI,
  translateWithFreeWeb
};
