import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AFL_CONFIG } from '../src/vision/config.ts';
import { analyzeFrame } from '../src/vision/featureAnalyzer.ts';
import { motionWeightedScore } from '../src/vision/motionDensity.ts';
import type { RasterData } from '../src/vision/types.ts';

describe('motionWeightedScore', () => {
  it('leaves the score unchanged when strength is zero', () => {
    assert.equal(motionWeightedScore(0.42, 0.9, 0), 0.42);
    assert.equal(motionWeightedScore(0.42, 0, 0), 0.42);
  });

  it('raises moving cells and quiets a static plate', () => {
    const moving = motionWeightedScore(0.4, 1, 100);
    const still = motionWeightedScore(0.4, 0, 100);
    assert.ok(moving > 0.4);
    assert.ok(still < 0.4);
  });
});

function raster(width: number, height: number, paint: (x: number, y: number) => number): RasterData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = paint(x, y);
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('analyzeFrame motion density', () => {
  it('keeps features on the moving block when density is high', () => {
    const width = 120;
    const height = 80;
    const before = raster(width, height, (x, y) => (x < 36 && y > 20 && y < 60 ? 230 : 30));
    const after = raster(width, height, (x, y) => {
      if (x < 36 && y > 20 && y < 60) return 230;
      if (x > 78 && y > 16 && y < 64) return 230;
      return 30;
    });
    const first = analyzeFrame(before, { ...AFL_CONFIG, motionDensity: 100, threshold: 20, maxPoints: 24, minDistance: 14, detail: 40 }, undefined);
    const second = analyzeFrame(after, { ...AFL_CONFIG, motionDensity: 100, threshold: 20, maxPoints: 24, minDistance: 14, detail: 40, mode: 'combined' }, first.luma);
    assert.ok(second.featureMap.features.length > 0);
    const meanX = second.featureMap.features.reduce((sum, feature) => sum + feature.x, 0) / second.featureMap.features.length;
    assert.ok(meanX > 0.55, `expected marks on the moving side, mean x was ${meanX}`);
  });
});
