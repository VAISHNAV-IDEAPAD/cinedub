# 🎬 CineDub AI — Hollywood to Hindi Movie Dubbing Studio

An end-to-end AI movie dubbing application that converts English Hollywood movies and clips into natural Hindi dubbed movies, engineered to work seamlessly on **any iPhone (iOS Safari), Android mobile browser (Chrome), and desktop browser**.

---

## 🌟 Key Features

1. **Upload or Local File Access**:
   - **Mobile**: Tap and upload directly from iPhone Camera Roll, Android Downloads, or Files app.
   - **Desktop**: Drag & drop or enter a direct local drive path (e.g. `C:\Movies\Avengers.mp4`) with zero upload wait time.
2. **Preserves Original Background Music & Sound Effects**:
   - Isolates the stereo background track and applies **intelligent audio ducking** (lowers BGM during dialogue and restores volume during action sequences).
3. **Bollywood Cinematic Hindi Localization**:
   - Translates dialogues with colloquial Hindi nuance and character emotion, not literal textbook translation.
   - Syllable and duration matching for natural speech timing.
4. **Natural Neural Voice Dubbing**:
   - Powered by Microsoft Neural TTS (`hi-IN-MadhurNeural` for male characters, `hi-IN-SwaraNeural` for female characters).
   - Zero-cost out of the box; optional ElevenLabs support for voice cloning.
5. **Universal Mobile Playback (iOS Safari & Android Chrome)**:
   - Output encoded strictly to **H.264 (Constrained Baseline/High) + AAC-LC audio in MP4**.
   - Encoded with `-movflags +faststart` (moov atom placed at file header) so videos stream immediately on mobile without downloading the full gigabyte movie first.
   - HTML5 video player configured with `playsinline` and `webkit-playsinline` to prevent disruptive iOS native fullscreen takeovers.
6. **Mobile Wi-Fi QR Code Integration**:
   - Generates a QR code in the console and web interface. Point your phone camera at the screen to open the app on your phone immediately.

---

## 🚀 Quick Start

### 1. Start the Server
Double-click `start.bat` or run:
```bash
npm start
```

### 2. Open the Studio
- **On your Computer**: Open [http://localhost:3000](http://localhost:3000)
- **On your Android / iPhone**: Connect to the same Wi-Fi network and open `http://<YOUR_LOCAL_IP>:3000` (or scan the QR code printed in the terminal).

### 3. Dub a Movie
1. Select an English video file (or test with `sample_english_scene.mp4`).
2. (Optional) Provide an `.srt` subtitle file or enter cloud API keys in the Settings drawer.
3. Click **"Convert into Hindi Dubbed Movie"**.
4. Watch the 6-stage real-time progress and live script translation.
5. Stream the dubbed movie directly in your browser or tap **Download**.

---

## 🏗️ 6-Stage AI Dubbing Pipeline

```
[Input Movie]
      │
      ▼
1. Audio Demuxing ──► Extracts mono WAV for speech recognition + isolates BGM track
      │
      ▼
2. Diarization & ASR ──► Transcribes dialogue with millisecond word timestamps
      │
      ▼
3. Cinematic Translation ──► Translates English to natural Hindi matching duration
      │
      ▼
4. Neural Voice Dubbing ──► Synthesizes Hindi character speech (Madhur / Swara)
      │
      ▼
5. Time-Stretch & Sync ──► Matches speech tempo to original line durations
      │
      ▼
6. Mobile MP4 Remuxing ──► Mixes with ducked BGM and encodes H.264/AAC with +faststart
      │
      ▼
[Final Hindi Dubbed MP4]
```

---

## 🔑 Optional Cloud API Keys

The app works **100% out of the box with zero paid API keys**. To upgrade to cloud-scale speeds for full-length 2-hour movies, you can enter API keys in the settings drawer:

- **Google Gemini API**: Contextual Bollywood dialogue localization.
- **Groq Whisper API**: Transcribes an hour of movie audio in under 20 seconds.
- **ElevenLabs API**: Multilingual actor voice cloning.
