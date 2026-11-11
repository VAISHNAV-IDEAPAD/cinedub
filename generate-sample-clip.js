const { spawn } = require('child_process');
const { EdgeTTS } = require('@andresaya/edge-tts');
const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = '';
    p.stderr.on('data', d => err += d.toString());
    p.on('close', code => code === 0 ? resolve() : reject(new Error(err)));
  });
}

async function createSampleMovie() {
  console.log('🎬 Generating a test Hollywood scene clip (8 seconds)...');
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const enSpeechFile = path.join(tempDir, 'sample_en_speech.mp3');
  const sampleOutputFile = path.join(__dirname, 'sample_english_scene.mp4');

  // 1. Synthesize Hollywood-style English dialogue
  const tts = new EdgeTTS();
  const dialogueText = "Listen to me! We have only ten seconds before the mission begins. Are you ready?";
  await tts.synthesize(dialogueText, 'en-US-ChristopherNeural', { rate: '+0%' });
  await tts.toFile(enSpeechFile);

  // 2. Combine with test video track
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=duration=8:size=1280x720:rate=24',
    '-i', enSpeechFile,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    sampleOutputFile
  ]);

  console.log(`✅ Sample clip created successfully at: ${sampleOutputFile}`);
}

createSampleMovie().catch(console.error);
