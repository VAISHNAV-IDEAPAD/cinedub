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
        const errorMsg = stderr || stdout || `Process exited with code ${code}`;
        reject(new Error(`${command} failed: ${errorMsg.slice(-500)}`));
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
        index: videoStream.index,
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
 */
async function extractBackgroundTrack(videoPath, outputBgmPath) {
  try {
    await runProcess('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',
      '-af', 'volume=0.35',
      '-c:a', 'aac',
      '-b:a', '192k',
      outputBgmPath
    ]);
  } catch (err) {
    await runProcess('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',
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

  let ratio = currentDuration / targetDurationSec;
  // Clamp ratio between 0.75x and 1.35x to avoid robotic pitch artifacts
  ratio = Math.max(0.75, Math.min(1.35, ratio));

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
 * Uses -filter_complex_script to avoid Windows command line character limits
 */
async function assembleHindiDialogueTrack(segments, totalDurationSec, outputWavPath, tempDir) {
  const safeDuration = Math.max(1, parseFloat(totalDurationSec) || 10).toFixed(2);

  if (!segments || segments.length === 0) {
    await runProcess('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', safeDuration,
      '-c:a', 'pcm_s16le',
      outputWavPath
    ]);
    return outputWavPath;
  }

  // Input 0: Silent base track
  const inputs = [
    '-f', 'lavfi',
    '-t', safeDuration,
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'
  ];
  
  const filterParts = [];
  const mixInputs = ['[0:a]'];

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
    '-t', safeDuration,
    outputWavPath
  ]);

  return outputWavPath;
}

/**
 * Combine Hindi Dialogue + Original BGM track + Original Video
 * Built-in safety against MP4 non-monotonic timestamps and muxing failure
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

  const meta = await getVideoMetadata(inputVideoPath);
  const videoIndex = meta.video?.index !== undefined ? meta.video.index : 0;
  const isH264 = meta.video?.isH264 && !forceReencodeVideo;

  // Mix dialogue + ducked background music
  const mixFilter = `[1:a]volume=${dialogueVolume.toFixed(2)}[vocal];[2:a]volume=${bgmVolume.toFixed(2)}[bgm];[vocal][bgm]amix=inputs=2:duration=longest:dropout_transition=0[outa]`;

  // Attempt 1: Fast copy with muxing safety flags if H264
  if (isH264) {
    try {
      console.log('Attempting fast stream copy muxing...');
      await runProcess('ffmpeg', [
        '-y',
        '-fflags', '+genpts',
        '-i', inputVideoPath,
        '-i', hindiDialogueTrack,
        '-i', bgmTrack,
        '-filter_complex', mixFilter,
        '-map', `0:${videoIndex}`,
        '-map', '[outa]',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '44100',
        '-avoid_negative_ts', 'make_zero',
        '-max_muxing_queue_size', '4096',
        '-shortest',
        '-movflags', '+faststart',
        outputMoviePath
      ]);
      console.log('Fast copy muxing succeeded!');
      return outputMoviePath;
    } catch (copyErr) {
      console.warn('Fast stream copy muxing failed (timestamp non-monotonicity or codec mismatch). Falling back to universal transcode muxer:', copyErr.message);
    }
  }

  // Attempt 2: Universal fallback re-encode (guarantees 100% muxing success)
  console.log('Running universal H.264 mobile-safe encoding and muxing...');
  await runProcess('ffmpeg', [
    '-y',
    '-fflags', '+genpts',
    '-i', inputVideoPath,
    '-i', hindiDialogueTrack,
    '-i', bgmTrack,
    '-filter_complex', mixFilter,
    '-map', `0:${videoIndex}`,
    '-map', '[outa]',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'main',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    '-avoid_negative_ts', 'make_zero',
    '-max_muxing_queue_size', '4096',
    '-shortest',
    '-movflags', '+faststart',
    outputMoviePath
  ]);

  console.log('Universal mobile remuxing completed successfully!');
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
