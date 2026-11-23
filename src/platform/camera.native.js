// Native camera: the platform's own document scanner (VisionKit on iOS, ML Kit
// on Android) does live edge detection, auto-capture, cropping and multi-page
// scanning, so the app hands the whole capture step to it.
import { CameraView } from 'expo-camera';

export const LiveCamera = null;

// 'system-scanner' when the OS scanner exists, otherwise the plain camera.
export function cameraStrategy() {
  return CameraView.isDocumentScannerAvailable ? 'system-scanner' : 'picker';
}

// Resolves to [{ uri }] of cropped, straightened pages, or null if cancelled.
export async function scanDocuments() {
  const result = await CameraView.scanDocumentAsync({ quality: 0.95 });
  return result ? result.pages.map((uri) => ({ uri })) : null;
}
