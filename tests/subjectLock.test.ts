import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AFL_DARK_CONFIG, EDITORIAL_CONFIG } from '../src/vision/config.ts';
import { generateFrameOverlay } from '../src/vision/overlayGenerator.ts';
import { PRESETS } from '../src/vision/presets.ts';
import { detectSubjects } from '../src/vision/subjectLock.ts';
import type { RasterData } from '../src/vision/types.ts';

function raster(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): RasterData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

function portrait() {
  return raster(96, 128, (x, y) => {
    const inFace = x >= 28 && x < 68 && y >= 24 && y < 88;
    const leftEye = x >= 34 && x < 44 && y >= 40 && y < 50;
    const rightEye = x >= 52 && x < 62 && y >= 40 && y < 50;
    if (leftEye || rightEye) return [24, 18, 16];
    if (inFace) return [224, 176, 144];
    return [244, 244, 242];
  });
}

describe('detectSubjects', () => {
  it('locks a face and both eyes on a light portrait', () => {
    const marks = detectSubjects(portrait(), null, 'editorial');
    const face = marks.find((mark) => mark.kind === 'face');
    const eyes = marks.filter((mark) => mark.kind === 'eye');
    assert.ok(face, 'expected a face');
    assert.ok(face.x < 0.45 && face.x + face.width > 0.55);
    assert.equal(face.label, 'FACE');
    assert.equal(eyes.length, 2);
    assert.ok(eyes.some((eye) => eye.label === 'EYE L'));
    assert.ok(eyes.some((eye) => eye.label === 'EYE R'));
  });

  it('returns nothing on a blank plate', () => {
    const blank = raster(80, 80, () => [250, 250, 250]);
    assert.deepEqual(detectSubjects(blank, null, 'editorial'), []);
  });

  it('prefers a browser face hint over the chroma blob', () => {
    const marks = detectSubjects(portrait(), [{ x: 0.2, y: 0.1, width: 0.3, height: 0.4 }], 'hud');
    const face = marks.find((mark) => mark.kind === 'face');
    assert.ok(face);
    assert.equal(face.label, 'FACE LOCK');
    assert.equal(face.x, 0.2);
    assert.equal(face.width, 0.3);
  });
});

describe('preset pack', () => {
  it('ships the named looks, including AFL Dark lockup', () => {
    assert.deepEqual(Object.keys(PRESETS), ['Editorial', 'Documentary', 'Tech Demo', 'AFL', 'AFL Dark']);
    assert.equal(PRESETS['AFL Dark'].burnLockup, true);
    assert.equal(PRESETS['AFL Dark'].underlay, true);
    assert.equal(PRESETS.Documentary.labelVoice, 'quiet');
    assert.equal(PRESETS['Tech Demo'].labelVoice, 'hud');
    assert.equal(PRESETS.Editorial.burnLockup, false);
    assert.ok(PRESETS.Documentary.maxPoints < PRESETS['Tech Demo'].maxPoints);
  });
});

describe('generateFrameOverlay subjects', () => {
  it('keeps the face mark when subject lock is on and drops it when lock is off', () => {
    const featureMap = {
      width: 96,
      height: 128,
      averageLuma: 0.8,
      features: [{ x: 0.5, y: 0.4, score: 0.8, contrast: 0.4, edge: 0.4, bright: 0.5, dark: 0.1, motion: 0.2 }],
    };
    const face = detectSubjects(portrait(), null, 'editorial').filter((mark) => mark.kind === 'face');
    const locked = generateFrameOverlay(featureMap, EDITORIAL_CONFIG, 2, 1, [], face);
    const open = generateFrameOverlay(featureMap, { ...EDITORIAL_CONFIG, subjectLock: false }, 2, 1, [], face);
    assert.equal(locked.subjects.length, 1);
    assert.equal(locked.subjects[0]?.label, 'FACE');
    assert.equal(open.subjects.length, 0);
    assert.equal(AFL_DARK_CONFIG.burnLockup, true);
  });
});
