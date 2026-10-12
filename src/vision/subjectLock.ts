import type { FaceHint, LabelVoice, RasterData, SubjectKind, SubjectMark } from './types';

const CELL = 8;

function isSkin(r: number, g: number, b: number) {
  const y = r * 0.299 + g * 0.587 + b * 0.114;
  const cb = 128 - r * 0.168736 - g * 0.331264 + b * 0.5;
  const cr = 128 + r * 0.5 - g * 0.418688 - b * 0.081312;
  return y > 40 && cb > 77 && cb < 127 && cr > 133 && cr < 173;
}

interface Blob {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cells: number;
  skin: number;
}

function skinBlobs(raster: RasterData) {
  const { width, height, data } = raster;
  const cols = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);
  const skinRatio = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      let skin = 0;
      let count = 0;
      const x0 = cx * CELL;
      const y0 = cy * CELL;
      for (let y = y0; y < y0 + CELL; y += 2) {
        for (let x = x0; x < x0 + CELL; x += 2) {
          const index = (y * width + x) * 4;
          if (isSkin(data[index], data[index + 1], data[index + 2])) skin += 1;
          count += 1;
        }
      }
      skinRatio[cy * cols + cx] = count ? skin / count : 0;
    }
  }

  const seen = new Uint8Array(cols * rows);
  const blobs: Blob[] = [];
  const stack: number[] = [];
  for (let start = 0; start < skinRatio.length; start += 1) {
    if (seen[start] || skinRatio[start] < 0.42) continue;
    seen[start] = 1;
    stack.push(start);
    const blob: Blob = {
      minX: start % cols,
      minY: Math.floor(start / cols),
      maxX: start % cols,
      maxY: Math.floor(start / cols),
      cells: 0,
      skin: 0,
    };
    while (stack.length) {
      const index = stack.pop() as number;
      const cx = index % cols;
      const cy = Math.floor(index / cols);
      blob.cells += 1;
      blob.skin += skinRatio[index];
      blob.minX = Math.min(blob.minX, cx);
      blob.minY = Math.min(blob.minY, cy);
      blob.maxX = Math.max(blob.maxX, cx);
      blob.maxY = Math.max(blob.maxY, cy);
      const neighbors = [index - 1, index + 1, index - cols, index + cols];
      for (const next of neighbors) {
        if (next < 0 || next >= skinRatio.length || seen[next] || skinRatio[next] < 0.42) continue;
        const nx = next % cols;
        const ny = Math.floor(next / cols);
        if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    blobs.push(blob);
  }
  return blobs;
}

function blobToMark(blob: Blob, raster: RasterData, kind: SubjectKind, label: string, score: number): SubjectMark {
  const x = (blob.minX * CELL) / raster.width;
  const y = (blob.minY * CELL) / raster.height;
  const width = ((blob.maxX - blob.minX + 1) * CELL) / raster.width;
  const height = ((blob.maxY - blob.minY + 1) * CELL) / raster.height;
  return {
    kind,
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0.02, Math.min(1, width)),
    height: Math.max(0.02, Math.min(1, height)),
    score,
    label,
  };
}

function subjectCopy(kind: SubjectKind, voice: LabelVoice, side?: 'L' | 'R') {
  switch (voice) {
    case 'hud':
      if (kind === 'face') return 'FACE LOCK';
      if (kind === 'eye') return side === 'L' ? 'EYE L' : 'EYE R';
      if (kind === 'hand') return 'HAND';
      return 'SUBJ';
    case 'quiet':
      if (kind === 'face') return 'SUBJ';
      if (kind === 'eye') return 'EYE';
      if (kind === 'hand') return 'HAND';
      return 'SUBJ';
    case 'editorial':
      if (kind === 'face') return 'FACE';
      if (kind === 'eye') return side === 'L' ? 'EYE L' : 'EYE R';
      if (kind === 'hand') return 'HAND';
      return 'SUBJ';
    default: {
      const unreachable: never = voice;
      return unreachable;
    }
  }
}

function lumaAt(raster: RasterData, x: number, y: number) {
  const px = Math.max(0, Math.min(raster.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(raster.height - 1, Math.round(y)));
  const index = (py * raster.width + px) * 4;
  return raster.data[index] * 0.2126 + raster.data[index + 1] * 0.7152 + raster.data[index + 2] * 0.0722;
}

function windowLuma(raster: RasterData, x: number, y: number, w: number, h: number) {
  let sum = 0;
  let count = 0;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(raster.width, Math.ceil(x + w));
  const y1 = Math.min(raster.height, Math.ceil(y + h));
  for (let py = y0; py < y1; py += 2) {
    for (let px = x0; px < x1; px += 2) {
      sum += lumaAt(raster, px, py);
      count += 1;
    }
  }
  return count ? sum / count : 255;
}

function findEyes(raster: RasterData, face: SubjectMark, voice: LabelVoice): SubjectMark[] {
  const x = face.x * raster.width;
  const y = face.y * raster.height;
  const w = face.width * raster.width;
  const h = face.height * raster.height;
  const faceMean = windowLuma(raster, x, y, w, h);
  const winW = Math.max(4, w * 0.16);
  const winH = Math.max(3, h * 0.1);
  const bandTop = y + h * 0.22;
  const bandBottom = y + h * 0.5;
  const eyes: SubjectMark[] = [];
  const halves: { side: 'L' | 'R'; x0: number; x1: number }[] = [
    { side: 'L', x0: x + w * 0.12, x1: x + w * 0.48 },
    { side: 'R', x0: x + w * 0.52, x1: x + w * 0.88 },
  ];
  for (const half of halves) {
    let best = 255;
    let bestX = half.x0;
    let bestY = bandTop;
    for (let py = bandTop; py < bandBottom - winH; py += 2) {
      for (let px = half.x0; px < half.x1 - winW; px += 2) {
        const value = windowLuma(raster, px, py, winW, winH);
        if (value < best) {
          best = value;
          bestX = px;
          bestY = py;
        }
      }
    }
    if (faceMean - best < 14) continue;
    eyes.push({
      kind: 'eye',
      x: bestX / raster.width,
      y: bestY / raster.height,
      width: winW / raster.width,
      height: winH / raster.height,
      score: Math.min(1, (faceMean - best) / 80),
      label: subjectCopy('eye', voice, half.side),
    });
  }
  return eyes;
}

function overlaps(a: SubjectMark, b: SubjectMark) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function faceFromHint(hint: FaceHint, voice: LabelVoice): SubjectMark {
  return {
    kind: 'face',
    x: hint.x,
    y: hint.y,
    width: hint.width,
    height: hint.height,
    score: 0.95,
    label: subjectCopy('face', voice),
  };
}

/**
 * Local subject lock. Uses a skin-chroma plate plus any face boxes the browser already detected.
 * Returns nothing when the frame has no plausible face, so the generator keeps its usual placement.
 */
export function detectSubjects(raster: RasterData, hints: readonly FaceHint[] | null, voice: LabelVoice): SubjectMark[] {
  if (raster.width < 16 || raster.height < 16) return [];
  const blobs = skinBlobs(raster);
  const hinted = (hints ?? [])
    .filter((hint) => hint.width > 0.05 && hint.height > 0.05)
    .map((hint) => faceFromHint(hint, voice));

  const faces: SubjectMark[] = hinted.length ? hinted.slice(0, 2) : [];
  if (!faces.length) {
    const candidates = blobs
      .map((blob) => blobToMark(blob, raster, 'face', subjectCopy('face', voice), blob.skin / Math.max(1, blob.cells)))
      .filter((mark) => {
        const aspect = mark.width / Math.max(0.001, mark.height);
        const area = mark.width * mark.height;
        const centerY = mark.y + mark.height / 2;
        return area > 0.02 && area < 0.62 && aspect > 0.45 && aspect < 1.45 && centerY < 0.78;
      })
      .sort((a, b) => b.width * b.height - a.width * a.height);
    if (candidates[0]) faces.push(candidates[0]);
  }
  if (!faces.length) return [];

  const marks: SubjectMark[] = [];
  for (const face of faces) {
    marks.push(face);
    marks.push(...findEyes(raster, face, voice));
  }

  const primary = faces[0];
  const hands = blobs
    .map((blob) => blobToMark(blob, raster, 'hand', subjectCopy('hand', voice), blob.skin / Math.max(1, blob.cells)))
    .filter((mark) => {
      const area = mark.width * mark.height;
      const centerY = mark.y + mark.height / 2;
      return area > 0.008 && area < 0.18 && centerY > primary.y + primary.height * 0.55 && !overlaps(mark, primary);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  marks.push(...hands);
  return marks;
}
