import type { VisionConfig } from './types';

export const DEBUG_VISION = false;
export const STORAGE_KEY = 'afl-machine-vision:v1';

export const EDITORIAL_CONFIG: VisionConfig = {
  framing: 'auto', overlayColor: '#ffffff', imageMode: 'original',
  mode: 'combined', threshold: 45, detail: 55, maxPoints: 48, minDistance: 42,
  motionBias: 25, density: 50, chaos: 65, connectionsEnabled: true,
  connectionDistance: 120, connectionAmount: 28, labelAmount: 24,
  bracketAmount: 22, overlayOpacity: 84, lineWeight: 0.9, pointSize: 2,
  labelSize: 9, contrastAssist: true, underlay: false, analysisFPS: 8, seed: 42,
  boxesEnabled: true, boxCount: 2, boxHold: 850, boxSmoothness: 78,
  boxStrength: 72,
};

/** Readable marks and full-frame auto. This is the lab default. */
export const AFL_CONFIG: VisionConfig = {
  ...EDITORIAL_CONFIG,
  overlayOpacity: 100,
  lineWeight: 1.7,
  pointSize: 2.5,
  labelSize: 11,
  underlay: true,
};

export function sanitizeConfig(value: unknown): VisionConfig {
  if (!value || typeof value !== 'object') return { ...AFL_CONFIG };
  const merged = { ...AFL_CONFIG, ...(value as Partial<VisionConfig>) };
  if (!['combined', 'contrast', 'edges', 'bright', 'dark', 'motion'].includes(merged.mode)) {
    merged.mode = 'combined';
  }
  if (!['auto', 'fit', 'fill'].includes(merged.framing)) merged.framing = 'auto';
  if (!['original', 'mono', 'invert', 'contrast'].includes(merged.imageMode)) merged.imageMode = 'original';
  if (!/^#[0-9a-f]{6}$/i.test(merged.overlayColor)) merged.overlayColor = AFL_CONFIG.overlayColor;
  for (const key of Object.keys(AFL_CONFIG) as (keyof VisionConfig)[]) {
    if (typeof merged[key] !== typeof AFL_CONFIG[key]) return { ...AFL_CONFIG };
  }
  return merged;
}
