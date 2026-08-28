'use client';

import { useEffect, useRef, useState } from 'react';
import { VisionControls } from '../controls/VisionControls';
import { VideoStage, type ExportStatus } from '../video/VideoStage';
import { EDITORIAL_CONFIG, sanitizeConfig, STORAGE_KEY } from '../vision/config';
import { PRESETS, randomizeLook, type PresetName } from '../vision/presets';
import type { VisionConfig } from '../vision/types';

export function MachineVisionApp() {
  const [config, setConfig] = useState<VisionConfig>(EDITORIAL_CONFIG);
  const [preset, setPreset] = useState<PresetName | 'Custom'>('Editorial');
  const [tuneOpen, setTuneOpen] = useState(false);
  const [layerActive, setLayerActive] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [videoSource, setVideoSource] = useState('');
  const [videoName, setVideoName] = useState('No source selected');
  const [uploadError, setUploadError] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const [exportRequest, setExportRequest] = useState(0);
  const [exportStatus, setExportStatus] = useState<ExportStatus>({ status: 'idle', progress: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { config?: unknown; preset?: PresetName | 'Custom' };
        setConfig(sanitizeConfig(parsed.config));
        if (parsed.preset) setPreset(parsed.preset);
      }
    } catch { /* Invalid local state falls back to Editorial. */ }
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
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  useEffect(() => {
    if (exportStatus.status !== 'done') return;
    const timeout = window.setTimeout(() => setExportStatus({ status: 'idle', progress: 0 }), 1800);
    return () => window.clearTimeout(timeout);
  }, [exportStatus.status]);

  const changeConfig = <K extends keyof VisionConfig>(key: K, value: VisionConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
    if (!['framing', 'overlayColor', 'imageMode'].includes(key)) setPreset('Custom');
  };

  const applyPreset = (name: PresetName) => {
    setConfig((current) => ({
      ...PRESETS[name],
      framing: current.framing,
      overlayColor: current.overlayColor,
      imageMode: current.imageMode,
    }));
    setPreset(name);
  };

  const resetAll = () => {
    setConfig({ ...EDITORIAL_CONFIG });
    setPreset('Editorial');
  };

  const selectVideo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setUploadError('Choose a video file');
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setVideoSource(objectUrl);
    setVideoName(file.name);
    setUploadError('');
    setExportStatus({ status: 'idle', progress: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <main className="machine-app">
      <section className="identity-panel">
        <div className="identity-topline">
          <a href="https://amirmushich.com" target="_blank" rel="noreferrer">A tool by Amir Mushich</a>
          <a href="https://github.com/amirmushichge/machine-vision" target="_blank" rel="noreferrer">View source ↗</a>
        </div>
        <div className="identity-copy">
          <h1><span>Machine</span><span>Vision<sup>®</sup></span></h1>
          <p>Video interpreted as a changing field of points, signals and selective focus.</p>
        </div>
        <div className="public-actions">
          <input
            ref={fileInputRef}
            className="video-file-input"
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            aria-label="Choose a local video"
            onChange={(event) => selectVideo(event.target.files?.[0])}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()}>Upload video<span>＋</span></button>
          <button
            type="button"
            disabled={!videoReady || exportStatus.status === 'recording'}
            onClick={() => setExportRequest((current) => current + 1)}
          >
            {exportStatus.status === 'recording' ? `Exporting ${exportStatus.progress}%` : exportStatus.status === 'done' ? 'Downloaded' : 'Export clip'}
            <span>{exportStatus.status === 'recording' ? '●' : '↓'}</span>
          </button>
          <label className="layer-toggle">
            <input type="checkbox" checked={layerActive} onChange={(event) => setLayerActive(event.target.checked)} />
            <span className="layer-dot" />
            <span>Layer active</span>
          </label>
          <button type="button" className="tune-trigger" onClick={() => setTuneOpen(true)} aria-expanded={tuneOpen}>Tune <span>＋</span></button>
        </div>
        <div className="identity-meta" aria-hidden="true">
          <div><span>Source</span><strong title={videoName}>{videoName}</strong></div>
          <div><span>Refresh</span><strong>{String(config.analysisFPS).padStart(2, '0')} / second</strong></div>
          <div><span>Preset</span><strong>{preset}</strong></div>
        </div>
        {(uploadError || exportStatus.status === 'error') && <p className="upload-error" role="alert">{uploadError || exportStatus.message}</p>}
      </section>

      <section className="stage-shell" aria-label="Machine Vision live canvas">
        <VideoStage
          config={config}
          layerActive={layerActive}
          source={videoSource}
          exportName={videoName}
          exportRequest={exportRequest}
          onExportStatus={setExportStatus}
          onReadyChange={setVideoReady}
        />
      </section>

      {tuneOpen && <button className="sheet-scrim" type="button" onClick={() => setTuneOpen(false)} aria-label="Close controls" />}
      <aside className={`tune-surface${tuneOpen ? ' is-open' : ''}`} aria-hidden={!tuneOpen}>
        <VisionControls
          config={config} preset={preset} onChange={changeConfig} onPreset={applyPreset}
          onRandomize={() => { setConfig((current) => randomizeLook(current)); setPreset('Custom'); }}
          onReset={resetAll} onClose={() => setTuneOpen(false)}
        />
      </aside>
    </main>
  );
}
