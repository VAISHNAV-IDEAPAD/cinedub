require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Allow Edge TTS network handshake on local machine

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const qrcode = require('qrcode-terminal');
const { runDubbingPipeline } = require('./services/dubbingPipeline');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, 'public')));

// Ensure upload & output directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');
const TEMP_DIR = path.join(__dirname, 'temp');

[UPLOADS_DIR, OUTPUT_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure Multer for video uploads (up to 5GB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_\.-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB limit
});

// In-memory job state & SSE subscriber management
const activeJobs = new Map();

function broadcastProgress(jobId, data) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.lastUpdate = data;
    if (job.subscribers) {
      job.subscribers.forEach(res => {
        try {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (_) {}
      });
    }
  }
}

/**
 * Endpoint: Stream real-time progress using Server-Sent Events (SSE)
 */
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  if (!activeJobs.has(jobId)) {
    activeJobs.set(jobId, { subscribers: [], lastUpdate: { stage: 'init', percent: 0, message: 'Initializing job...' } });
  }

  const job = activeJobs.get(jobId);
  job.subscribers.push(res);

  // Send current state immediately
  res.write(`data: ${JSON.stringify(job.lastUpdate)}\n\n`);

  req.on('close', () => {
    job.subscribers = job.subscribers.filter(client => client !== res);
  });
});

/**
 * Endpoint: Start dubbing from uploaded video
 */
app.post('/api/upload-and-dub', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'subtitle', maxCount: 1 }
]), async (req, res) => {
  try {
    const videoFile = req.files?.['video']?.[0];
    if (!videoFile) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const subtitleFile = req.files?.['subtitle']?.[0];
    const uploadedSrtContent = subtitleFile ? fs.readFileSync(subtitleFile.path, 'utf8') : null;

    const jobId = `job_${Date.now()}`;
    const options = {
      groqKey: req.body.groqKey || process.env.GROQ_API_KEY,
      geminiKey: req.body.geminiKey || process.env.GEMINI_API_KEY,
      openaiKey: req.body.openaiKey || process.env.OPENAI_API_KEY,
      elevenLabsKey: req.body.elevenLabsKey || process.env.ELEVENLABS_API_KEY,
      maleVoice: req.body.maleVoice || 'hi-IN-MadhurNeural',
      femaleVoice: req.body.femaleVoice || 'hi-IN-SwaraNeural',
      bgmVolume: parseFloat(req.body.bgmVolume || '0.35'),
      dialogueVolume: parseFloat(req.body.dialogueVolume || '1.1'),
      uploadedSrtContent
    };

    activeJobs.set(jobId, {
      subscribers: [],
      lastUpdate: { stage: 'queued', percent: 0, message: 'Movie received. Starting dubbing pipeline...' }
    });

    // Send back jobId so client can stream progress immediately
    res.json({ jobId, message: 'Dubbing pipeline started' });

    // Run pipeline asynchronously in background
    runDubbingPipeline(videoFile.path, OUTPUT_DIR, options, (update) => {
      broadcastProgress(jobId, update);
    }).then(result => {
      broadcastProgress(jobId, {
        stage: 'completed',
        percent: 100,
        message: 'Conversion completed successfully!',
        result
      });
    }).catch(err => {
      broadcastProgress(jobId, {
        stage: 'error',
        percent: 0,
        message: err.message
      });
    });

  } catch (error) {
    console.error('Upload handler error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: Dub a movie already located on local drive (convenience for laptop users)
 */
app.post('/api/dub-local-file', async (req, res) => {
  try {
    const { localFilePath } = req.body;
    if (!localFilePath || !fs.existsSync(localFilePath)) {
      return res.status(400).json({ error: 'Local file path does not exist on disk' });
    }

    const jobId = `job_${Date.now()}`;
    const options = {
      groqKey: req.body.groqKey || process.env.GROQ_API_KEY,
      geminiKey: req.body.geminiKey || process.env.GEMINI_API_KEY,
      openaiKey: req.body.openaiKey || process.env.OPENAI_API_KEY,
      elevenLabsKey: req.body.elevenLabsKey || process.env.ELEVENLABS_API_KEY,
      maleVoice: req.body.maleVoice || 'hi-IN-MadhurNeural',
      femaleVoice: req.body.femaleVoice || 'hi-IN-SwaraNeural',
      bgmVolume: parseFloat(req.body.bgmVolume || '0.35'),
      dialogueVolume: parseFloat(req.body.dialogueVolume || '1.1')
    };

    activeJobs.set(jobId, {
      subscribers: [],
      lastUpdate: { stage: 'queued', percent: 0, message: 'Local movie selected. Starting dubbing pipeline...' }
    });

    res.json({ jobId, message: 'Dubbing pipeline started' });

    runDubbingPipeline(localFilePath, OUTPUT_DIR, options, (update) => {
      broadcastProgress(jobId, update);
    }).then(result => {
      broadcastProgress(jobId, {
        stage: 'completed',
        percent: 100,
        message: 'Conversion completed successfully!',
        result
      });
    }).catch(err => {
      broadcastProgress(jobId, {
        stage: 'error',
        percent: 0,
        message: err.message
      });
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: Stream video with HTTP Range Support
 * Strictly necessary for iOS Safari and Android Chrome HTML5 video players
 */
app.get('/api/video/:filename', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Video not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes'
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

/**
 * Endpoint: Direct Video Download
 */
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Video not found');
  }
  res.download(filePath, req.params.filename);
});

/**
 * Endpoint: Get Network IP for Mobile Connection
 */
app.get('/api/network-info', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  let localIp = 'localhost';

  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.')) {
        localIp = net.address;
        break;
      }
    }
    if (localIp !== 'localhost') break;
  }

  res.json({
    localIp,
    port: PORT,
    mobileUrl: `http://${localIp}:${PORT}`
  });
});

// Helper to find local IPv4
function getLocalIp() {
  const networkInterfaces = os.networkInterfaces();
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.')) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();

app.listen(PORT, HOST, () => {
  console.log('===========================================================');
  console.log('   🎬 AI HOLLYWOOD TO HINDI MOVIE DUBBER IS ONLINE! 🎬    ');
  console.log('===========================================================');
  console.log(`💻 Desktop Access:       http://localhost:${PORT}`);
  console.log(`📱 Mobile Web (iOS/Android): http://${localIp}:${PORT}`);
  console.log('-----------------------------------------------------------');
  console.log('📱 Scan this QR code with your iPhone or Android camera:');
  try {
    qrcode.generate(`http://${localIp}:${PORT}`, { small: true });
  } catch (_) {}
  console.log('===========================================================');
});
