const fs = require('fs');
const path = require('path');
const dns = require('dns');

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
let apiKey = '';
let openaiKey = '';
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('GROQ_API_KEY=')) {
    apiKey = trimmed.slice('GROQ_API_KEY='.length).replace(/^['"]|['"]$/g, '');
  }
  if (trimmed.startsWith('OPENAI_API_KEY=')) {
    openaiKey = trimmed.slice('OPENAI_API_KEY='.length).replace(/^['"]|['"]$/g, '');
  }
}

console.log('GROQ_API_KEY present:', Boolean(apiKey));
console.log('OPENAI_API_KEY present:', Boolean(openaiKey));

const { OpenAI, toFile } = require('openai');

async function test() {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  try {
    const models = await client.models.list();
    const whisper = models.data.filter(m => m.id.includes('whisper'));
    console.log('Whisper models available on Groq:', whisper.map(m => m.id));
  } catch (err) {
    console.error('List models error:', err);
  }

  // Create a minimal 1-second silent WAV file (44-byte RIFF header + 1 second of silence at 8kHz 16-bit mono = 16044 bytes)
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

  const file = await toFile(buffer, 'test.wav', { type: 'audio/wav' });

  try {
    console.log('Testing whisper-large-v3-turbo transcription on Groq...');
    const result = await client.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      response_format: 'verbose_json',
    });
    console.log('Transcription success! Result:', result);
  } catch (err) {
    console.error('Transcription error details:');
    console.error('Error message:', err.message);
    console.error('Error cause:', err.cause);
    console.error('Error status:', err.status);
    console.error('Full error:', err);
  }
}

test();

