'use client';

import { useEffect, useRef, useState } from 'react';
import { BoxTracker } from '../vision/boxTracker';
import { resolveOverlayOpacity } from '../vision/envelope';
import { detectFaceHints, faceDetectorAvailable } from '../vision/faceDetector';
import { analyzeFrame } from '../vision/featureAnalyzer';
import { generateFrameOverlay } from '../vision/overlayGenerator';
import { renderOverlay } from '../vision/overlayRenderer';
import { hashSeed } from '../vision/seededRandom';
import { detectSubjects } from '../vision/subjectLock';
import type { FaceHint, FrameOverlay, VisionConfig } from '../vision/types';
import { EXPORT_ASPECTS, fitAspectBox, resolveFraming, type ResolvedFraming } from '../vision/videoGeometry';
import { downloadBlob, ExportCancelled, recordClip, safeExportName } from './recordClip';

export interface ExportJob {
  token: number;
  url: string;
  name: string;
  startTime: number;
  silentMaster: boolean;
}

export interface ExportStatus {
  token: number;
  status: 'idle' | 'recording' | 'done' | 'error';
  progress: number;
  message?: string;
}

export interface SeekCommand {
  token: number;
  time: number;
}

interface VideoStageProps {
  config: VisionConfig;
  layerActive: boolean;
  source: string;
  exportJob: ExportJob | null;
  seekCommand: SeekCommand | null;
  onExportStatus: (state: ExportStatus) => void;
  onReadyChange: (ready: boolean) => void;
  onTime: (time: number, duration: number) => void;
}

function aspectReadout(aspect: VisionConfig['exportAspect']) {
  if (aspect === 'auto') return 'Auto / fit';
  const frame = EXPORT_ASPECTS[aspect];
  return `${aspect}  ${frame.width}×${frame.height}`;
}

function waitForClip(video: HTMLVideoElement, url: string, isCancelled: () => boolean) {
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      if (isCancelled()) {
        cleanup();
        reject(new ExportCancelled());
        return;
      }
      if (video.currentSrc === url && video.readyState >= 2) {
        cleanup();
        resolve();
      }
    };
    const fail = () => {
      cleanup();
      reject(new Error('Video is not ready to export.'));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Video is not ready to export.'));
    }, 8000);
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadeddata', check);
      video.removeEventListener('canplay', check);
      video.removeEventListener('error', fail);
    };
    video.addEventListener('loadeddata', check);
    video.addEventListener('canplay', check);
    video.addEventListener('error', fail);
    check();
  });
}

export function VideoStage({
  config, layerActive, source, exportJob, seekCommand, onExportStatus, onReadyChange, onTime,
}: VideoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousLumaRef = useRef<Float32Array | undefined>(undefined);
  const overlayDataRef = useRef<FrameOverlay | null>(null);
  const trackerRef = useRef(new BoxTracker());
  const snapshotStartedRef = useRef(0);
  const lastBucketRef = useRef(-1);
  const configRef = useRef(config);
  const layerRef = useRef(layerActive);
  const faceHintsRef = useRef<FaceHint[] | null>(null);
  const faceBusyRef = useRef(false);
  const lastFaceRef = useRef(0);
  const exportingRef = useRef(false);
  const exportGenerationRef = useRef(0);
  const onTimeRef = useRef(onTime);
  const onExportStatusRef = useRef(onExportStatus);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [resolvedFraming, setResolvedFraming] = useState<ResolvedFraming>('fit');
  const [plate, setPlate] = useState<{ width: number; height: number } | null>(null);
  const [looping, setLooping] = useState(true);

  useEffect(() => { configRef.current = config; lastBucketRef.current = -1; }, [config]);
  useEffect(() => { layerRef.current = layerActive; }, [layerActive]);
  useEffect(() => { onTimeRef.current = onTime; }, [onTime]);
  useEffect(() => { onExportStatusRef.current = onExportStatus; }, [onExportStatus]);
  useEffect(() => { onReadyChange(ready); }, [ready, onReadyChange]);

  const captureOverlay = () => {
    const video = videoRef.current;
    const currentConfig = configRef.current;
    if (!video || video.readyState < 2) return;
    const analysisCanvas = analysisCanvasRef.current ?? document.createElement('canvas');
    analysisCanvasRef.current = analysisCanvas;
    const width = Math.round(144 + currentConfig.detail * 0.96);
    const height = Math.max(72, Math.round(width * (video.videoHeight / Math.max(1, video.videoWidth))));
    if (analysisCanvas.width !== width || analysisCanvas.height !== height) {
      analysisCanvas.width = width;
      analysisCanvas.height = height;
      previousLumaRef.current = undefined;
    }
    const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
    if (!analysisContext) return;
    analysisContext.drawImage(video, 0, 0, width, height);
    const image = analysisContext.getImageData(0, 0, width, height);
    const result = analyzeFrame(image, currentConfig, previousLumaRef.current);
    previousLumaRef.current = result.luma;
    const subjects = currentConfig.subjectLock
      ? detectSubjects(image, faceHintsRef.current, currentConfig.labelVoice)
      : [];
    const now = performance.now();
    const boxes = trackerRef.current.update(result.featureMap, currentConfig, now);
    const bucket = Math.floor(video.currentTime * currentConfig.analysisFPS);
    const seed = hashSeed(currentConfig.seed, bucket, result.featureMap.features.length);
    overlayDataRef.current = generateFrameOverlay(result.featureMap, currentConfig, seed, bucket, boxes, subjects);
  };
  const captureRef = useRef(captureOverlay);
  captureRef.current = captureOverlay;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const next = fitAspectBox(rect.width, rect.height, configRef.current.exportAspect);
      setPlate((current) => {
        if (current && Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5) return current;
        return next;
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, [config.exportAspect, source]);

  useEffect(() => {
    const video = videoRef.current;
    const plateEl = plateRef.current;
    if (!video || !plateEl) return;
    const updateFraming = () => {
      const rect = plateEl.getBoundingClientRect();
      const next = resolveFraming(video.videoWidth || 16, video.videoHeight || 9, rect.width, rect.height, config.framing);
      setResolvedFraming((current) => current === next ? current : next);
    };
    const observer = new ResizeObserver(updateFraming);
    observer.observe(plateEl);
    video.addEventListener('loadedmetadata', updateFraming);
    updateFraming();
    return () => {
      observer.disconnect();
      video.removeEventListener('loadedmetadata', updateFraming);
    };
  }, [config.framing, config.exportAspect, source, plate]);

  useEffect(() => {
    previousLumaRef.current = undefined;
    overlayDataRef.current = null;
    faceHintsRef.current = null;
    trackerRef.current = new BoxTracker();
    lastBucketRef.current = -1;
    setReady(false);
    setLoadError('');
  }, [source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const report = () => {
      onTimeRef.current(video.currentTime || 0, Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.addEventListener('timeupdate', report);
    video.addEventListener('seeked', report);
    video.addEventListener('loadedmetadata', report);
    return () => {
      video.removeEventListener('timeupdate', report);
      video.removeEventListener('seeked', report);
      video.removeEventListener('loadedmetadata', report);
    };
  }, [source]);

  useEffect(() => {
    if (!seekCommand || exportingRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 1) return;
    if (Math.abs(video.currentTime - seekCommand.time) < 0.03) return;
    video.currentTime = seekCommand.time;
  }, [seekCommand, ready]);

  useEffect(() => {
    let animationFrame = 0;
    let disposed = false;
    const tick = (now: number) => {
      if (disposed) return;
      const video = videoRef.current;
      const plateEl = plateRef.current;
      const canvas = overlayRef.current;
      if (video && plateEl && canvas) {
        const currentConfig = configRef.current;
        const bucket = Math.floor((video.currentTime || 0) * currentConfig.analysisFPS);
        if (!exportingRef.current && video.readyState >= 2 && bucket !== lastBucketRef.current) {
          captureRef.current();
          snapshotStartedRef.current = now;
          lastBucketRef.current = bucket;
          if (currentConfig.subjectLock && faceDetectorAvailable() && !faceBusyRef.current && now - lastFaceRef.current > 450) {
            faceBusyRef.current = true;
            lastFaceRef.current = now;
            const width = video.videoWidth || 1;
            const height = video.videoHeight || 1;
            void detectFaceHints(video, width, height)
              .then((hints) => { if (hints) faceHintsRef.current = hints; })
              .finally(() => { faceBusyRef.current = false; });
          }
        }
        const rect = plateEl.getBoundingClientRect();
        const transitionAlpha = Math.min(1, 0.48 + (now - snapshotStartedRef.current) / 90);
        renderOverlay(canvas, layerRef.current ? overlayDataRef.current : null, currentConfig, {
          sourceWidth: video.videoWidth || 16,
          sourceHeight: video.videoHeight || 9,
          stageWidth: rect.width,
          stageHeight: rect.height,
          transitionAlpha,
          opacity: resolveOverlayOpacity(currentConfig, video.currentTime || 0, video.duration || 0),
        });
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => { disposed = true; cancelAnimationFrame(animationFrame); };
  }, []);

  useEffect(() => {
    if (!exportJob) return;
    const video = videoRef.current;
    const plateEl = plateRef.current;
    if (!video || !plateEl) return;
    let cancelled = false;
    const generation = exportGenerationRef.current + 1;
    exportGenerationRef.current = generation;
    const isCancelled = () => cancelled;

    const run = async () => {
      const previousTime = video.currentTime;
      const wasPaused = video.paused;
      await waitForClip(video, exportJob.url, isCancelled);
      if (cancelled || exportGenerationRef.current !== generation) return;
      exportingRef.current = true;
      setLooping(false);
      trackerRef.current = new BoxTracker();
      previousLumaRef.current = undefined;
      lastBucketRef.current = -1;
      onExportStatusRef.current({ token: exportJob.token, status: 'recording', progress: 0 });
      const passes = exportJob.silentMaster
        ? [{ silent: true, suffix: '-master' }, { silent: false, suffix: '-burn' }]
        : [{ silent: false, suffix: '' }];

      for (let pass = 0; pass < passes.length; pass += 1) {
        if (cancelled) return;
        const currentPass = passes[pass];
        const recorded = await recordClip({
          video,
          getConfig: () => configRef.current,
          getLayerActive: () => layerRef.current,
          readOverlay: () => overlayDataRef.current,
          captureOverlay: () => captureRef.current(),
          silent: currentPass.silent,
          startTime: exportJob.startTime,
          previewWidth: plateEl.clientWidth,
          previewHeight: plateEl.clientHeight,
          isCancelled,
          onProgress: (progress) => {
            const overall = passes.length === 1 ? progress : Math.round(pass * 50 + progress / 2);
            onExportStatusRef.current({ token: exportJob.token, status: 'recording', progress: overall });
          },
        });
        if (cancelled) return;
        const aspect = configRef.current.exportAspect;
        const aspectTag = aspect === 'auto' ? 'auto' : aspect.replace(':', 'x');
        downloadBlob(recorded.blob, `afl-lab-${aspectTag}-${safeExportName(exportJob.name)}${currentPass.suffix}.${recorded.extension}`);
        if (pass < passes.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 400));
      }

      if (cancelled) return;
      video.pause();
      const restore = Math.min(previousTime, Math.max(0, video.duration || previousTime));
      if (Math.abs(video.currentTime - restore) > 0.05) video.currentTime = restore;
      if (!wasPaused) void video.play().catch(() => undefined);
      onExportStatusRef.current({ token: exportJob.token, status: 'done', progress: 100 });
    };

    void run().catch((error: unknown) => {
      if (cancelled || error instanceof ExportCancelled) return;
      const message = error instanceof Error ? error.message : 'Clip export failed.';
      onExportStatusRef.current({ token: exportJob.token, status: 'error', progress: 0, message });
    }).finally(() => {
      if (exportGenerationRef.current === generation) {
        exportingRef.current = false;
        setLooping(true);
      }
    });

    return () => { cancelled = true; };
  }, [exportJob]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video || !source || !ready || exportingRef.current) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  return (
    <div ref={stageRef} className={`video-stage${ready ? ' is-ready' : ''}`} data-aspect={config.exportAspect}>
      <div
        ref={plateRef}
        className="aspect-plate"
        style={plate ? { width: `${plate.width}px`, height: `${plate.height}px` } : undefined}
      >
        <video
          ref={videoRef}
          className="hero-video"
          data-image-mode={config.imageMode}
          style={{ objectFit: resolvedFraming === 'fill' ? 'cover' : 'contain' }}
          src={source || undefined}
          muted
          loop={looping}
          playsInline
          preload="auto"
          onLoadStart={() => { setReady(false); setLoadError(''); }}
          onCanPlay={() => {
            setReady(true);
            setLoadError('');
            if (!exportingRef.current) void videoRef.current?.play().catch(() => undefined);
          }}
          onError={() => {
            setReady(false);
            if (source) setLoadError('Unsupported video codec. Try MP4 / H.264 or WebM.');
          }}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
        />
        <canvas ref={overlayRef} className="overlay-canvas" aria-hidden="true" />
      </div>
      <button className="playback-toggle" type="button" onClick={togglePlayback} aria-label={paused ? 'Play video' : 'Pause video'}>
        {paused ? 'Play' : 'Pause'}
      </button>
      {!ready && <div className={`video-loading${loadError ? ' is-error' : ''}`}>{source ? loadError || 'Loading source' : 'Drop clips or upload a video'}</div>}
      <div className="stage-index" aria-hidden="true">{aspectReadout(config.exportAspect)}</div>
    </div>
  );
}
