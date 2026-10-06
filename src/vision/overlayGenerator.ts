import { motionKeepChance } from './motionDensity';
import { createRandom, hashSeed } from './seededRandom';
import type {
  FeatureMap, FrameOverlay, LabelVoice, OverlayConnection, OverlayLabel,
  PersistentBoxRenderData, SubjectMark, VisionConfig,
} from './types';

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function makeLabel(random: () => number, x: number, y: number, score: number, index: number, voice: LabelVoice) {
  switch (voice) {
    case 'quiet':
      return x > 0.5 ? `Y ${y.toFixed(2).replace('0.', '.')}` : `X ${x.toFixed(2).replace('0.', '.')}`;
    case 'hud': {
      const options = [
        `TRK ${String(index).padStart(2, '0')}`,
        `SIG ${score.toFixed(2)}`,
        `NODE ${String(Math.floor(random() * 90)).padStart(2, '0')}`,
        `FOV ${Math.round(40 + random() * 40)}`,
        `LAT ${x.toFixed(3).replace('0.', '.')}`,
        `HUD ${String(Math.floor(random() * 999)).padStart(3, '0')}`,
      ];
      return options[Math.floor(random() * options.length)];
    }
    case 'editorial': {
      const options = [
        `X ${x.toFixed(3).replace('0.', '.')}`,
        `Y ${y.toFixed(3).replace('0.', '.')}`,
        `IDX ${String(index).padStart(3, '0')}`,
        `S ${score.toFixed(2).replace('0.', '.')}`,
        `F ${String(Math.floor(random() * 999)).padStart(3, '0')}`,
        `A${String(Math.floor(random() * 28)).padStart(2, '0')}`,
        `C ${Math.min(0.99, score + random() * 0.12).toFixed(2)}`,
      ];
      return options[Math.floor(random() * options.length)];
    }
    default: {
      const unreachable: never = voice;
      return unreachable;
    }
  }
}

function insideSubject(x: number, y: number, subjects: SubjectMark[]) {
  return subjects.some((subject) => x >= subject.x && x <= subject.x + subject.width && y >= subject.y && y <= subject.y + subject.height);
}

export function generateFrameOverlay(
  featureMap: FeatureMap,
  settings: VisionConfig,
  frameSeed: number,
  frameBucket: number,
  boxes: PersistentBoxRenderData[] = [],
  subjects: SubjectMark[] = [],
): FrameOverlay {
  const locked = settings.subjectLock ? subjects : [];
  const random = createRandom(hashSeed(
    settings.seed, frameSeed, Math.round(settings.chaos), Math.round(settings.density),
    Math.round(settings.connectionAmount), Math.round(settings.labelAmount),
  ));
  const densityChance = 0.18 + settings.density * 0.0075;
  const jitter = (settings.chaos / 100) * 0.009;
  const ordered = [...featureMap.features].sort((a, b) => {
    const aInside = insideSubject(a.x, a.y, locked) ? 1 : 0;
    const bInside = insideSubject(b.x, b.y, locked) ? 1 : 0;
    if (aInside !== bInside) return bInside - aInside;
    return b.score - a.score;
  });
  const selected = ordered
    .filter((feature, index) => {
      const keep = motionKeepChance(densityChance, feature.motion, settings.motionDensity);
      if (settings.motionDensity < 8) return index < 5 || random() < keep;
      return random() < keep;
    })
    .map((feature) => ({
      ...feature,
      x: Math.max(0, Math.min(1, feature.x + (random() - 0.5) * jitter)),
      y: Math.max(0, Math.min(1, feature.y + (random() - 0.5) * jitter)),
    }));

  const anchors = selected.map((feature) => {
    const kindRoll = random();
    const kind = kindRoll < 0.5 ? 'point' : kindRoll < 0.78 ? 'cross' : 'square';
    return {
      ...feature,
      kind: kind as 'point' | 'cross' | 'square',
      size: settings.pointSize * (0.7 + random() * 0.75),
    };
  });

  const lines: OverlayConnection[] = [];
  if (settings.connectionsEnabled) {
    const maximum = settings.connectionDistance / 1000;
    for (let i = 0; i < selected.length; i += 1) {
      let localConnections = 0;
      for (let j = i + 1; j < selected.length; j += 1) {
        const a = selected[i];
        const b = selected[j];
        const distance = Math.hypot(a.x - b.x, (a.y - b.y) * 0.7);
        const motionPair = Math.min(a.motion, b.motion);
        const strength = settings.motionDensity / 100;
        const linkChance = (settings.connectionAmount / 155) * (1 - strength * (1 - motionPair) * 0.85);
        if (distance < maximum && random() < linkChance) {
          lines.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, alpha: 0.35 + random() * 0.45 });
          localConnections += 1;
        }
        if (localConnections >= 2) break;
      }
    }
  }

  const faceLocked = locked.some((subject) => subject.kind === 'face');
  const brackets = selected
    .filter((feature) => {
      const chance = settings.bracketAmount / 170 * (faceLocked && !insideSubject(feature.x, feature.y, locked) ? 0.28 : 1);
      return random() < chance;
    })
    .map((feature) => ({ x: feature.x, y: feature.y, size: 0.014 + random() * 0.018 }));

  const labels: OverlayLabel[] = [];
  const occupied: { x: number; y: number; w: number; h: number }[] = [];
  const candidates = [...selected].sort((a, b) => b.score - a.score);
  for (let index = 0; index < candidates.length; index += 1) {
    const feature = candidates[index];
    if (random() > settings.labelAmount / 145) continue;
    const align = feature.x > 0.72 ? 'right' : 'left';
    const text = makeLabel(random, feature.x, feature.y, feature.score, index, settings.labelVoice);
    const offsetX = (0.012 + random() * 0.016) * (align === 'left' ? 1 : -1);
    const offsetY = (random() - 0.5) * 0.035;
    const width = text.length * settings.labelSize * 0.00065;
    const rect = { x: feature.x + offsetX - (align === 'right' ? width : 0), y: feature.y + offsetY - 0.012, w: width, h: 0.025 };
    const boxCollision = boxes.some((box) => overlaps(rect, { x: box.x, y: box.y, w: box.width, h: box.height }));
    if (!boxCollision && occupied.every((other) => !overlaps(rect, other))) {
      labels.push({ x: feature.x + offsetX, y: feature.y + offsetY, text, align, priority: feature.score });
      occupied.push(rect);
    }
    if (labels.length >= Math.max(2, Math.round(settings.labelAmount / 8))) break;
  }

  return {
    anchors,
    lines,
    labels,
    brackets,
    boxes,
    subjects: locked,
    featureCount: featureMap.features.length,
    frameBucket,
  };
}
