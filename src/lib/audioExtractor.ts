/**
 * Client-side audio extraction and optimization utility.
 * Decodes video audio tracks client-side using Web Audio API and encodes
 * a lightweight 16kHz mono WAV file for Whisper transcription.
 * Reduces upload payload by 90-98%, avoiding network timeouts and connection drops.
 */

export async function extractAudioFromVideoFile(file: File): Promise<Blob | null> {
  if (typeof window === 'undefined') return null;

  // If already an audio file or very small (< 2MB), upload directly
  if (file.type.startsWith('audio/') || file.size < 2 * 1024 * 1024) {
    return null;
  }

  // Safety check: AudioContext support
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const tempCtx = new AudioContextClass();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    tempCtx.close().catch(() => {});

    // Target sample rate for Whisper is 16,000Hz mono
    const targetSampleRate = 16000;
    const duration = audioBuffer.duration;
    const numFrames = Math.ceil(duration * targetSampleRate);

    // If audio is empty or invalid
    if (numFrames <= 0 || duration <= 0) return null;

    const offlineCtx = new OfflineAudioContext(1, numFrames, targetSampleRate);
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

