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
  const dubAnotherBtn = document.getElementById('dubAnotherBtn');

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
  let eventSource = null;

  // Load saved settings from LocalStorage
  function loadSettings() {
    geminiKeyInput.value = localStorage.getItem('cinedub_gemini_key') || '';
    groqKeyInput.value = localStorage.getItem('cinedub_groq_key') || '';
    elevenLabsKeyInput.value = localStorage.getItem('cinedub_eleven_key') || '';
    maleVoiceSelect.value = localStorage.getItem('cinedub_male_voice') || 'hi-IN-MadhurNeural';
    femaleVoiceSelect.value = localStorage.getItem('cinedub_female_voice') || 'hi-IN-SwaraNeural';
    const savedBgm = localStorage.getItem('cinedub_bgm_vol') || '0.35';
    bgmSlider.value = savedBgm;
    bgmVolDisplay.textContent = `${Math.round(savedBgm * 100)}%`;
  }
  loadSettings();

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
  subAccordionToggle.addEventListener('click', () => {
    subAccordionContent.classList.toggle('open');
  });

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

  localFilePathInput.addEventListener('input', validateForm);

  function handleFileSelection(file) {
    selectedFile = file;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    selectedFileName.textContent = `🎬 ${file.name} (${sizeMb} MB)`;
    validateForm();
  }

  function validateForm() {
    if (activeTab === 'upload') {
      startDubBtn.disabled = !selectedFile;
    } else {
      startDubBtn.disabled = !localFilePathInput.value.trim();
    }
  }

  // Settings Handlers
  settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
  bgmSlider.addEventListener('input', (e) => {
    bgmVolDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
  });

  saveSettingsBtn.addEventListener('click', () => {
    localStorage.setItem('cinedub_gemini_key', geminiKeyInput.value.trim());
    localStorage.setItem('cinedub_groq_key', groqKeyInput.value.trim());
    localStorage.setItem('cinedub_eleven_key', elevenLabsKeyInput.value.trim());
    localStorage.setItem('cinedub_male_voice', maleVoiceSelect.value);
    localStorage.setItem('cinedub_female_voice', femaleVoiceSelect.value);
    localStorage.setItem('cinedub_bgm_vol', bgmSlider.value);
    settingsModal.classList.add('hidden');
  });

  // QR Modal Handlers
  qrBtn.addEventListener('click', async () => {
    qrModal.classList.remove('hidden');
    try {
      const res = await fetch('/api/network-info');
      const data = await res.json();
      mobileUrlDisplay.textContent = data.mobileUrl;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.mobileUrl)}`;
      qrCodeImgWrapper.innerHTML = `<img src="${qrApiUrl}" alt="Scan on Mobile" width="180" height="180">`;
    } catch (_) {
      mobileUrlDisplay.textContent = window.location.href;
    }
  });

  closeQrBtn.addEventListener('click', () => qrModal.classList.add('hidden'));

  copyUrlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(mobileUrlDisplay.textContent);
    copyUrlBtn.textContent = 'Copied to Clipboard!';
    setTimeout(() => { copyUrlBtn.textContent = 'Copy Mobile URL'; }, 2000);
  });

  // Start Dubbing Pipeline
  startDubBtn.addEventListener('click', async () => {
    uploadSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    resetProgress();

    try {
      if (activeTab === 'upload') {
        await startUploadAndDub();
      } else {
        await startLocalPathDub();
      }
    } catch (err) {
      alert(`Dubbing failed to start: ${err.message}`);
      uploadSection.classList.remove('hidden');
      progressSection.classList.add('hidden');
    }
  });

  // Trigger file upload with XMLHttpRequest for upload progress
  function startUploadAndDub() {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('video', selectedFile);
      if (subtitleFileInput.files.length > 0) {
        formData.append('subtitle', subtitleFileInput.files[0]);
      }

      // Append settings
      formData.append('geminiKey', localStorage.getItem('cinedub_gemini_key') || '');
      formData.append('groqKey', localStorage.getItem('cinedub_groq_key') || '');
      formData.append('elevenLabsKey', localStorage.getItem('cinedub_eleven_key') || '');
      formData.append('maleVoice', maleVoiceSelect.value);
      formData.append('femaleVoice', femaleVoiceSelect.value);
      formData.append('bgmVolume', bgmSlider.value);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload-and-dub', true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const uploadPercent = Math.round((e.loaded / e.total) * 100);
          currentStageText.textContent = `Uploading movie (${uploadPercent}%)...`;
          progressBar.style.width = `${Math.round(uploadPercent * 0.1)}%`; // First 10% for upload
          progressPercent.textContent = `${Math.round(uploadPercent * 0.1)}%`;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const resp = JSON.parse(xhr.responseText);
          subscribeToJobProgress(resp.jobId);
          resolve();
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  }

  // Trigger local path dubbing
  async function startLocalPathDub() {
    const payload = {
      localFilePath: localFilePathInput.value.trim(),
      geminiKey: localStorage.getItem('cinedub_gemini_key') || '',
      groqKey: localStorage.getItem('cinedub_groq_key') || '',
      elevenLabsKey: localStorage.getItem('cinedub_eleven_key') || '',
      maleVoice: maleVoiceSelect.value,
      femaleVoice: femaleVoiceSelect.value,
      bgmVolume: bgmSlider.value
    };

    const res = await fetch('/api/dub-local-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start local dubbing');
    subscribeToJobProgress(data.jobId);
  }

  // Subscribe to SSE updates
  function subscribeToJobProgress(jobId) {
    if (eventSource) eventSource.close();
    eventSource = new EventSource(`/api/progress/${jobId}`);

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

    eventSource.onerror = () => {
      // EventSource reconnects automatically
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
  }

  function updateProgressUI(data) {
    const percent = Math.min(100, Math.max(0, data.percent || 0));
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    if (data.message) {
      currentStageText.textContent = data.message;
    }

    // Step state updating
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

    // Live preview of translated script
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
    setTimeout(() => {
      progressSection.classList.add('hidden');
      resultSection.classList.remove('hidden');

      const videoFilename = result.filename || result.outputFilename;
      const streamUrl = `/api/video/${videoFilename}`;
      const downloadUrl = `/api/download/${videoFilename}`;

      dubbedVideoPlayer.src = streamUrl;
      dubbedVideoPlayer.load();

      downloadBtn.href = downloadUrl;
      downloadBtn.setAttribute('download', videoFilename);
    }, 1000);
  }

  dubAnotherBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    dubbedVideoPlayer.pause();
    dubbedVideoPlayer.src = '';
    selectedFile = null;
    selectedFileName.textContent = 'No file selected';
    localFilePathInput.value = '';
    validateForm();
  });

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
