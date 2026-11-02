const fs = require('fs');

async function testTranscribeRoute() {
  // Create a 1-sec WAV buffer
  const sampleRate = 8000;
  const numSamples = sampleRate * 1;
  const byteRate = sampleRate * 2;
  const blockAlign = 2;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const form = new FormData();
  form.append('file', blob, 'sample.wav');

  console.log('Sending sample.wav to http://localhost:3000/api/subtitles/transcribe ...');
  try {
    const res = await fetch('http://localhost:3000/api/subtitles/transcribe', {
      method: 'POST',
      body: form,
    });
    console.log('Status:', res.status, res.statusText);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testTranscribeRoute();

