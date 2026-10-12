import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { paintCompositeFrame } from './compositeFrame';
import type { FrameOverlay, VisionConfig } from '../vision/types';
import { exportFrameSize } from '../vision/videoGeometry';

export const EXPORT_FPS = 30;
/** Used only when the browser has not reported a duration yet. */
const FALLBACK_EXPORT_SEC = 5;

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelled';
  }
}

export interface RecordedClip {
  blob: Blob;
  extension: string;
  mimeType: string;
  pro: boolean;
}

interface RecordClipOptions {
  video: HTMLVideoElement;
  getConfig: () => VisionConfig;
  getLayerActive: () => boolean;
  readOverlay: () => FrameOverlay | null;
  captureOverlay: () => void;
  silent: boolean;
  startTime: number;
  previewWidth: number;
  previewHeight: number;
  isCancelled: () => boolean;
  onProgress: (progress: number) => void;
}

function assertActive(isCancelled: () => boolean) {
  if (isCancelled()) throw new ExportCancelled();
}

function clipWindow(video: HTMLVideoElement, startTime: number) {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  let start = Math.max(0, startTime);
  if (duration > 0.5 && duration - start < 0.35) start = 0;
  const seconds = duration > 0
    ? Math.max(0.35, duration - start)
    : FALLBACK_EXPORT_SEC;
  return { start, seconds };
}

function seekTo(video: HTMLVideoElement, time: number) {
  const duration = Number.isFinite(video.duration) ? video.duration : time + 1;
  const target = Math.max(0, Math.min(time, Math.max(0, duration - 0.001)));
  if (Math.abs(video.currentTime - target) < 0.02) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 2000);
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Could not seek the clip.'));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = target;
  });
}

function exportFormat() {
  const candidates = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ];
  return candidates.find(({ mimeType }) => MediaRecorder.isTypeSupported(mimeType));
}

async function supportedAvc(width: number, height: number, bitrate: number, framerate: number) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoEncoder.isConfigSupported !== 'function') return null;
  const codecs = ['avc1.640032', 'avc1.640028', 'avc1.4d0028', 'avc1.42E01F'];
  for (const codec of codecs) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate,
      avc: { format: 'avc' },
      latencyMode: 'quality',
    };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return support.config ?? config;
    } catch {
      /* This codec string is not usable here. */
    }
  }
  return null;
}

async function encodePro(options: RecordClipOptions, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, overlayCanvas: HTMLCanvasElement) {
  const { video, silent, previewWidth, previewHeight, isCancelled, onProgress, captureOverlay, readOverlay, getConfig, getLayerActive } = options;
  const { start, seconds } = clipWindow(video, options.startTime);
  const frames = Math.max(1, Math.round(seconds * EXPORT_FPS));
  const config = getConfig();
  const bitrate = Math.round(Math.max(4, Math.min(24, config.exportBitrate)) * 1_000_000);
  const encoderConfig = await supportedAvc(canvas.width, canvas.height, bitrate, EXPORT_FPS);
  if (!encoderConfig || typeof VideoFrame === 'undefined') {
    throw new Error('H.264 export is not available in this browser.');
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: canvas.width, height: canvas.height, frameRate: EXPORT_FPS },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error('H.264 encoder failed.');
    },
  });
  encoder.configure(encoderConfig);

  try {
    video.pause();
    await seekTo(video, start);
    await video.play().catch(() => undefined);
    let encoded = 0;
    const end = start + seconds;
    const lead = 2 / EXPORT_FPS;
    const deadline = performance.now() + Math.max(20, seconds * 2 + 8) * 1000;
    await new Promise<void>((resolve, reject) => {
      const step = () => {
        if (isCancelled()) {
          reject(new ExportCancelled());
          return;
        }
        if (encoderError) {
          reject(encoderError);
          return;
        }
        if (performance.now() > deadline) {
          if (encoded >= 2) resolve();
          else reject(new Error('Pro export stalled before the first frames.'));
          return;
        }
        if (encoded >= frames) {
          resolve();
          return;
        }
        const expected = start + encoded / EXPORT_FPS;
        const videoDone = video.ended || video.currentTime >= end - 0.02;
        if (!videoDone && video.currentTime > expected + lead) {
          if (!video.paused) video.pause();
        } else if (!videoDone && video.paused) {
          void video.play().catch(() => undefined);
        }
        if (!videoDone && video.currentTime + 0.012 < expected) {
          requestAnimationFrame(step);
          return;
        }
        captureOverlay();
        paintCompositeFrame(
          context, overlayCanvas, video, getConfig(), readOverlay(), getLayerActive(), silent, previewWidth, previewHeight,
        );
        const timestamp = Math.round((encoded * 1_000_000) / EXPORT_FPS);
        const frame = new VideoFrame(canvas, { timestamp, duration: Math.round(1_000_000 / EXPORT_FPS) });
        const queued = encoder.encodeQueueSize;
        encoder.encode(frame, { keyFrame: encoded % EXPORT_FPS === 0 });
        frame.close();
        encoded += 1;
        onProgress(Math.min(99, Math.round((encoded / frames) * 100)));
        if (queued > 12) {
          video.pause();
          window.setTimeout(() => {
            if (isCancelled()) {
              reject(new ExportCancelled());
              return;
            }
            if (!video.ended && video.currentTime < end - 0.02) void video.play().catch(() => undefined);
            requestAnimationFrame(step);
          }, 20);
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    video.pause();
    if (encoded < 2) throw new Error('Pro export did not capture enough frames.');
    await encoder.flush();
    if (encoderError) throw encoderError;
    muxer.finalize();
    const buffer = muxer.target.buffer;
    if (!buffer?.byteLength) throw new Error('The encoder returned an empty file.');
    return new Blob([buffer], { type: 'video/mp4' });
  } finally {
    try { encoder.close(); } catch { /* The encoder may already be closed after a failure. */ }
  }
}

async function encodeFast(options: RecordClipOptions, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, overlayCanvas: HTMLCanvasElement) {
  const format = exportFormat();
  if (!format || typeof canvas.captureStream !== 'function') {
    throw new Error('Clip export is not supported in this browser. Try current Chrome, Edge or Safari.');
  }
  const { video, silent, previewWidth, previewHeight, isCancelled, onProgress, captureOverlay, readOverlay, getConfig, getLayerActive } = options;
  const { start, seconds } = clipWindow(video, options.startTime);
  const bitrate = Math.round(Math.max(4, Math.min(24, getConfig().exportBitrate)) * 1_000_000);
  const stream = canvas.captureStream(EXPORT_FPS);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: bitrate });
  } catch {
    recorder = new MediaRecorder(stream, { mimeType: format.mimeType });
  }
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data);
  });

  const paint = () => {
    captureOverlay();
    paintCompositeFrame(context, overlayCanvas, video, getConfig(), readOverlay(), getLayerActive(), silent, previewWidth, previewHeight);
  };

  await seekTo(video, start);
  paint();
  recorder.start(200);
  await video.play().catch(() => undefined);
  const startedAt = performance.now();
  const durationMs = seconds * 1000;
  await new Promise<void>((resolve) => {
    const capture = (now: number) => {
      if (isCancelled() || now - startedAt >= durationMs) {
        resolve();
        return;
      }
      paint();
      onProgress(Math.min(99, Math.round(((now - startedAt) / durationMs) * 100)));
      requestAnimationFrame(capture);
    };
    requestAnimationFrame(capture);
  });
  video.pause();
  paint();
  if (recorder.state !== 'inactive') {
    const stopped = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve(), { once: true }));
    recorder.stop();
    await stopped;
  }
  stream.getTracks().forEach((track) => track.stop());
  assertActive(isCancelled);
  if (!chunks.length) throw new Error('The browser returned an empty recording.');
  return { blob: new Blob(chunks, { type: format.mimeType }), extension: format.extension, mimeType: format.mimeType };
}

export async function recordClip(options: RecordClipOptions): Promise<RecordedClip> {
  const { video, getConfig, isCancelled } = options;
  assertActive(isCancelled);
  const config = getConfig();
  const frame = exportFrameSize(
    video.videoWidth || 16,
    video.videoHeight || 9,
    Math.max(1, options.previewWidth),
    Math.max(1, options.previewHeight),
    config.framing,
    undefined,
    config.exportAspect,
  );
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Could not create the export canvas.');
  const overlayCanvas = document.createElement('canvas');
  video.loop = false;
  video.pause();

  if (config.proExport) {
    try {
      const blob = await encodePro(options, canvas, context, overlayCanvas);
      assertActive(isCancelled);
      return { blob, extension: 'mp4', mimeType: 'video/mp4', pro: true };
    } catch (error) {
      if (error instanceof ExportCancelled || isCancelled()) throw new ExportCancelled();
    }
  }
  const fast = await encodeFast(options, canvas, context, overlayCanvas);
  return { ...fast, pro: false };
}

export function safeExportName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
  return base || 'source';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
