process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { EdgeTTS } = require('@andresaya/edge-tts');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Supported high-quality Hindi neural voices
const VOICES = {
  male: 'hi-IN-MadhurNeural',
  female: 'hi-IN-SwaraNeural',
  child: 'hi-IN-GulNeural'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fallback: Google Translate TTS in Hindi (Fast, highly reliable, zero rate limit)
 */
async function synthesizeWithGoogleTTS(text, outputPath) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(text.slice(0, 180))}`;
  const response = await axios({
    method: 'GET',
    url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    responseType: 'arraybuffer',
    timeout: 8000
  });
  fs.writeFileSync(outputPath, Buffer.from(response.data));
  return outputPath;
}

/**
 * Synthesize speech in Hindi using Microsoft Neural TTS with retry & Google TTS fallback
 */
async function synthesizeWithEdgeTTS(text, voiceName, outputPath, options = {}) {
  const { rate = '+0%', pitch = '+0Hz', volume = '+0%' } = options;
  const selectedVoice = voiceName || VOICES.male;

  // Try EdgeTTS up to 2 times with delay
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const tts = new EdgeTTS();
      await tts.synthesize(text, selectedVoice, {
        rate,
        pitch,
        volume
      });
      await tts.toFile(outputPath);
      return outputPath;
    } catch (err) {
      console.warn(`EdgeTTS attempt ${attempt} failed for "${text.slice(0, 30)}...":`, err.message);
      if (attempt < 2) await sleep(1200);
    }
  }

  // Fallback to Google TTS
  console.log(`Falling back to high-reliability Google Hindi speech for "${text.slice(0, 30)}..."`);
  return await synthesizeWithGoogleTTS(text, outputPath);
}

/**
 * Optional: Synthesize speech using ElevenLabs API (Voice Cloning)
 */
async function synthesizeWithElevenLabs(text, voiceId, apiKey, outputPath) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || '21m00Tcm4TlvDq8ikWAM'}`;
  
  const response = await axios({
    method: 'POST',
    url,
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    data: {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    },
    responseType: 'arraybuffer'
  });

  fs.writeFileSync(outputPath, Buffer.from(response.data));
  return outputPath;
}

/**
 * Universal TTS generator that switches to ElevenLabs if key exists, or defaults to Edge Neural TTS
 */
async function generateHindiSpeech(text, options = {}) {
  const {
    outputPath,
    gender = 'male',
    voiceName = null,
    elevenLabsKey = process.env.ELEVENLABS_API_KEY,
    elevenLabsVoiceId = null,
    rate = '+0%',
    pitch = '+0Hz'
  } = options;

  if (elevenLabsKey && elevenLabsKey.trim().length > 10) {
    try {
      return await synthesizeWithElevenLabs(text, elevenLabsVoiceId, elevenLabsKey, outputPath);
    } catch (err) {
      console.warn('ElevenLabs failed, falling back to Microsoft Neural TTS:', err.message);
    }
  }

  const voice = voiceName || (gender === 'female' ? VOICES.female : VOICES.male);
  return await synthesizeWithEdgeTTS(text, voice, outputPath, { rate, pitch });
}

module.exports = {
  VOICES,
  generateHindiSpeech,
  synthesizeWithEdgeTTS,
  synthesizeWithGoogleTTS,
  synthesizeWithElevenLabs
};
