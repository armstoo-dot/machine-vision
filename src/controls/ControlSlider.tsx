interface ControlSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  title?: string;
  onChange: (value: number) => void;
}

export function ControlSlider({ label, value, min, max, step = 1, suffix = '', disabled, title, onChange }: ControlSliderProps) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className={`control-slider${disabled ? ' is-disabled' : ''}`} title={title}>
      <span className="control-label"><span>{label}</span><output>{value}{suffix}</output></span>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        style={{ '--progress': `${progress}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
