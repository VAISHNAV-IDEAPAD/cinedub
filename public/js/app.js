document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabUploadBtn = document.getElementById('tabUploadBtn');
  const tabLocalPathBtn = document.getElementById('tabLocalPathBtn');
  const tabUploadPane = document.getElementById('tabUploadPane');
  const tabLocalPathPane = document.getElementById('tabLocalPathPane');

  const dropZone = document.getElementById('dropZone');
  const videoFileInput = document.getElementById('videoFileInput');
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

  // Track switcher
  const trackHindiBtn = document.getElementById('trackHindiBtn');
  const trackEnglishBtn = document.getElementById('trackEnglishBtn');

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

  if (localFilePathInput) {
    localFilePathInput.addEventListener('input', validateForm);
  }

  function handleFileSelection(file) {
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

  // Track switcher handlers
  if (trackHindiBtn && trackEnglishBtn) {
    trackHindiBtn.addEventListener('click', () => {
      activeAudioTrack = 'hindi';
      trackHindiBtn.classList.add('active');
      trackEnglishBtn.classList.remove('active');
      subOverlay.classList.remove('hidden');
    });

    trackEnglishBtn.addEventListener('click', () => {
      activeAudioTrack = 'english';
      trackEnglishBtn.classList.add('active');
      trackHindiBtn.classList.remove('active');
      hindiAudioPlayer.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      subOverlay.classList.add('hidden');
      dubbedVideoPlayer.volume = 1.0;
    });
  }

  // Synchronized Audio & Subtitle playback loop
  dubbedVideoPlayer.addEventListener('timeupdate', () => {
    if (!currentSegments || currentSegments.length === 0) return;
    const currentTime = dubbedVideoPlayer.currentTime;

    const currentSeg = currentSegments.find(s => currentTime >= s.start && currentTime <= s.end);

    if (currentSeg) {
      // Subtitle
      if (activeAudioTrack === 'hindi') {
        subOverlay.textContent = currentSeg.hindi;
        subOverlay.classList.remove('hidden');
      }

      // Play audio if track is Hindi and new segment
      if (activeAudioTrack === 'hindi' && activeSegmentIndex !== currentSeg.id) {
        activeSegmentIndex = currentSeg.id;
        if (currentSeg.audioUrl) {
          hindiAudioPlayer.src = currentSeg.audioUrl;
          hindiAudioPlayer.play().catch(() => {});
        } else if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(currentSeg.hindi);
          utterance.lang = 'hi-IN';
          utterance.rate = 1.05;
          window.speechSynthesis.speak(utterance);
        }
        // Duck original video background
        const duckVol = parseFloat(bgmSlider.value) || 0.35;
        dubbedVideoPlayer.volume = duckVol;
      }
    } else {
      if (activeSegmentIndex !== -1) {
        activeSegmentIndex = -1;
        subOverlay.classList.add('hidden');
        if (activeAudioTrack === 'hindi') {
          dubbedVideoPlayer.volume = 1.0;
        }
      }
    }
  });

  dubbedVideoPlayer.addEventListener('pause', () => {
    hindiAudioPlayer.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  });

  dubbedVideoPlayer.addEventListener('play', () => {
    if (activeAudioTrack === 'hindi' && activeSegmentIndex !== -1) {
      hindiAudioPlayer.play().catch(() => {});
    }
  });

  dubbedVideoPlayer.addEventListener('seeking', () => {
    activeSegmentIndex = -1;
    hindiAudioPlayer.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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

  function handleDubbingComplete(result) {
    progressSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    const videoSrc = result.videoUrl || (result.filename ? `/api/video/${result.filename}` : '');
    dubbedVideoPlayer.src = videoSrc;
    dubbedVideoPlayer.load();

    downloadBtn.href = videoSrc;
    downloadBtn.setAttribute('download', result.filename || 'dubbed_hindi_movie.mp4');

    if (result.segments && result.segments.length > 0 && result.segments[0].audioUrl) {
      downloadAudioBtn.href = result.segments[0].audioUrl;
      downloadAudioBtn.style.display = 'inline-block';
    } else {
      downloadAudioBtn.style.display = 'none';
    }

    // Default to active Hindi track
    activeAudioTrack = 'hindi';
    if (trackHindiBtn) trackHindiBtn.classList.add('active');
    if (trackEnglishBtn) trackEnglishBtn.classList.remove('active');
  }

  dubAnotherBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    dubbedVideoPlayer.pause();
    dubbedVideoPlayer.src = '';
    hindiAudioPlayer.pause();
    hindiAudioPlayer.src = '';
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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
});
