/**
 * Conversão de áudio gravado (webm/mp4/ogg, dependendo do browser) para WAV
 * PCM 16-bit mono 16kHz — formato universalmente aceito pela Files API do
 * Gemini e ideal para reconhecimento de fala (menor tamanho).
 *
 * Estratégia: grava com MediaRecorder (cross-browser) e converte no cliente
 * após o stop, decodificando com AudioContext e reamostrando via
 * OfflineAudioContext.
 */

const TARGET_SAMPLE_RATE = 16000;

/**
 * Escolhe um mimeType de gravação suportado pelo browser atual.
 * Chrome/Firefox: webm/ogg opus. Safari: mp4/aac. O resultado é convertido
 * para WAV no cliente, então qualquer container serve.
 */
export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined; // deixa o browser escolher o default
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export async function blobToWav(blob: Blob, targetSampleRate = TARGET_SAMPLE_RATE): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();

  const AudioCtx: typeof AudioContext =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).AudioContext || (window as any).webkitAudioContext;

  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    decodeCtx.close();
  }

  // Reamostra para mono + 16kHz
  const length = Math.ceil(decoded.duration * targetSampleRate);
  const offline = new OfflineAudioContext(1, Math.max(length, 1), targetSampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();

  const wavBuffer = encodeWav(rendered.getChannelData(0), targetSampleRate);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}
