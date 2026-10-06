import type { FaceHint } from './types';

interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface FaceDetectorLike {
  detect: (input: CanvasImageSource) => Promise<DetectedFace[]>;
}

type FaceDetectorCtor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;

let detectorPromise: Promise<FaceDetectorLike | null> | null = null;

function detectorCtor() {
  return (globalThis as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
}

export function faceDetectorAvailable() {
  return typeof detectorCtor() === 'function';
}

export function loadFaceDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const Ctor = detectorCtor();
      if (!Ctor) return null;
      try {
        return new Ctor({ fastMode: true, maxDetectedFaces: 3 });
      } catch {
        return null;
      }
    })();
  }
  return detectorPromise;
}

export async function detectFaceHints(source: CanvasImageSource, width: number, height: number): Promise<FaceHint[] | null> {
  const detector = await loadFaceDetector();
  if (!detector || width < 2 || height < 2) return null;
  try {
    const faces = await detector.detect(source);
    return faces.map((face) => ({
      x: face.boundingBox.x / width,
      y: face.boundingBox.y / height,
      width: face.boundingBox.width / width,
      height: face.boundingBox.height / height,
    }));
  } catch {
    return null;
  }
}
