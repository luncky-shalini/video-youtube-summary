const fs = require('fs');
const path = require('path');
const { OpenAI, toFile } = require('openai');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
let apiKey = '';
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('GROQ_API_KEY=')) {
    apiKey = trimmed.slice('GROQ_API_KEY='.length).replace(/^['"]|['"]$/g, '');
  }
}

async function testLargeUpload() {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  // Create a 5MB buffer simulating a real video or audio file
  // Let's create a 5MB WAV file with 2.5 minutes of audio
  const sampleRate = 16000;
  const numSamples = sampleRate * 150; // 150 seconds = 2.5 minutes
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  console.log(`Buffer created: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

  const file = await toFile(buffer, 'video_audio.mp4', { type: 'video/mp4' });

  const t0 = Date.now();
  try {
    console.log('Sending 5MB file to Groq whisper-large-v3-turbo...');
    const result = await client.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      response_format: 'verbose_json',
    });
    console.log('Success in', Date.now() - t0, 'ms. Result text length:', result.text?.length);
  } catch (err) {
    console.error('Failed in', Date.now() - t0, 'ms:');
    console.error('Error message:', err.message);
    console.error('Error name:', err.name);
    console.error('Error code:', err.code);
    console.error('Error cause:', err.cause);
    console.error('Error status:', err.status);
  }
}

testLargeUpload();

