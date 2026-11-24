// Web camera: the in-app LiveCamera (getUserMedia) when the browser allows
// it, otherwise the file input's camera capture.
export { default as LiveCamera } from './LiveCamera.web';

export function cameraStrategy() {
  return typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia ? 'live' : 'picker';
}

export async function scanDocuments() {
  throw new Error('Sistem belge tarayıcısı web’de yok');
}
