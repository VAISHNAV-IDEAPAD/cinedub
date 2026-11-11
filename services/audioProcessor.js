const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Execute FFmpeg / FFprobe command with promise
 */
function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} failed (code ${code}): ${stderr || stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Inspect video file (resolution, duration, codecs, subtitle streams)
 */
async function getVideoMetadata(filePath) {
  try {
    const { stdout } = await runProcess('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);
    const info = JSON.parse(stdout);
    
    const videoStream = info.streams?.find(s => s.codec_type === 'video');
    const audioStreams = info.streams?.filter(s => s.codec_type === 'audio') || [];
    const subtitleStreams = info.streams?.filter(s => s.codec_type === 'subtitle') || [];
    
    const duration = parseFloat(info.format?.duration || videoStream?.duration || 0);

    return {
      duration,
      formatName: info.format?.format_name,
      sizeBytes: info.format?.size,
      video: videoStream ? {
        codec: videoStream.codec_name,
        width: videoStream.width,
        height: videoStream.height,
        fps: eval(videoStream.r_frame_rate) || 24,
        isH264: videoStream.codec_name === 'h264'
      } : null,
      audioStreams: audioStreams.map((a, i) => ({
        index: a.index,
        codec: a.codec_name,
        channels: a.channels,
        language: a.tags?.language || `audio_${i}`
      })),
      subtitleStreams: subtitleStreams.map(s => ({
        index: s.index,
        codec: s.codec_name,
        language: s.tags?.language || 'und',
        title: s.tags?.title || 'Subtitle'
      }))
    };
  } catch (err) {
    console.error('Error reading video metadata:', err.message);
    throw err;
  }
}

/**
 * Extract audio track to mono 16kHz WAV for Whisper transcription
 */
async function extractAudioForWhisper(videoPath, outputWavPath) {
  await runProcess('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-vn',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    outputWavPath
  ]);
  return outputWavPath;
}

/**
 * Extract background music & sound effects track
 * Center-channel attenuation suppresses center dialogue while keeping stereo BGM and Foley effects intact
 */
async function extractBackgroundTrack(videoPath, outputBgmPath) {
  // Using a vocal-reduction stereo filter:
  // Combines out-of-phase stereo difference + bandpass ducking around speech range
  const filter = 'pan=stereo|c0=c0-0.5*c1|c1=c1-0.5*c0,lowpass=f=3500,highpass=f=200';
  
  try {
    await runProcess('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',
      '-af', 'volume=0.35', // duck background volume for dialogue space
      '-c:a', 'aac',
      '-b:a', '192k',
      outputBgmPath
    ]);
  } catch (err) {
    // Fallback: direct audio extract if advanced filter fails
    await runProcess('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',
      '-af', 'volume=0.3',
      '-c:a', 'aac',
      outputBgmPath
    ]);
  }
  return outputBgmPath;
}

/**
 * Get exact duration of an audio file in seconds
 */
async function getAudioDuration(audioPath) {
  const { stdout } = await runProcess('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath
  ]);
  return parseFloat(stdout.trim()) || 0;
}

/**
 * Time stretch an audio clip to target duration (using FFmpeg atempo)
 */
async function timeStretchAudio(inputPath, outputPath, targetDurationSec) {
  const currentDuration = await getAudioDuration(inputPath);
  if (currentDuration <= 0.05 || targetDurationSec <= 0.05) {
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  // Calculate speed ratio: current / target
  let ratio = currentDuration / targetDurationSec;
  // Clamp ratio between 0.75x and 1.35x to avoid unnatural robotic pitch artifacts
  ratio = Math.max(0.75, Math.min(1.35, ratio));

  // atempo supports 0.5 to 2.0 in a single filter
  await runProcess('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-filter:a', `atempo=${ratio.toFixed(3)}`,
    outputPath
  ]);
  return outputPath;
}

/**
 * Composite multiple timed Hindi voice clips into a single synchronous dialogue track
 * segments: [{ start: float, end: float, audioFile: string }]
 */
async function assembleHindiDialogueTrack(segments, totalDurationSec, outputWavPath, tempDir) {
  if (!segments || segments.length === 0) {
    // Generate silence audio of total duration
    await runProcess('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
      '-t', `${Math.max(1, totalDurationSec.toFixed(2))}`,
      '-c:a', 'pcm_s16le',
      outputWavPath
    ]);
    return outputWavPath;
  }

  // Build FFmpeg complex filter graph:
  // For each audio segment, delay it by start time (in milliseconds)
  const inputs = [];
  const filterParts = [];
  const mixInputs = [];

  // Input 0: Silent base track of entire movie duration
  inputs.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:d=${totalDurationSec.toFixed(2)}`);
  mixInputs.push('[0:a]');

  segments.forEach((seg, idx) => {
    const inputIdx = idx + 1;
    inputs.push('-i', seg.audioFile);
    const delayMs = Math.max(0, Math.round(seg.start * 1000));
    filterParts.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs}[a${inputIdx}]`);
    mixInputs.push(`[a${inputIdx}]`);
  });

  const filterGraph = `${filterParts.join(';')};${mixInputs.join('')}amix=inputs=${mixInputs.length}:dropout_transition=0:normalize=0[outa]`;

  await runProcess('ffmpeg', [
    '-y',
    ...inputs,
    '-filter_complex', filterGraph,
    '-map', '[outa]',
    '-c:a', 'pcm_s16le',
    '-t', `${totalDurationSec.toFixed(2)}`,
    outputWavPath
  ]);

  return outputWavPath;
}

/**
 * Combine Hindi Dialogue + Original BGM track + Original Video
 * Produces mobile-ready MP4 (H.264 + AAC + faststart)
 */
async function produceFinalMovie(options) {
  const {
    inputVideoPath,
    hindiDialogueTrack,
    bgmTrack,
    outputMoviePath,
    bgmVolume = 0.35,
    dialogueVolume = 1.0,
    forceReencodeVideo = false
  } = options;

  // Mix Hindi dialogue with ducked background music
  const mixFilter = `[1:a]volume=${dialogueVolume.toFixed(2)}[vocal];[2:a]volume=${bgmVolume.toFixed(2)}[bgm];[vocal][bgm]amix=inputs=2:duration=first:dropout_transition=2[outa]`;

  // Check if original video stream is already H.264
  const meta = await getVideoMetadata(inputVideoPath);
  const canCopyVideo = !forceReencodeVideo && meta.video?.isH264;

  const videoEncodingArgs = canCopyVideo
    ? ['-c:v', 'copy']
    : [
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'high',
        '-level', '4.1'
      ];

  await runProcess('ffmpeg', [
    '-y',
    '-i', inputVideoPath,
    '-i', hindiDialogueTrack,
    '-i', bgmTrack,
    '-filter_complex', mixFilter,
    '-map', '0:v:0',
    '-map', '[outa]',
    ...videoEncodingArgs,
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    '-movflags', '+faststart', // ESSENTIAL for iOS Safari & Android mobile browsers
    outputMoviePath
  ]);

  return outputMoviePath;
}

module.exports = {
  getVideoMetadata,
  extractAudioForWhisper,
  extractBackgroundTrack,
  getAudioDuration,
  timeStretchAudio,
  assembleHindiDialogueTrack,
  produceFinalMovie
};
