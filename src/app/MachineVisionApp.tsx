'use client';

import { useEffect, useRef, useState } from 'react';
import { VisionControls } from '../controls/VisionControls';
import { VideoStage, type ExportJob, type ExportStatus, type SeekCommand } from '../video/VideoStage';
import { AFL_CONFIG, sanitizeConfig, STORAGE_KEY } from '../vision/config';
import { isPresetName, PRESETS, randomizeLook, type PresetName } from '../vision/presets';
import type { ExportAspect, VisionConfig } from '../vision/types';
import { EXPORT_ASPECTS } from '../vision/videoGeometry';

const DELIVERY_KEYS = new Set<keyof VisionConfig>([
  'framing', 'overlayColor', 'imageMode', 'exportAspect', 'exportBitrate', 'proExport', 'silentMaster',
]);

const ASPECTS: ExportAspect[] = ['auto', '9:16', '4:5', '1:1', '16:9'];
const MAX_CLIPS = 10;

interface ClipItem {
  id: string;
  name: string;
  url: string;
  inPoint: number;
  status: 'ready' | 'exporting' | 'done' | 'error';
  progress: number;
}

interface BatchRun {
  order: { id: string; url: string; name: string; startTime: number }[];
  index: number;
  silentMaster: boolean;
}

function formatTimecode(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const whole = Math.floor(safe % 60);
  const tenth = Math.floor((safe % 1) * 10);
  return `${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${tenth}`;
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name);
}

export function MachineVisionApp() {
  const [config, setConfig] = useState<VisionConfig>(AFL_CONFIG);
  const [preset, setPreset] = useState<PresetName | 'Custom'>('AFL');
  const [tuneOpen, setTuneOpen] = useState(false);
  const [layerActive, setLayerActive] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [activeId, setActiveId] = useState('');
  const [playhead, setPlayhead] = useState(0);
  const [duration, setDuration] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus>({ token: 0, status: 'idle', progress: 0 });
  const [seekCommand, setSeekCommand] = useState<SeekCommand | null>(null);
  const [batch, setBatch] = useState<BatchRun | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipsRef = useRef(clips);
  const activeIdRef = useRef(activeId);
  const playheadRef = useRef(0);
  const tokenRef = useRef(1);
  const seekTokenRef = useRef(1);
  const handledTokenRef = useRef(0);
  const batchRef = useRef(batch);
  clipsRef.current = clips;
  activeIdRef.current = activeId;
  batchRef.current = batch;

  const activeClip = clips.find((clip) => clip.id === activeId) ?? null;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { config?: unknown; preset?: string };
        setConfig(sanitizeConfig(parsed.config));
        if (parsed.preset && isPresetName(parsed.preset)) setPreset(parsed.preset);
        else if (parsed.preset) setPreset('Custom');
      }
    } catch { /* Invalid local state falls back to the AFL preset. */ }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, preset }));
  }, [config, preset, storageReady]);

  useEffect(() => {
    document.documentElement.classList.toggle('tune-is-open', tuneOpen);
    return () => document.documentElement.classList.remove('tune-is-open');
  }, [tuneOpen]);

  useEffect(() => () => {
    clipsRef.current.forEach((clip) => URL.revokeObjectURL(clip.url));
  }, []);

  useEffect(() => {
    if (exportStatus.status !== 'done' && exportStatus.status !== 'error') return;
    if (exportStatus.token === 0 || handledTokenRef.current === exportStatus.token) return;
    if (!batchRef.current) return;
    handledTokenRef.current = exportStatus.token;
    const run = batchRef.current;
    const current = run.order[run.index];
    setClips((items) => items.map((clip) => (
      clip.id === current.id
        ? { ...clip, status: exportStatus.status === 'done' ? 'done' : 'error', progress: exportStatus.status === 'done' ? 100 : clip.progress }
        : clip
    )));
    const nextIndex = run.index + 1;
    if (nextIndex >= run.order.length) {
      setBatch(null);
      return;
    }
    const next = run.order[nextIndex];
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    setBatch({ ...run, index: nextIndex });
    setActiveId(next.id);
    setClips((items) => items.map((clip) => clip.id === next.id ? { ...clip, status: 'exporting', progress: 0 } : clip));
    setExportJob({ token, url: next.url, name: next.name, startTime: next.startTime, silentMaster: run.silentMaster });
  }, [exportStatus]);

  useEffect(() => {
    if (exportStatus.status !== 'recording' || !batch) return;
    const current = batch.order[batch.index];
    setClips((items) => items.map((clip) => (
      clip.id === current.id ? { ...clip, status: 'exporting', progress: exportStatus.progress } : clip
    )));
  }, [exportStatus, batch]);

  useEffect(() => {
    if (exportStatus.status !== 'done' || batch) return;
    const timeout = window.setTimeout(() => setExportStatus({ token: 0, status: 'idle', progress: 0 }), 1800);
    return () => window.clearTimeout(timeout);
  }, [exportStatus, batch]);

  const changeConfig = <K extends keyof VisionConfig>(key: K, value: VisionConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
    if (!DELIVERY_KEYS.has(key)) setPreset('Custom');
  };

  const applyPreset = (name: PresetName) => {
    setConfig((current) => ({
      ...PRESETS[name],
      framing: current.framing,
      overlayColor: current.overlayColor,
      imageMode: current.imageMode,
      exportAspect: current.exportAspect,
      exportBitrate: current.exportBitrate,
      proExport: current.proExport,
      silentMaster: current.silentMaster,
    }));
    setPreset(name);
  };

  const resetAll = () => {
    setConfig({ ...AFL_CONFIG });
    setPreset('AFL');
  };

  const addFiles = (list: FileList | File[]) => {
    const incoming = [...list].filter(isVideoFile);
    const rejected = [...list].length - incoming.length;
    if (!incoming.length) {
      setUploadError(rejected ? 'Choose a video file' : '');
      return;
    }
    const room = Math.max(0, MAX_CLIPS - clipsRef.current.length);
    const accepted = incoming.slice(0, room);
    const next = accepted.map((file) => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      url: URL.createObjectURL(file),
      inPoint: 0,
      status: 'ready' as const,
      progress: 0,
    }));
    const capped = incoming.length - accepted.length;
    if (capped > 0) setUploadError('Queue holds 10 clips.');
    else if (rejected > 0) setUploadError('Skipped files that are not video.');
    else setUploadError('');
    const merged = [...clipsRef.current, ...next];
    clipsRef.current = merged;
    if (!activeIdRef.current && next[0]) setActiveId(next[0].id);
    setClips(merged);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activateClip = (id: string) => {
    if (batch) return;
    const currentId = activeIdRef.current;
    setClips((items) => items.map((clip) => clip.id === currentId ? { ...clip, inPoint: playheadRef.current } : clip));
    setActiveId(id);
    const next = clipsRef.current.find((clip) => clip.id === id);
    seekTokenRef.current += 1;
    setSeekCommand({ token: seekTokenRef.current, time: next?.inPoint ?? 0 });
  };

  const removeClip = (id: string) => {
    if (batch) return;
    const removed = clipsRef.current.find((clip) => clip.id === id);
    if (!removed) return;
    URL.revokeObjectURL(removed.url);
    const remaining = clipsRef.current.filter((clip) => clip.id !== id);
    clipsRef.current = remaining;
    if (id === activeIdRef.current) setActiveId(remaining[0]?.id ?? '');
    setClips(remaining);
  };

  const onScrub = (time: number) => {
    if (batch) return;
    playheadRef.current = time;
    setPlayhead(time);
    seekTokenRef.current += 1;
    setSeekCommand({ token: seekTokenRef.current, time });
    setClips((items) => items.map((clip) => clip.id === activeIdRef.current ? { ...clip, inPoint: time } : clip));
  };

  const onTime = (time: number, nextDuration: number) => {
    if (batchRef.current) return;
    playheadRef.current = time;
    setPlayhead(time);
    setDuration(nextDuration);
  };

  const startExport = () => {
    const items = clipsRef.current;
    if (!items.length || batch) return;
    const order = items.map((clip) => ({
      id: clip.id,
      url: clip.url,
      name: clip.name,
      startTime: clip.id === activeIdRef.current ? playheadRef.current : clip.inPoint,
    }));
    const first = order[0];
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    setUploadError('');
    setBatch({ order, index: 0, silentMaster: config.silentMaster });
    setActiveId(first.id);
    setClips((current) => current.map((clip) => (
      clip.id === first.id
        ? { ...clip, status: 'exporting', progress: 0 }
        : { ...clip, status: 'ready', progress: 0 }
    )));
    setExportJob({
      token,
      url: first.url,
      name: first.name,
      startTime: first.startTime,
      silentMaster: config.silentMaster,
    });
  };

  const exporting = Boolean(batch) || exportStatus.status === 'recording';
  const queueCount = clips.length;
  const batchLabel = batch ? `${batch.index + 1}/${batch.order.length} ` : '';
  const exportLabel = exporting
    ? `Exporting ${batchLabel}${exportStatus.progress}%`
    : exportStatus.status === 'done'
      ? 'Downloaded'
      : queueCount > 1
        ? 'Export queue'
        : 'Export clip';
  const frame = config.exportAspect === 'auto' ? null : EXPORT_ASPECTS[config.exportAspect];

  return (
    <main className="machine-app">
      <header className="afl-header">
        <p className="afl-mark">&gt;&gt; Armstrong Future Labs</p>
        <p className="afl-studio">Armstrong Studios</p>
      </header>
      <div className="workspace">
        <section className="identity-panel">
          <div className="identity-copy">
            <h1><span>Machine Vision</span><span>AFL Lab</span></h1>
            <p>Video read as points, signals and selective focus.</p>
          </div>
          <div className="public-actions">
            <input
              ref={fileInputRef}
              className="video-file-input"
              type="file"
              multiple
              accept="video/mp4,video/webm,video/quicktime,video/*"
              aria-label="Choose local videos"
              onChange={(event) => { if (event.target.files) addFiles(event.target.files); }}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={Boolean(batch)}>Upload video<span>＋</span></button>
            <button
              type="button"
              data-testid="export-clip"
              disabled={!videoReady || exporting || !activeClip}
              onClick={startExport}
            >
              {exportLabel}
              <span>{exporting ? '●' : '↓'}</span>
            </button>
            <button
              type="button"
              data-testid="clean-plate"
              aria-pressed={!layerActive}
              onClick={() => setLayerActive((current) => !current)}
            >
              {layerActive ? 'Clean plate' : 'Restore overlay'}
              <span>{layerActive ? '○' : '●'}</span>
            </button>
            <button type="button" className="tune-trigger" onClick={() => setTuneOpen(true)} aria-expanded={tuneOpen}>Tune <span>＋</span></button>
          </div>
          <div className="identity-meta" aria-hidden="true">
            <div><span>Source</span><strong title={activeClip?.name ?? 'No source selected'}>{activeClip?.name ?? 'No source selected'}</strong></div>
            <div><span>Export</span><strong>{frame ? `${frame.width}×${frame.height}` : 'Auto'}</strong></div>
            <div><span>Preset</span><strong>{preset}</strong></div>
          </div>
          {(uploadError || exportStatus.status === 'error') && <p className="upload-error" role="alert">{uploadError || exportStatus.message}</p>}
        </section>

        <section
          className={`stage-shell${dragging ? ' is-dropping' : ''}`}
          aria-label="Live canvas"
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!batch) addFiles(event.dataTransfer.files);
          }}
        >
          <VideoStage
            config={config}
            layerActive={layerActive}
            source={activeClip?.url ?? ''}
            exportJob={exportJob}
            seekCommand={seekCommand}
            onExportStatus={setExportStatus}
            onReadyChange={setVideoReady}
            onTime={onTime}
          />
          <div className="stage-tools">
            <div className="aspect-row" role="group" aria-label="Export size">
              {ASPECTS.map((aspect) => (
                <button
                  type="button"
                  key={aspect}
                  data-testid={`aspect-${aspect.replace(':', '-')}`}
                  className={config.exportAspect === aspect ? 'is-active' : ''}
                  onClick={() => changeConfig('exportAspect', aspect)}
                >
                  {aspect === 'auto' ? 'Auto' : aspect}
                </button>
              ))}
              <span className="aspect-size">{frame ? `${frame.width}×${frame.height}` : 'Source aspect'}</span>
            </div>
            <label className="timeline-row">
              <span className="sr-only">Timeline</span>
              <input
                data-testid="timeline"
                type="range"
                min={0}
                max={duration || 0}
                step={0.01}
                value={Math.min(playhead, duration || 0)}
                disabled={!videoReady || Boolean(batch)}
                aria-valuetext={formatTimecode(playhead)}
                onChange={(event) => onScrub(Number(event.target.value))}
              />
              <span className="time-readout">{formatTimecode(playhead)} / {formatTimecode(duration)}</span>
            </label>
            <ol className="clip-queue" data-testid="clip-queue">
              {clips.length === 0 && <li className="queue-empty">Drop 3–10 clips. The queue renders in order.</li>}
              {clips.map((clip, index) => (
                <li key={clip.id} className={clip.id === activeId ? 'is-active' : ''}>
                  <button type="button" onClick={() => activateClip(clip.id)} disabled={Boolean(batch)}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{clip.name}</strong>
                  </button>
                  <em>{clip.status === 'exporting' ? `${clip.progress}%` : clip.status}</em>
                  <button type="button" onClick={() => removeClip(clip.id)} disabled={Boolean(batch)} aria-label={`Remove ${clip.name}`}>–</button>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
      <footer className="afl-footer">
        <p>Human taste. AI workflows.</p>
        <span aria-hidden="true">&gt;&gt;</span>
      </footer>

      {tuneOpen && <button className="sheet-scrim" type="button" onClick={() => setTuneOpen(false)} aria-label="Close controls" />}
      <aside className={`tune-surface${tuneOpen ? ' is-open' : ''}`} aria-hidden={!tuneOpen}>
        <VisionControls
          config={config}
          preset={preset}
          onChange={changeConfig}
          onPreset={applyPreset}
          onRandomize={() => { setConfig((current) => randomizeLook(current)); setPreset('Custom'); }}
          onReset={resetAll}
          onClose={() => setTuneOpen(false)}
        />
      </aside>
    </main>
  );
}
