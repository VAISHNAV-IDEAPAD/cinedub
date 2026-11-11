const path = require('path');
const fs = require('fs');
const audioProcessor = require('./audioProcessor');
const transcriber = require('./transcriber');
const translator = require('./translator');
const tts = require('./tts');

/**
 * Execute the end-to-end AI Movie Dubbing Pipeline
 */
async function runDubbingPipeline(inputVideoPath, outputDir, options = {}, onProgress = () => {}) {
  const jobId = `job_${Date.now()}`;
  const tempDir = path.join(outputDir, '..', 'temp', jobId);
  fs.mkdirSync(tempDir, { recursive: true });

  const finalVideoName = `hindi_dubbed_${path.basename(inputVideoPath, path.extname(inputVideoPath))}.mp4`;
  const finalVideoPath = path.join(outputDir, finalVideoName);

  try {
    // ----------------------------------------------------
    // STAGE 1: Video Analysis & Audio Demuxing (0% - 20%)
    // ----------------------------------------------------
    onProgress({
      stage: 'analysis',
      percent: 5,
      message: 'Inspecting movie codecs, streams, and duration...'
    });

    const meta = await audioProcessor.getVideoMetadata(inputVideoPath);
    const duration = meta.duration || 60;

    onProgress({
      stage: 'audio_extraction',
      percent: 12,
      message: `Movie duration: ${Math.round(duration)}s. Separating dialogue and background audio tracks...`
    });

    const wavPath = path.join(tempDir, 'dialogue_mono.wav');
    const bgmPath = path.join(tempDir, 'bgm_track.aac');

    await Promise.all([
      audioProcessor.extractAudioForWhisper(inputVideoPath, wavPath),
      audioProcessor.extractBackgroundTrack(inputVideoPath, bgmPath)
    ]);

    onProgress({
      stage: 'audio_extraction',
      percent: 20,
      message: 'Background music & sound effects track preserved successfully!'
    });

    // ----------------------------------------------------
    // STAGE 2: Speech Recognition & Diarization (20% - 40%)
    // ----------------------------------------------------
    onProgress({
      stage: 'transcription',
      percent: 25,
      message: 'Transcribing speech and extracting dialogue timestamps...'
    });

    const segments = await transcriber.transcribeVideoAudio(wavPath, inputVideoPath, {
      groqKey: options.groqKey,
      openaiKey: options.openaiKey,
      uploadedSrtContent: options.uploadedSrtContent,
      tempDir,
      totalDuration: duration
    });

    if (!segments || segments.length === 0) {
      throw new Error('No dialogue segments could be extracted from the video.');
    }

    onProgress({
      stage: 'transcription',
      percent: 40,
      message: `Extracted ${segments.length} dialogue segments with exact timing markers.`,
      segmentsCount: segments.length
    });

    // ----------------------------------------------------
    // STAGE 3: Cinematic Hindi Translation (40% - 60%)
    // ----------------------------------------------------
    onProgress({
      stage: 'translation',
      percent: 45,
      message: 'Translating English dialogue to natural Bollywood cinematic Hindi...'
    });

    const translatedSegments = await translator.translateDialogueSegments(segments, {
      geminiKey: options.geminiKey,
      openaiKey: options.openaiKey,
      groqKey: options.groqKey
    });

    onProgress({
      stage: 'translation',
      percent: 60,
      message: 'Dialogue localized to natural Hindi script.',
      previewSegments: translatedSegments.slice(0, 5)
    });

    // ----------------------------------------------------
    // STAGE 4: Multi-Voice Hindi Neural TTS (60% - 80%)
    // ----------------------------------------------------
    onProgress({
      stage: 'synthesis',
      percent: 65,
      message: 'Synthesizing character voices with Microsoft Neural Hindi TTS...'
    });

    const synthesizedClips = [];
    const maleVoice = options.maleVoice || 'hi-IN-MadhurNeural';
    const femaleVoice = options.femaleVoice || 'hi-IN-SwaraNeural';

    for (let i = 0; i < translatedSegments.length; i++) {
      const seg = translatedSegments[i];
      const rawAudioPath = path.join(tempDir, `raw_voice_${i}.mp3`);
      const stretchedAudioPath = path.join(tempDir, `synced_voice_${i}.wav`);

      const chosenVoice = seg.gender === 'female' ? femaleVoice : maleVoice;

      try {
        await tts.generateHindiSpeech(seg.hindi, {
          outputPath: rawAudioPath,
          gender: seg.gender,
          voiceName: chosenVoice,
          elevenLabsKey: options.elevenLabsKey
        });

        // Time-stretch audio clip to match original dialogue interval
        const targetDuration = Math.max(0.6, seg.end - seg.start);
        await audioProcessor.timeStretchAudio(rawAudioPath, stretchedAudioPath, targetDuration);

        synthesizedClips.push({
          start: seg.start,
          end: seg.end,
          audioFile: stretchedAudioPath
        });
      } catch (err) {
        console.warn(`Failed synthesis for segment ${i}:`, err.message);
      }

      const progressPercent = 65 + Math.round((i / translatedSegments.length) * 15);
      onProgress({
        stage: 'synthesis',
        percent: progressPercent,
        message: `Dubbing dialogue line ${i + 1} of ${translatedSegments.length}...`,
        currentLine: seg.hindi
      });
    }

    // ----------------------------------------------------
    // STAGE 5: Audio Assembly & BGM Ducking (80% - 90%)
    // ----------------------------------------------------
    onProgress({
      stage: 'mixing',
      percent: 82,
      message: 'Assembling synchronized Hindi dialogue track...'
    });

    const fullHindiTrackPath = path.join(tempDir, 'hindi_dialogue_full.wav');
    await audioProcessor.assembleHindiDialogueTrack(synthesizedClips, duration, fullHindiTrackPath, tempDir);

    onProgress({
      stage: 'mixing',
      percent: 88,
      message: 'Balancing dialogue volume and ducking background soundtrack...'
    });

    // ----------------------------------------------------
    // STAGE 6: Universal Mobile Remuxing (90% - 100%)
    // ----------------------------------------------------
    onProgress({
      stage: 'remuxing',
      percent: 92,
      message: 'Encoding final MP4 with H.264 & AAC + FastStart for instant iOS & Android playback...'
    });

    const bgmVolume = options.bgmVolume !== undefined ? parseFloat(options.bgmVolume) : 0.35;
    const dialogueVolume = options.dialogueVolume !== undefined ? parseFloat(options.dialogueVolume) : 1.1;

    await audioProcessor.produceFinalMovie({
      inputVideoPath,
      hindiDialogueTrack: fullHindiTrackPath,
      bgmTrack: bgmPath,
      outputMoviePath: finalVideoPath,
      bgmVolume,
      dialogueVolume,
      forceReencodeVideo: !meta.video?.isH264
    });

    onProgress({
      stage: 'completed',
      percent: 100,
      message: 'Hindi dubbed movie created successfully!',
      outputPath: finalVideoPath,
      outputFilename: finalVideoName,
      totalDuration: duration
    });

    // Cleanup temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}

    return {
      success: true,
      outputPath: finalVideoPath,
      filename: finalVideoName,
      duration,
      segments: translatedSegments
    };

  } catch (error) {
    console.error('Dubbing pipeline failed:', error);
    // Cleanup on failure
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    onProgress({
      stage: 'error',
      percent: 0,
      message: `Error: ${error.message}`
    });
    throw error;
  }
}

module.exports = {
  runDubbingPipeline
};
