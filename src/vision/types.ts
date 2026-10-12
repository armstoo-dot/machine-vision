export type AnalysisMode = 'combined' | 'contrast' | 'edges' | 'bright' | 'dark' | 'motion';
export type FramingMode = 'auto' | 'fit' | 'fill';
export type ImageMode = 'original' | 'mono' | 'invert' | 'contrast';
export type ExportAspect = 'auto' | '9:16' | '4:5' | '1:1' | '16:9';
export type LabelVoice = 'editorial' | 'quiet' | 'hud';

export interface VisionConfig {
  framing: FramingMode;
  exportAspect: ExportAspect;
  overlayColor: string;
  imageMode: ImageMode;
  mode: AnalysisMode;
  threshold: number;
  detail: number;
  maxPoints: number;
  minDistance: number;
  motionBias: number;
  motionDensity: number;
  density: number;
  chaos: number;
  connectionsEnabled: boolean;
  connectionDistance: number;
  connectionAmount: number;
  labelAmount: number;
  bracketAmount: number;
  overlayOpacity: number;
  lineWeight: number;
  pointSize: number;
  labelSize: number;
  contrastAssist: boolean;
  underlay: boolean;
  analysisFPS: number;
  seed: number;
  boxesEnabled: boolean;
  boxCount: number;
  boxHold: number;
  boxSmoothness: number;
  boxStrength: number;
  subjectLock: boolean;
  labelVoice: LabelVoice;
  burnLockup: boolean;
  envelopeEnabled: boolean;
  opacityStart: number;
  opacityMid: number;
  opacityEnd: number;
  proExport: boolean;
  exportBitrate: number;
  silentMaster: boolean;
}

export interface RasterData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface FeaturePoint {
  x: number;
  y: number;
  score: number;
  contrast: number;
  edge: number;
  bright: number;
  dark: number;
  motion: number;
}

export interface FeatureMap {
  width: number;
  height: number;
  features: FeaturePoint[];
  averageLuma: number;
}

export type AnchorKind = 'point' | 'cross' | 'square';

export interface OverlayAnchor extends FeaturePoint {
  kind: AnchorKind;
  size: number;
}

export interface OverlayConnection {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  alpha: number;
}

export interface OverlayLabel {
  x: number;
  y: number;
  text: string;
  align: 'left' | 'right';
  priority: number;
}

export interface OverlayBracket {
  x: number;
  y: number;
  size: number;
}

export type SubjectKind = 'face' | 'eye' | 'hand' | 'subject';

export interface SubjectMark {
  kind: SubjectKind;
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  label: string;
}

export interface PersistentBoxRenderData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  age: number;
  lastSeen: number;
}

export interface FrameOverlay {
  anchors: OverlayAnchor[];
  lines: OverlayConnection[];
  labels: OverlayLabel[];
  brackets: OverlayBracket[];
  boxes: PersistentBoxRenderData[];
  subjects: SubjectMark[];
  featureCount: number;
  frameBucket: number;
}

export interface FaceHint {
  x: number;
  y: number;
  width: number;
  height: number;
}
