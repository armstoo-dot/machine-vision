import { ControlSlider } from './ControlSlider';
import type { PresetName } from '../vision/presets';
import { PRESETS } from '../vision/presets';
import type { AnalysisMode, FramingMode, ImageMode, VisionConfig } from '../vision/types';

interface VisionControlsProps {
  config: VisionConfig;
  preset: PresetName | 'Custom';
  onChange: <K extends keyof VisionConfig>(key: K, value: VisionConfig[K]) => void;
  onPreset: (name: PresetName) => void;
  onRandomize: () => void;
  onReset: () => void;
  onClose: () => void;
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-track" aria-hidden="true"><span /></span>
    </label>
  );
}

const modes: { value: AnalysisMode; label: string }[] = [
  { value: 'combined', label: 'Combined' }, { value: 'contrast', label: 'Contrast' },
  { value: 'edges', label: 'Edges' }, { value: 'bright', label: 'Bright' },
  { value: 'dark', label: 'Dark' }, { value: 'motion', label: 'Motion' },
];

const framingModes: { value: FramingMode; label: string }[] = [
  { value: 'auto', label: 'Auto' }, { value: 'fit', label: 'Fit' }, { value: 'fill', label: 'Fill' },
];

const imageModes: { value: ImageMode; label: string }[] = [
  { value: 'original', label: 'Original' }, { value: 'mono', label: 'Mono' },
  { value: 'invert', label: 'Invert' }, { value: 'contrast', label: 'High contrast' },
];

export function VisionControls({ config, preset, onChange, onPreset, onRandomize, onReset, onClose }: VisionControlsProps) {
  return (
    <div className="controls-panel">
      <div className="controls-header">
        <div><span className="eyebrow">AFL Lab / Tune</span><h2>Visual system</h2></div>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close controls">Close</button>
      </div>

      <div className="preset-block">
        <div className="preset-heading"><span>Preset</span><strong>{preset}</strong></div>
        <div className="preset-grid">
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <button type="button" key={name} className={preset === name ? 'is-active' : ''} onClick={() => onPreset(name)}>{name}</button>
          ))}
        </div>
        <div className="top-actions">
          <button type="button" className="action-primary" onClick={onRandomize}>Randomize look</button>
          <button type="button" onClick={onReset}>Reset</button>
        </div>
      </div>

      <details open>
        <summary><span>Analysis</span><span className="section-meta"><span className="section-number">01</span><span className="section-toggle" aria-hidden="true" /></span></summary>
        <div className="control-group">
          <div className="mode-grid" role="group" aria-label="Analysis mode">
            {modes.map(({ value, label }) => <button type="button" key={value} className={config.mode === value ? 'is-active' : ''} onClick={() => onChange('mode', value)}>{label}</button>)}
          </div>
          <ControlSlider label="Threshold" value={config.threshold} min={10} max={85} onChange={(value) => onChange('threshold', value)} />
          <ControlSlider label="Detail" value={config.detail} min={10} max={100} onChange={(value) => onChange('detail', value)} />
          <ControlSlider label="Max points" value={config.maxPoints} min={8} max={100} onChange={(value) => onChange('maxPoints', value)} />
          <ControlSlider label="Min distance" value={config.minDistance} min={12} max={90} onChange={(value) => onChange('minDistance', value)} />
          <ControlSlider label="Motion bias" value={config.motionBias} min={0} max={100} disabled={config.mode !== 'combined'} onChange={(value) => onChange('motionBias', value)} />
        </div>
      </details>

      <details open>
        <summary><span>Composition</span><span className="section-meta"><span className="section-number">02</span><span className="section-toggle" aria-hidden="true" /></span></summary>
        <div className="control-group">
          <ControlSlider label="Density" value={config.density} min={10} max={100} onChange={(value) => onChange('density', value)} />
          <ControlSlider label="Chaos" value={config.chaos} min={0} max={100} onChange={(value) => onChange('chaos', value)} />
          <Switch label="Connections" checked={config.connectionsEnabled} onChange={(value) => onChange('connectionsEnabled', value)} />
          <ControlSlider label="Connection distance" value={config.connectionDistance} min={40} max={240} disabled={!config.connectionsEnabled} onChange={(value) => onChange('connectionDistance', value)} />
          <ControlSlider label="Connection amount" value={config.connectionAmount} min={0} max={100} disabled={!config.connectionsEnabled} onChange={(value) => onChange('connectionAmount', value)} />
          <ControlSlider label="Labels" value={config.labelAmount} min={0} max={100} onChange={(value) => onChange('labelAmount', value)} />
          <ControlSlider label="Brackets" value={config.bracketAmount} min={0} max={100} onChange={(value) => onChange('bracketAmount', value)} />
        </div>
      </details>

      <details open>
        <summary><span>Frame &amp; color</span><span className="section-meta"><span className="section-number">03</span><span className="section-toggle" aria-hidden="true" /></span></summary>
        <div className="control-group">
          <div className="choice-control">
            <div className="choice-heading"><span>Framing</span><small>Auto keeps the full frame when a fill would crop it</small></div>
            <div className="framing-grid" role="group" aria-label="Video framing">
              {framingModes.map(({ value, label }) => <button type="button" key={value} className={config.framing === value ? 'is-active' : ''} onClick={() => onChange('framing', value)}>{label}</button>)}
            </div>
          </div>
          <label className="color-control">
            <span><span>Overlay color</span><small>Lines, points, labels and boxes</small></span>
            <span className="color-inputs">
              <input type="color" value={config.overlayColor} onChange={(event) => onChange('overlayColor', event.target.value)} aria-label="Choose overlay color" />
              <input
                key={config.overlayColor}
                type="text"
                defaultValue={config.overlayColor.toUpperCase()}
                maxLength={7}
                spellCheck={false}
                aria-label="Overlay color hex value"
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                onBlur={(event) => {
                  const value = event.currentTarget.value;
                  if (/^#[0-9a-f]{6}$/i.test(value)) onChange('overlayColor', value.toLowerCase());
                  else event.currentTarget.value = config.overlayColor.toUpperCase();
                }}
              />
            </span>
          </label>
          <div className="choice-control">
            <div className="choice-heading"><span>Image treatment</span><small>Applied to the video only</small></div>
            <div className="image-mode-grid" role="group" aria-label="Image treatment">
              {imageModes.map(({ value, label }) => <button type="button" key={value} className={config.imageMode === value ? 'is-active' : ''} onClick={() => onChange('imageMode', value)}>{label}</button>)}
            </div>
          </div>
        </div>
      </details>

      <details>
        <summary><span>Appearance</span><span className="section-meta"><span className="section-number">04</span><span className="section-toggle" aria-hidden="true" /></span></summary>
        <div className="control-group">
          <ControlSlider label="Overlay opacity" value={config.overlayOpacity} min={20} max={100} suffix="%" onChange={(value) => onChange('overlayOpacity', value)} />
          <ControlSlider label="Line weight" value={config.lineWeight} min={0.5} max={2} step={0.1} suffix=" px" onChange={(value) => onChange('lineWeight', value)} />
          <ControlSlider label="Point size" value={config.pointSize} min={1} max={5} step={0.1} onChange={(value) => onChange('pointSize', value)} />
          <ControlSlider label="Label size" value={config.labelSize} min={7} max={14} suffix=" px" onChange={(value) => onChange('labelSize', value)} />
          <Switch label="Contrast assist" checked={config.contrastAssist} onChange={(value) => onChange('contrastAssist', value)} />
          <Switch label="Soft underlay" checked={config.underlay} onChange={(value) => onChange('underlay', value)} />
          <Switch label="Boxes" checked={config.boxesEnabled} onChange={(value) => onChange('boxesEnabled', value)} />
        </div>
      </details>

      <details>
        <summary><span>Timing</span><span className="section-meta"><span className="section-number">05</span><span className="section-toggle" aria-hidden="true" /></span></summary>
        <div className="control-group">
          <ControlSlider label="Refresh rate" value={config.analysisFPS} min={2} max={15} suffix=" fps" title="How often the visual analysis refreshes." onChange={(value) => onChange('analysisFPS', value)} />
          <label className="number-control"><span><span>Seed</span><small>Changes overlay distribution</small></span><input type="number" value={config.seed} min={1} max={999999} onChange={(event) => onChange('seed', Math.max(1, Number(event.target.value)))} /></label>
          <button type="button" className="new-seed" onClick={() => onChange('seed', Math.floor(Math.random() * 999999) + 1)}>New seed</button>
        </div>
      </details>

      <details>
        <summary><span>Tracking boxes</span><span className="section-meta"><span className="section-number">06</span><span className="section-toggle" aria-hidden="true" /></span></summary>
        <div className="control-group">
          <ControlSlider label="Box count" value={config.boxCount} min={0} max={4} disabled={!config.boxesEnabled} onChange={(value) => onChange('boxCount', value)} />
          <ControlSlider label="Hold" value={config.boxHold} min={200} max={2200} step={50} suffix=" ms" disabled={!config.boxesEnabled} onChange={(value) => onChange('boxHold', value)} />
          <ControlSlider label="Smoothness" value={config.boxSmoothness} min={0} max={100} disabled={!config.boxesEnabled} onChange={(value) => onChange('boxSmoothness', value)} />
          <ControlSlider label="Box strength" value={config.boxStrength} min={10} max={100} disabled={!config.boxesEnabled} onChange={(value) => onChange('boxStrength', value)} />
        </div>
      </details>
      <p className="controls-footnote">Video, frames and exports stay on this device. Nothing is uploaded or stored.</p>
    </div>
  );
}
