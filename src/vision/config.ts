import type { ExportAspect, LabelVoice, VisionConfig } from './types';

export const DEBUG_VISION = false;
export const STORAGE_KEY = 'afl-machine-vision:v1';

const EXPORT_ASPECTS: readonly ExportAspect[] = ['auto', '9:16', '4:5', '1:1', '16:9'];
const LABEL_VOICES: readonly LabelVoice[] = ['editorial', 'quiet', 'hud'];

export const EDITORIAL_CONFIG: VisionConfig = {
  framing: 'auto',
  exportAspect: 'auto',
  overlayColor: '#ffffff',
  imageMode: 'original',
  mode: 'combined',
  threshold: 45,
  detail: 55,
  maxPoints: 48,
  minDistance: 42,
  motionBias: 25,
  motionDensity: 42,
  density: 50,
  chaos: 65,
  connectionsEnabled: true,
  connectionDistance: 120,
  connectionAmount: 28,
  labelAmount: 24,
  bracketAmount: 22,
  overlayOpacity: 84,
  lineWeight: 0.9,
  pointSize: 2,
  labelSize: 9,
  contrastAssist: true,
  underlay: false,
  analysisFPS: 8,
  seed: 42,
  boxesEnabled: true,
  boxCount: 2,
  boxHold: 850,
  boxSmoothness: 78,
  boxStrength: 72,
  subjectLock: true,
  labelVoice: 'editorial',
  burnLockup: false,
  envelopeEnabled: false,
  opacityStart: 0,
  opacityMid: 100,
  opacityEnd: 0,
  proExport: true,
  exportBitrate: 12,
  silentMaster: false,
};

/** Readable marks and full-frame auto. This is the lab default. */
export const AFL_CONFIG: VisionConfig = {
  ...EDITORIAL_CONFIG,
  overlayOpacity: 100,
  lineWeight: 1.7,
  pointSize: 2.5,
  labelSize: 11,
  underlay: true,
  motionDensity: 48,
};

export const DOCUMENTARY_CONFIG: VisionConfig = {
  ...EDITORIAL_CONFIG,
  threshold: 62,
  detail: 42,
  maxPoints: 22,
  minDistance: 68,
  motionBias: 18,
  motionDensity: 22,
  density: 26,
  chaos: 18,
  connectionDistance: 90,
  connectionAmount: 10,
  labelAmount: 8,
  bracketAmount: 8,
  overlayOpacity: 62,
  lineWeight: 0.7,
  pointSize: 1.5,
  labelSize: 8,
  underlay: false,
  boxesEnabled: false,
  boxCount: 1,
  labelVoice: 'quiet',
};

export const TECH_DEMO_CONFIG: VisionConfig = {
  ...EDITORIAL_CONFIG,
  mode: 'edges',
  threshold: 30,
  detail: 80,
  maxPoints: 90,
  minDistance: 20,
  motionBias: 62,
  motionDensity: 78,
  density: 86,
  chaos: 16,
  connectionDistance: 170,
  connectionAmount: 62,
  labelAmount: 72,
  bracketAmount: 54,
  overlayOpacity: 94,
  lineWeight: 1.15,
  pointSize: 1.8,
  labelSize: 10,
  analysisFPS: 12,
  boxesEnabled: true,
  boxCount: 3,
  labelVoice: 'hud',
};

/** Near-black plate, heavy marks, AFL lockup burned into the export. */
export const AFL_DARK_CONFIG: VisionConfig = {
  ...AFL_CONFIG,
  density: 40,
  chaos: 24,
  connectionAmount: 16,
  labelAmount: 16,
  bracketAmount: 28,
  motionDensity: 36,
  lineWeight: 1.85,
  burnLockup: true,
  labelVoice: 'editorial',
};

export function sanitizeConfig(value: unknown): VisionConfig {
  if (!value || typeof value !== 'object') return { ...AFL_CONFIG };
  const merged = { ...AFL_CONFIG, ...(value as Partial<VisionConfig>) };
  if (!['combined', 'contrast', 'edges', 'bright', 'dark', 'motion'].includes(merged.mode)) {
    merged.mode = 'combined';
  }
  if (!['auto', 'fit', 'fill'].includes(merged.framing)) merged.framing = 'auto';
  if (!['original', 'mono', 'invert', 'contrast'].includes(merged.imageMode)) merged.imageMode = 'original';
  if (!EXPORT_ASPECTS.includes(merged.exportAspect)) merged.exportAspect = 'auto';
  if (!LABEL_VOICES.includes(merged.labelVoice)) merged.labelVoice = 'editorial';
  if (!/^#[0-9a-f]{6}$/i.test(merged.overlayColor)) merged.overlayColor = AFL_CONFIG.overlayColor;
  merged.exportBitrate = Math.max(4, Math.min(24, Math.round(merged.exportBitrate || AFL_CONFIG.exportBitrate)));
  for (const key of Object.keys(AFL_CONFIG) as (keyof VisionConfig)[]) {
    if (typeof merged[key] !== typeof AFL_CONFIG[key]) return { ...AFL_CONFIG };
  }
  return merged;
}
