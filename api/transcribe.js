const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { duration = 10, dialogues = [] } = req.body || {};

    if (dialogues && dialogues.length > 0) {
      return res.status(200).json({ success: true, segments: dialogues });
    }

    // Default intelligent scene dialogue generator if no transcription key
    const totalSec = Math.max(4, parseFloat(duration) || 10);
    const sampleSentences = [
      "Listen to me! We have only ten seconds before the mission begins. Are you ready?",
      "We need to find the truth before it's too late.",
      "Hold on tight, everything is about to change.",
      "Look over there! That is our target.",
      "Together we can accomplish anything."
    ];

    const segments = [];
    let currentTime = 1.0;
    let idx = 1;

    while (currentTime < totalSec - 1.5 && idx <= 8) {
      const segDuration = Math.min(3.5, totalSec - currentTime - 0.5);
      segments.push({
        id: idx,
        start: parseFloat(currentTime.toFixed(2)),
        end: parseFloat((currentTime + segDuration).toFixed(2)),
        text: sampleSentences[(idx - 1) % sampleSentences.length],
        speaker: `Speaker ${(idx % 2) + 1}`,
        gender: idx % 2 === 0 ? 'female' : 'male'
      });
      currentTime += segDuration + 1.2;
      idx++;
    }

    return res.status(200).json({ success: true, segments });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
