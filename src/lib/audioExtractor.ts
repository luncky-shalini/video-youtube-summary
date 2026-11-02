/**
 * Client-side audio extraction and chunking optimization utility.
 * Decodes video audio tracks client-side using Web Audio API and encodes
 * lightweight 12kHz mono WAV chunks for Whisper transcription.
 *
 * Guarantees every upload request payload is strictly <= 2.5MB, safely beneath
 * Vercel Serverless Function's 4.5MB request body limit (HTTP 413 Function Payload Too Large).
 * Enables seamless transcription of videos of ANY duration (2 mins, 5 mins, 15+ mins).
 */

export interface AudioChunk {
  blob: Blob;
  startOffset: number;
  duration: number;
  chunkIndex: number;
  totalChunks: number;
}

const TARGET_SAMPLE_RATE = 12000; // 12kHz mono = 24,000 bytes/sec PCM. Pristine voice clarity for Whisper.
const CHUNK_DURATION_SECONDS = 80; // 80s * 24,000 B/s = ~1.92 MB per chunk (well below Vercel's 4.5MB limit)

/**
 * Extracts and chunks audio from a video file into <= 2.5MB segments.
 * Returns an array of AudioChunks with start offsets.
 */
export async function extractAudioChunksFromVideo(
  file: File,
  onProgress?: (msg: string) => void
): Promise<AudioChunk[] | null> {
  if (typeof window === 'undefined') return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  try {
    onProgress?.('Decoding audio from video...');
    const arrayBuffer = await file.arrayBuffer();
    const tempCtx = new AudioContextClass();

    // Pass arrayBuffer slice so original buffer is not detached
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
    tempCtx.close().catch(() => { });

    const duration = audioBuffer.duration;
    if (!duration || duration <= 0) return null;

    const totalChunks = Math.max(1, Math.ceil(duration / CHUNK_DURATION_SECONDS));
    const chunks: AudioChunk[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const startSec = i * CHUNK_DURATION_SECONDS;
      const endSec = Math.min((i + 1) * CHUNK_DURATION_SECONDS, duration);
      const chunkDur = endSec - startSec;
      if (chunkDur <= 0.2) continue;

      const numFrames = Math.ceil(chunkDur * TARGET_SAMPLE_RATE);
      const offlineCtx = new OfflineAudioContext(1, numFrames, TARGET_SAMPLE_RATE);

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      // Start buffer playback with negative offset relative to chunk start
      source.start(0, startSec, chunkDur);

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWavBlob(renderedBuffer);

      chunks.push({
        blob: wavBlob,
        startOffset: Math.round(startSec * 10) / 10,
        duration: Math.round(chunkDur * 10) / 10,
        chunkIndex: i,
        totalChunks,
      });
    }

    return chunks.length > 0 ? chunks : null;
  } catch (err) {
    console.warn('Client-side audio extraction notice:', err);
    return null;
  }
}

/**
 * Single-chunk audio extractor (backward compatibility).
 * Downsamples to 12kHz mono WAV to guarantee <= 3.5MB for videos up to 2.5 minutes.
 */
export async function extractAudioFromVideoFile(file: File): Promise<Blob | null> {
  if (typeof window === 'undefined') return null;

  // If already an audio file and <= 3MB, upload directly
  if (file.type.startsWith('audio/') && file.size < 3.5 * 1024 * 1024) {
    return null;
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const tempCtx = new AudioContextClass();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
    tempCtx.close().catch(() => { });

    const duration = audioBuffer.duration;
    if (!duration || duration <= 0) return null;

    const numFrames = Math.ceil(duration * TARGET_SAMPLE_RATE);
    const offlineCtx = new OfflineAudioContext(1, numFrames, TARGET_SAMPLE_RATE);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    return audioBufferToWavBlob(rendered);
  } catch (err) {
    console.warn('Client-side audio extraction skipped (using direct file upload):', err);
    return null;
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const channelData = buffer.getChannelData(0);
  const dataLength = channelData.length * (bitDepth / 8);
  const bufferLength = 44 + dataLength;

  const arrayBuf = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuf);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Convert float32 [-1.0, 1.0] to int16 PCM
  let offset = 44;
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([arrayBuf], { type: 'audio/wav' });
}
