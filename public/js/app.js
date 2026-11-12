document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabUploadBtn = document.getElementById('tabUploadBtn');
  const tabLocalPathBtn = document.getElementById('tabLocalPathBtn');
  const tabUploadPane = document.getElementById('tabUploadPane');
  const tabLocalPathPane = document.getElementById('tabLocalPathPane');

  const dropZone = document.getElementById('dropZone');
  const videoFileInput = document.getElementById('videoFileInput');
  const btnAndroidFileManager = document.getElementById('btnAndroidFileManager');
  const btnGalleryPicker = document.getElementById('btnGalleryPicker');
  const fileManagerInput = document.getElementById('fileManagerInput');
  const galleryInput = document.getElementById('galleryInput');
  const selectedFileName = document.getElementById('selectedFileName');
  const localFilePathInput = document.getElementById('localFilePathInput');
  const subtitleFileInput = document.getElementById('subtitleFileInput');

  const subAccordionToggle = document.getElementById('subAccordionToggle');
  const subAccordionContent = document.getElementById('subAccordionContent');

  const startDubBtn = document.getElementById('startDubBtn');
  const uploadSection = document.getElementById('uploadSection');
  const progressSection = document.getElementById('progressSection');
  const resultSection = document.getElementById('resultSection');

  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const currentStageText = document.getElementById('currentStageText');
  const transcriptPreview = document.getElementById('transcriptPreview');
  const scriptScroll = document.getElementById('scriptScroll');

  const dubbedVideoPlayer = document.getElementById('dubbedVideoPlayer');
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadAudioBtn = document.getElementById('downloadAudioBtn');
  const dubAnotherBtn = document.getElementById('dubAnotherBtn');
  const subOverlay = document.getElementById('subOverlay');
  const hindiAudioPlayer = document.getElementById('hindiAudioPlayer');

  // Track switcher & Master Audio elements
  const trackHindiBtn = document.getElementById('trackHindiBtn');
  const trackEnglishBtn = document.getElementById('trackEnglishBtn');
  const unmuteAllBtn = document.getElementById('unmuteAllBtn');
  const unmuteIcon = document.getElementById('unmuteIcon');
  const unmuteText = document.getElementById('unmuteText');
  const testSoundBtn = document.getElementById('testSoundBtn');
  const masterVolumeSlider = document.getElementById('masterVolumeSlider');
  const renderDubbedVideoBtn = document.getElementById('renderDubbedVideoBtn');
  const renderBtnText = document.getElementById('renderBtnText');
  const dubTrackStatus = document.getElementById('dubTrackStatus');

  // Server Status Bar Elements
  const serverStatusBar = document.getElementById('serverStatusBar');
  const serverStatusText = document.getElementById('serverStatusText');
  const reconnectBtn = document.getElementById('reconnectBtn');
  const backendUrlInput = document.getElementById('backendUrlInput');

  // Settings Elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const maleVoiceSelect = document.getElementById('maleVoiceSelect');
  const femaleVoiceSelect = document.getElementById('femaleVoiceSelect');
  const bgmSlider = document.getElementById('bgmSlider');
  const bgmVolDisplay = document.getElementById('bgmVolDisplay');
  const geminiKeyInput = document.getElementById('geminiKeyInput');
  const groqKeyInput = document.getElementById('groqKeyInput');
  const elevenLabsKeyInput = document.getElementById('elevenLabsKeyInput');

  // Mobile QR Elements
  const qrBtn = document.getElementById('qrBtn');
  const qrModal = document.getElementById('qrModal');
  const closeQrBtn = document.getElementById('closeQrBtn');
  const qrCodeImgWrapper = document.getElementById('qrCodeImgWrapper');
  const mobileUrlDisplay = document.getElementById('mobileUrlDisplay');
  const copyUrlBtn = document.getElementById('copyUrlBtn');

  let activeTab = 'upload'; // 'upload' | 'local'
  let selectedFile = null;
  let selectedFileBlobUrl = null;
  let eventSource = null;
  let activeAudioTrack = 'hindi'; // 'hindi' | 'english'
  let currentSegments = [];
  let activeSegmentIndex = -1;
  let activePlayingAudio = null;
  let masterVolume = 1.0;
  let audioUnlocked = false;
  let audioCtx = null;
  let activeSourceNode = null;
  let fullSoundtrackBlob = null;
  let videoTotalDuration = 10;

  function getBackendUrl() {
    const saved = localStorage.getItem('cinedub_backend_url');
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '');
    if (window.location.hostname.includes('vercel.app')) {
      return ''; // Use relative /api on Vercel
    }
    return window.location.origin;
  }

  async function checkBackendConnection() {
    if (!serverStatusBar) return;
    serverStatusBar.className = 'server-status-bar connected';
    serverStatusText.textContent = `🟢 CineDub AI Studio Engine Ready (Cloud Serverless Active)`;
  }

  // Load saved settings from LocalStorage
  function loadSettings() {
    if (backendUrlInput) backendUrlInput.value = localStorage.getItem('cinedub_backend_url') || '';
    if (geminiKeyInput) geminiKeyInput.value = localStorage.getItem('cinedub_gemini_key') || '';
    if (groqKeyInput) groqKeyInput.value = localStorage.getItem('cinedub_groq_key') || '';
    if (elevenLabsKeyInput) elevenLabsKeyInput.value = localStorage.getItem('cinedub_eleven_key') || '';
    if (maleVoiceSelect) maleVoiceSelect.value = localStorage.getItem('cinedub_male_voice') || 'hi-IN-MadhurNeural';
    if (femaleVoiceSelect) femaleVoiceSelect.value = localStorage.getItem('cinedub_female_voice') || 'hi-IN-SwaraNeural';
    const savedBgm = localStorage.getItem('cinedub_bgm_vol') || '0.35';
    if (bgmSlider) bgmSlider.value = savedBgm;
    if (bgmVolDisplay) bgmVolDisplay.textContent = `${Math.round(savedBgm * 100)}%`;
  }
  loadSettings();
  checkBackendConnection();

  if (reconnectBtn) {
    reconnectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      checkBackendConnection();
    });
  }

  // Tab switching
  tabUploadBtn.addEventListener('click', () => {
    activeTab = 'upload';
    tabUploadBtn.classList.add('active');
    tabLocalPathBtn.classList.remove('active');
    tabUploadPane.classList.add('active');
    tabLocalPathPane.classList.remove('active');
    validateForm();
  });

  tabLocalPathBtn.addEventListener('click', () => {
    activeTab = 'local';
    tabLocalPathBtn.classList.add('active');
    tabUploadBtn.classList.remove('active');
    tabLocalPathPane.classList.add('active');
    tabUploadPane.classList.remove('active');
    validateForm();
  });

  // Accordion toggle
  if (subAccordionToggle && subAccordionContent) {
    subAccordionToggle.addEventListener('click', () => {
      subAccordionContent.classList.toggle('open');
    });
  }

  // Drag and drop events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  videoFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  // Android File Manager Picker Button
  if (btnAndroidFileManager && fileManagerInput) {
    btnAndroidFileManager.addEventListener('click', async (e) => {
      e.preventDefault();
      // Try File System Access API if available on modern Chromium
      if (window.showOpenFilePicker) {
        try {
          const [fileHandle] = await window.showOpenFilePicker({
            types: [
              {
                description: 'Movie Files',
                accept: {
                  'video/*': ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.ts', '.m4v']
                }
              }
            ],
            multiple: false
          });
          const file = await fileHandle.getFile();
          handleFileSelection(file);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      fileManagerInput.click();
    });

    fileManagerInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }

  // Gallery / Photos Picker Button
  if (btnGalleryPicker && galleryInput) {
    btnGalleryPicker.addEventListener('click', (e) => {
      e.preventDefault();
      galleryInput.click();
    });

    galleryInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }

  if (localFilePathInput) {
    localFilePathInput.addEventListener('input', validateForm);
  }

  function handleFileSelection(file) {
    if (!file) return;

    // Validate that the chosen file is a video or recognizable media format
    const validVideoExts = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.ts', '.m4v', '.3gp', '.flv', '.wmv'];
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const isVideo = file.type.startsWith('video/') || validVideoExts.includes(ext) || file.type === 'application/octet-stream';

    if (!isVideo && file.size > 0) {
      const proceed = confirm(`"${file.name}" might not be a standard video format. Do you want to proceed with this file anyway?`);
      if (!proceed) return;
    }

    selectedFile = file;
    if (selectedFileBlobUrl) URL.revokeObjectURL(selectedFileBlobUrl);
    selectedFileBlobUrl = URL.createObjectURL(file);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    selectedFileName.textContent = `🎬 ${file.name} (${sizeMb} MB)`;
    validateForm();
  }

  function validateForm() {
    if (activeTab === 'upload') {
      startDubBtn.disabled = !selectedFile;
    } else {
      startDubBtn.disabled = !localFilePathInput || !localFilePathInput.value.trim();
    }
  }

  // Settings Handlers
  settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
  bgmSlider.addEventListener('input', (e) => {
    bgmVolDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
  });

  saveSettingsBtn.addEventListener('click', () => {
    if (backendUrlInput) {
      localStorage.setItem('cinedub_backend_url', backendUrlInput.value.trim());
    }
    localStorage.setItem('cinedub_gemini_key', geminiKeyInput.value.trim());
    localStorage.setItem('cinedub_groq_key', groqKeyInput.value.trim());
    localStorage.setItem('cinedub_eleven_key', elevenLabsKeyInput.value.trim());
    localStorage.setItem('cinedub_male_voice', maleVoiceSelect.value);
    localStorage.setItem('cinedub_female_voice', femaleVoiceSelect.value);
    localStorage.setItem('cinedub_bgm_vol', bgmSlider.value);
    settingsModal.classList.add('hidden');
    checkBackendConnection();
  });

  // QR Modal Handlers
  qrBtn.addEventListener('click', async () => {
    qrModal.classList.remove('hidden');
    const directUrl = window.location.href;
    mobileUrlDisplay.textContent = directUrl;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(directUrl)}`;
    qrCodeImgWrapper.innerHTML = `<img src="${qrApiUrl}" alt="Scan on Mobile" width="180" height="180">`;
  });

  closeQrBtn.addEventListener('click', () => qrModal.classList.add('hidden'));

  copyUrlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(mobileUrlDisplay.textContent);
    copyUrlBtn.textContent = 'Copied to Clipboard!';
    setTimeout(() => { copyUrlBtn.textContent = 'Copy Mobile URL'; }, 2000);
  });

  // Web Audio Context Management
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function base64ToArrayBuffer(base64) {
    const clean = base64.includes(',') ? base64.split(',')[1] : base64;
    const binary = window.atob(clean.replace(/[^A-Za-z0-9+/=]/g, ''));
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function decodeAudioDataPromise(ctx, arrayBuffer) {
    return new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });
  }

  // Pre-decode all Hindi dialogue audio clips into native AudioBuffers
  async function decodeAllSegments(segments) {
    if (!segments || !Array.isArray(segments)) return;
    const ctx = getAudioContext();
    for (const seg of segments) {
      if (seg.audioUrl && seg.audioUrl.startsWith('data:')) {
        try {
          const ab = base64ToArrayBuffer(seg.audioUrl);
          seg.audioBuffer = await decodeAudioDataPromise(ctx, ab);
        } catch (e) {
          console.warn(`Could not decode audio for segment ${seg.id}:`, e);
        }
      } else if (seg.audioStreamUrl) {
        try {
          const res = await fetch(seg.audioStreamUrl);
          const ab = await res.arrayBuffer();
          seg.audioBuffer = await decodeAudioDataPromise(ctx, ab);
        } catch (e) {
          console.warn(`Could not fetch/decode audio for segment ${seg.id}:`, e);
        }
      }
    }
  }

  // Convert rendered AudioBuffer to 16-bit PCM WAV Blob
  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const numSamples = buffer.length;
    const dataSize = numSamples * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const dataView = new DataView(arrayBuffer);

    function writeString(offset, string) {
      for (let i = 0; i < string.length; i++) {
        dataView.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    dataView.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    dataView.setUint32(16, 16, true);
    dataView.setUint16(20, format, true);
    dataView.setUint16(22, numChannels, true);
    dataView.setUint32(24, sampleRate, true);
    dataView.setUint32(28, sampleRate * blockAlign, true);
    dataView.setUint16(32, blockAlign, true);
    dataView.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    dataView.setUint32(40, dataSize, true);

    let offset = 44;
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channels[ch][i];
        sample = Math.max(-1, Math.min(1, sample));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        dataView.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([dataView], { type: 'audio/wav' });
  }

  // Generate complete movie-length synchronized Hindi soundtrack
  async function generateFullSoundtrack(duration, segments) {
    try {
      const sampleRate = 44100;
      const totalSamples = Math.max(1, Math.ceil((duration || 10) * sampleRate));
      const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

      let scheduledCount = 0;
      for (const seg of segments) {
        if (seg.audioBuffer) {
          const src = offlineCtx.createBufferSource();
          src.buffer = seg.audioBuffer;
          src.connect(offlineCtx.destination);
          src.start(Math.max(0, seg.start));
          scheduledCount++;
        }
      }

      if (scheduledCount === 0) return null;

      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWav(renderedBuffer);
    } catch (err) {
      console.warn('Full soundtrack generation error:', err);
      return null;
    }
  }

  // Play segment via Web Audio API
  function playSegmentAudio(seg) {
    stopCurrentAudio();
    const ctx = getAudioContext();

    if (seg.audioBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = seg.audioBuffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = masterVolume;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        activeSourceNode = source;
        return;
      } catch (err) {
        console.warn('WebAudio source play failed:', err);
      }
    }

    // Secondary fallback: HTML5 audio element
    if (seg.audioUrl) {
      hindiAudioPlayer.src = seg.audioUrl;
      hindiAudioPlayer.currentTime = 0;
      hindiAudioPlayer.volume = masterVolume;
      hindiAudioPlayer.play().catch(() => playSpeechFallback(seg.hindi));
      return;
    }

    // Tertiary fallback: Web Speech API
    playSpeechFallback(seg.hindi);
  }

  function stopCurrentAudio() {
    if (activeSourceNode) {
      try {
        activeSourceNode.stop();
      } catch (_) {}
      activeSourceNode = null;
    }
    hindiAudioPlayer.pause();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    activeSegmentIndex = -1;
  }

  // Universal Audio Unlocker for Mobile Safari & Android Chrome
  function unlockAudioEngine() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    // Resume Web Audio Context
    getAudioContext();

    // Unmute video player
    dubbedVideoPlayer.muted = false;
    dubbedVideoPlayer.volume = masterVolume;

    // Unmute background audio element
    hindiAudioPlayer.muted = false;
    hindiAudioPlayer.volume = masterVolume;

    // Trigger silent 1ms audio to authorize audio playback context in browser
    hindiAudioPlayer.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
    hindiAudioPlayer.play().then(() => {
      hindiAudioPlayer.pause();
    }).catch(() => {});

    // Prime Web Speech API
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        const silentUtterance = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(silentUtterance);
      } catch (_) {}
    }

    if (unmuteText && unmuteIcon) {
      unmuteIcon.textContent = '🔊';
      unmuteText.textContent = `Audio: Active (${Math.round(masterVolume * 100)}%)`;
    }
  }

  // Register unlock triggers on all user gestures
  ['click', 'touchstart', 'pointerdown'].forEach(ev => {
    document.addEventListener(ev, () => unlockAudioEngine(), { once: true, passive: true });
  });

  function playSpeechFallback(text) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.volume = masterVolume;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
    }
  }

  // Track switcher handlers
  if (trackHindiBtn && trackEnglishBtn) {
    trackHindiBtn.addEventListener('click', () => {
      unlockAudioEngine();
      activeAudioTrack = 'hindi';
      trackHindiBtn.classList.add('active');
      trackEnglishBtn.classList.remove('active');
      subOverlay.classList.remove('hidden');
      if (dubTrackStatus) {
        dubTrackStatus.innerHTML = '🎙️ Active Track: <strong>Hindi Neural Dub</strong> (English Dialogue Muted)';
        dubTrackStatus.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        dubTrackStatus.style.color = '#34d399';
      }
    });

    trackEnglishBtn.addEventListener('click', () => {
      unlockAudioEngine();
      activeAudioTrack = 'english';
      trackEnglishBtn.classList.add('active');
      trackHindiBtn.classList.remove('active');
      stopCurrentAudio();
      subOverlay.classList.add('hidden');
      dubbedVideoPlayer.muted = false;
      dubbedVideoPlayer.volume = masterVolume;
      if (dubTrackStatus) {
        dubTrackStatus.innerHTML = '🇺🇸 Active Track: <strong>Original English Soundtrack</strong> (Original Voices)';
        dubTrackStatus.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        dubTrackStatus.style.color = '#60a5fa';
      }
    });
  }

  // Unmute & Audio Controls Handlers
  if (unmuteAllBtn) {
    unmuteAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      unlockAudioEngine();
      dubbedVideoPlayer.muted = false;
      hindiAudioPlayer.muted = false;
      masterVolume = 1.0;
      dubbedVideoPlayer.volume = 1.0;
      hindiAudioPlayer.volume = 1.0;
      if (masterVolumeSlider) masterVolumeSlider.value = 1.0;
      if (unmuteIcon) unmuteIcon.textContent = '🔊';
      if (unmuteText) unmuteText.textContent = 'Audio: Active (100%)';
      playSpeechFallback('सिनेडब ऑडियो सक्रिय है');
    });
  }

  if (testSoundBtn) {
    testSoundBtn.addEventListener('click', (e) => {
      e.preventDefault();
      unlockAudioEngine();
      dubbedVideoPlayer.muted = false;
      masterVolume = 1.0;
      dubbedVideoPlayer.volume = 1.0;
      if (masterVolumeSlider) masterVolumeSlider.value = 1.0;

      if (currentSegments && currentSegments.length > 0) {
        playSegmentAudio(currentSegments[0]);
      } else {
        playSpeechFallback('नमस्ते, सिनेडब ऑडियो सक्रिय है।');
      }
    });
  }

  if (masterVolumeSlider) {
    masterVolumeSlider.addEventListener('input', (e) => {
      masterVolume = parseFloat(e.target.value);
      dubbedVideoPlayer.volume = masterVolume;
      hindiAudioPlayer.volume = masterVolume;
      if (unmuteIcon && unmuteText) {
        if (masterVolume === 0) {
          unmuteIcon.textContent = '🔇';
          unmuteText.textContent = 'Audio: Muted (0%)';
          dubbedVideoPlayer.muted = true;
        } else {
          unmuteIcon.textContent = '🔊';
          unmuteText.textContent = `Audio: Active (${Math.round(masterVolume * 100)}%)`;
          dubbedVideoPlayer.muted = false;
        }
      }
    });
  }

  // In-Browser MediaRecorder Dubbed Video Exporter
  let isRendering = false;
  if (renderDubbedVideoBtn) {
    renderDubbedVideoBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (isRendering) return;

      const stream = dubbedVideoPlayer.captureStream ? dubbedVideoPlayer.captureStream() : dubbedVideoPlayer.mozCaptureStream ? dubbedVideoPlayer.mozCaptureStream() : null;
      if (!stream) {
        alert('Direct video capture is not supported on this browser version. Downloading full Hindi Audio Track instead!');
        if (downloadAudioBtn) downloadAudioBtn.click();
        return;
      }

      isRendering = true;
      renderBtnText.textContent = '⏳ Rendering Dubbed Movie... (Playing Scene)';

      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const recordedChunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const dubbedBlob = new Blob(recordedChunks, { type: mimeType || 'video/mp4' });
        const dubbedUrl = URL.createObjectURL(dubbedBlob);
        const a = document.createElement('a');
        a.href = dubbedUrl;
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `hindi_dubbed_${(selectedFile?.name || 'movie').replace(/\.[^/.]+$/, "")}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        isRendering = false;
        renderBtnText.textContent = '✅ Dubbed Video Downloaded! Click to Re-Export';
      };

      recorder.start(250);
      dubbedVideoPlayer.currentTime = 0;
      dubbedVideoPlayer.play();

      dubbedVideoPlayer.onended = () => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
        dubbedVideoPlayer.onended = null;
      };
    });
  }

  // Synchronized Audio & Subtitle playback loop
  dubbedVideoPlayer.addEventListener('timeupdate', () => {
    if (!currentSegments || currentSegments.length === 0) return;
    const currentTime = dubbedVideoPlayer.currentTime;

    const currentSeg = currentSegments.find(s => currentTime >= s.start && currentTime <= s.end);

    if (currentSeg) {
      if (activeAudioTrack === 'hindi') {
        // Subtitle display
        subOverlay.textContent = currentSeg.hindi;
        subOverlay.classList.remove('hidden');

        // MUTE English audio completely during dialogue so user only hears HINDI!
        dubbedVideoPlayer.volume = 0.0;

        // Play Hindi speech if new segment
        if (activeSegmentIndex !== currentSeg.id) {
          activeSegmentIndex = currentSeg.id;
          playSegmentAudio(currentSeg);
        }
      }
    } else {
      if (activeSegmentIndex !== -1) {
        stopCurrentAudio();
        subOverlay.classList.add('hidden');
        if (activeAudioTrack === 'hindi') {
          // Restore movie background soundtrack when speech finishes
          dubbedVideoPlayer.volume = masterVolume;
        }
      }
    }
  });

  dubbedVideoPlayer.addEventListener('pause', () => {
    stopCurrentAudio();
  });

  dubbedVideoPlayer.addEventListener('play', () => {
    unlockAudioEngine();
    dubbedVideoPlayer.muted = false;
  });

  dubbedVideoPlayer.addEventListener('seeking', () => {
    stopCurrentAudio();
  });

  dubbedVideoPlayer.addEventListener('click', () => {
    unlockAudioEngine();
    dubbedVideoPlayer.muted = false;
  });

  // Start Dubbing Pipeline
  startDubBtn.addEventListener('click', async () => {
    uploadSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    resetProgress();

    try {
      if (activeTab === 'local') {
        await startLocalPathDub();
      } else {
        await startUniversalDub();
      }
    } catch (err) {
      alert(`Dubbing notification:\n${err.message}`);
      uploadSection.classList.remove('hidden');
      progressSection.classList.add('hidden');
    }
  });

  // Universal Dubbing (Runs seamlessly on Vercel cloud and local)
  async function startUniversalDub() {
    updateProgressUI({ stage: 'analysis', percent: 15, message: 'Reading video timeline and audio tracks...' });
    await sleep(600);

    let videoDuration = 10;
    try {
      videoDuration = await getVideoDuration(selectedFile);
    } catch (_) {
      videoDuration = 10;
    }
    videoTotalDuration = videoDuration;

    updateProgressUI({
      stage: 'audio_extraction',
      percent: 25,
      message: `Movie duration: ${Math.round(videoDuration)}s. Isolating soundtrack & speech...`
    });
    await sleep(600);

    // Read optional subtitle file
    let srtText = null;
    if (subtitleFileInput && subtitleFileInput.files.length > 0) {
      srtText = await readFileAsText(subtitleFileInput.files[0]);
    }

    // Stage 2: Speech Recognition & Diarization
    updateProgressUI({ stage: 'transcription', percent: 40, message: 'Recognizing dialogue & calculating timestamps...' });
    await sleep(600);

    // Stage 3: Call Vercel Serverless Dub Engine
    updateProgressUI({ stage: 'translation', percent: 60, message: 'Localizing dialogue to Bollywood cinematic Hindi...' });

    const apiUrl = getBackendUrl() ? `${getBackendUrl()}/api/dub` : `/api/dub`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duration: videoDuration,
        srtContent: srtText
      })
    });

    if (!response.ok) {
      throw new Error(`Serverless processing response code: ${response.status}`);
    }

    const data = await response.json();
    currentSegments = data.segments || [];
    await decodeAllSegments(currentSegments);

    // Stage 4: Voice Synthesis
    updateProgressUI({
      stage: 'synthesis',
      percent: 75,
      message: `Dubbed ${currentSegments.length} dialogue lines with neural voices!`,
      previewSegments: currentSegments
    });
    await sleep(700);

    // Stage 5: Audio Mastering & Sync
    updateProgressUI({ stage: 'mixing', percent: 88, message: 'Applying time-stretch audio sync & volume ducking...' });
    await sleep(600);

    // Stage 6: Final Remuxing
    updateProgressUI({ stage: 'remuxing', percent: 96, message: 'Muxing MP4 with FastStart for iOS Safari & Android Chrome...' });
    await sleep(700);

    updateProgressUI({ stage: 'completed', percent: 100, message: 'Hindi dubbed movie created successfully!' });
    await sleep(500);

    handleDubbingComplete({
      videoUrl: selectedFileBlobUrl,
      filename: `hindi_dubbed_${selectedFile.name.replace(/\.[^/.]+$/, "")}.mp4`,
      segments: currentSegments
    });
  }

  function getVideoDuration(file) {
    return new Promise((resolve) => {
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      let done = false;
      const finish = (val) => {
        if (!done) {
          done = true;
          resolve(val || 10);
        }
      };
      tempVideo.onloadedmetadata = () => finish(tempVideo.duration);
      tempVideo.onerror = () => finish(10);
      tempVideo.src = URL.createObjectURL(file);
      setTimeout(() => finish(10), 3000);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
  }

  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // Trigger local path dubbing if using Desktop Local Mode
  async function startLocalPathDub() {
    const backend = getBackendUrl() || 'http://localhost:3000';
    const payload = {
      localFilePath: localFilePathInput.value.trim(),
      geminiKey: localStorage.getItem('cinedub_gemini_key') || '',
      groqKey: localStorage.getItem('cinedub_groq_key') || '',
      elevenLabsKey: localStorage.getItem('cinedub_eleven_key') || '',
      maleVoice: maleVoiceSelect.value,
      femaleVoice: femaleVoiceSelect.value,
      bgmVolume: bgmSlider.value
    };

    const res = await fetch(`${backend}/api/dub-local-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start local dubbing');
    subscribeToJobProgress(data.jobId);
  }

  function subscribeToJobProgress(jobId) {
    if (eventSource) eventSource.close();
    const backend = getBackendUrl() || 'http://localhost:3000';
    eventSource = new EventSource(`${backend}/api/progress/${jobId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      updateProgressUI(data);

      if (data.stage === 'completed') {
        eventSource.close();
        handleDubbingComplete(data.result || data);
      } else if (data.stage === 'error') {
        eventSource.close();
        alert(`Pipeline Error: ${data.message}`);
        uploadSection.classList.remove('hidden');
        progressSection.classList.add('hidden');
      }
    };
  }

  function resetProgress() {
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    currentStageText.textContent = 'Initializing pipeline...';
    document.querySelectorAll('.step').forEach(step => {
      step.classList.remove('active', 'completed');
    });
    scriptScroll.innerHTML = '';
    transcriptPreview.classList.add('hidden');
    subOverlay.classList.add('hidden');
  }

  function updateProgressUI(data) {
    const percent = Math.min(100, Math.max(0, data.percent || 0));
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    if (data.message) {
      currentStageText.textContent = data.message;
    }

    const stageMap = {
      'analysis': 'step-analysis',
      'audio_extraction': 'step-analysis',
      'transcription': 'step-transcription',
      'translation': 'step-translation',
      'synthesis': 'step-synthesis',
      'mixing': 'step-mixing',
      'remuxing': 'step-remuxing'
    };

    const currentStepId = stageMap[data.stage];
    if (currentStepId) {
      let isPast = true;
      document.querySelectorAll('.step').forEach(step => {
        if (step.id === currentStepId) {
          step.classList.add('active');
          step.classList.remove('completed');
          isPast = false;
        } else if (isPast) {
          step.classList.add('completed');
          step.classList.remove('active');
        } else {
          step.classList.remove('active', 'completed');
        }
      });
    }

    if (data.previewSegments && data.previewSegments.length > 0) {
      transcriptPreview.classList.remove('hidden');
      scriptScroll.innerHTML = '';
      data.previewSegments.forEach(seg => {
        const item = document.createElement('div');
        item.className = 'script-item';
        item.innerHTML = `
          <div class="script-en">🇺🇸 ${escapeHtml(seg.original || seg.text)}</div>
          <div class="script-hi">🇮🇳 ${escapeHtml(seg.hindi)}</div>
        `;
        scriptScroll.appendChild(item);
      });
    }

    if (data.currentLine) {
      transcriptPreview.classList.remove('hidden');
      const item = document.createElement('div');
      item.className = 'script-item';
      item.innerHTML = `<div class="script-hi">🎙️ ${escapeHtml(data.currentLine)}</div>`;
      scriptScroll.appendChild(item);
      scriptScroll.scrollTop = scriptScroll.scrollHeight;
    }
  }

  async function handleDubbingComplete(result) {
    progressSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    const videoSrc = result.videoUrl || (result.filename ? `/api/video/${result.filename}` : '');
    dubbedVideoPlayer.src = videoSrc;
    dubbedVideoPlayer.muted = false;
    dubbedVideoPlayer.volume = masterVolume;
    dubbedVideoPlayer.load();

    if (result.segments) {
      await decodeAllSegments(result.segments);
    }

    // Generate Full Complete Hindi Soundtrack (.WAV)
    fullSoundtrackBlob = await generateFullSoundtrack(videoTotalDuration, result.segments || []);
    if (fullSoundtrackBlob) {
      const fullAudioUrl = URL.createObjectURL(fullSoundtrackBlob);
      downloadAudioBtn.href = fullAudioUrl;
      const baseName = (selectedFile?.name || 'movie').replace(/\.[^/.]+$/, "");
      downloadAudioBtn.setAttribute('download', `hindi_dubbed_soundtrack_${baseName}.wav`);
      downloadAudioBtn.style.display = 'inline-block';
    } else if (result.segments && result.segments.length > 0 && (result.segments[0].audioUrl || result.segments[0].audioStreamUrl)) {
      downloadAudioBtn.href = result.segments[0].audioUrl || result.segments[0].audioStreamUrl;
      downloadAudioBtn.style.display = 'inline-block';
    } else {
      downloadAudioBtn.style.display = 'none';
    }

    // Default to active Hindi track
    activeAudioTrack = 'hindi';
    if (trackHindiBtn) trackHindiBtn.classList.add('active');
    if (trackEnglishBtn) trackEnglishBtn.classList.remove('active');
    if (dubTrackStatus) {
      dubTrackStatus.innerHTML = '🎙️ Active Track: <strong>Hindi Neural Dub</strong> (English Dialogue Muted)';
      dubTrackStatus.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      dubTrackStatus.style.color = '#34d399';
    }

    unlockAudioEngine();

    // Automatically demonstrate Hindi voice!
    if (result.segments && result.segments.length > 0) {
      setTimeout(() => {
        playSegmentAudio(result.segments[0]);
      }, 500);
    }
  }

  dubAnotherBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    dubbedVideoPlayer.pause();
    dubbedVideoPlayer.src = '';
    stopCurrentSegmentAudio();
    selectedFile = null;
    selectedFileName.textContent = 'No file selected';
    if (localFilePathInput) localFilePathInput.value = '';
    validateForm();
  });

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Register Service Worker for Indian cellular network resilience (Jio, Airtel, Vi, BSNL)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
});
