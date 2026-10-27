// iOS/Android implementation of the platform layer: expo-image-manipulator for
// resizing, jpeg-js for pixel access, the share sheet for export and ML Kit for
// on-device OCR.
import { Buffer } from 'buffer';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import jpeg from 'jpeg-js';

// jpeg-js' encoder returns a Node Buffer, which React Native does not provide.
globalThis.Buffer ??= Buffer;

// Pixel filters run in JS, so keep images smaller than on the web.
const MAX_SIDE = 1600;

export const shareVerb = 'paylaş';

let fileCounter = 0;
function cacheFile(baseName, ext) {
  return new File(Paths.cache, `${baseName}-${Date.now()}-${fileCounter++}.${ext}`);
}

export async function loadPixels(asset) {
  const longest = Math.max(asset.width || 0, asset.height || 0);
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (!longest || longest > MAX_SIDE) {
    ctx.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  const bytes = await new File(saved.uri).bytes();
  const { data, width, height } = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width, height };
}

export async function renderPixels(img) {
  const { data } = jpeg.encode({ data: img.data, width: img.width, height: img.height }, 92);
  const file = cacheFile('tarama', 'jpg');
  file.create();
  await file.write(new Uint8Array(data));
  return { uri: file.uri, width: img.width, height: img.height, file };
}

export function releaseRendered(rendered) {
  try {
    if (rendered?.file?.exists) rendered.file.delete();
  } catch {
    // Cache files are disposable; the OS cleans them up eventually.
  }
}

async function share(uri, mimeType, dialogTitle) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda paylaşım kullanılamıyor');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

export async function exportImage(rendered, baseName) {
  const file = cacheFile(baseName, 'jpg');
  await rendered.file.copy(file);
  await share(file.uri, 'image/jpeg', 'Görüntüyü paylaş');
}

export async function exportVCard(text, fileName) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  await share(file.uri, 'text/vcard', 'Kişi kartını paylaş');
}

export async function recognizeText(_img, rendered, onProgress) {
  onProgress?.('Metin okunuyor…');
  try {
    // Native module: missing in Expo Go, available in development/production builds.
    const TextRecognition = require('@react-native-ml-kit/text-recognition').default;
    const result = await TextRecognition.recognize(rendered.uri);
    return result.text;
  } catch (err) {
    if (/linked|Expo managed/i.test(String(err?.message))) {
      throw new Error('OCR için geliştirme derlemesi gerekiyor (Expo Go desteklemiyor)');
    }
    throw err;
  }
}
