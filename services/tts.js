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

/**
 * Synthesize speech in Hindi using Microsoft Neural TTS (Free, no API key required)
 */
async function synthesizeWithEdgeTTS(text, voiceName, outputPath, options = {}) {
  const { rate = '+0%', pitch = '+0Hz', volume = '+0%' } = options;
  const tts = new EdgeTTS();
  const selectedVoice = voiceName || VOICES.male;

  try {
    await tts.synthesize(text, selectedVoice, {
      rate,
      pitch,
      volume
    });
    await tts.toFile(outputPath);
    return outputPath;
  } catch (err) {
    console.error(`EdgeTTS synthesis failed for "${text}":`, err.message);
    throw err;
  }
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
  synthesizeWithElevenLabs
};
