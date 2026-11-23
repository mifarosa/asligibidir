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
  // Picker assets carry their size; others (e.g. system scanner pages) don't,
  // so read it from the decoded image before deciding how far to shrink.
  let ref = await ImageManipulator.manipulate(asset.uri).renderAsync();
  if (Math.max(ref.width, ref.height) > MAX_SIDE) {
    const size = ref.width >= ref.height ? { width: MAX_SIDE } : { height: MAX_SIDE };
    ref = await ImageManipulator.manipulate(ref).resize(size).renderAsync();
  }
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return pixelsFromJpeg(await new File(saved.uri).bytes());
}

// Decode stored JPEG bytes back into pixels.
export async function pixelsFromJpeg(bytes) {
  const { data, width, height } = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width, height };
}

export async function encodeJpeg(img, quality = 0.9) {
  const { data } = jpeg.encode({ data: img.data, width: img.width, height: img.height }, quality * 100);
  return new Uint8Array(data);
}

async function writeJpeg(img, baseName) {
  const file = cacheFile(baseName, 'jpg');
  file.create();
  await file.write(await encodeJpeg(img, 0.92));
  return file;
}

// Turn pixels into something <Image> can display; free it with releaseRendered.
export async function renderPixels(img) {
  const file = await writeJpeg(img, 'tarama');
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

export async function exportImage(img, baseName) {
  const file = await writeJpeg(img, baseName);
  await share(file.uri, 'image/jpeg', 'Görüntüyü paylaş');
}

// Hand a generated file (text or bytes) to the share sheet.
export async function exportFile(content, fileName, mimeType) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  await share(file.uri, mimeType, 'Paylaş');
}

export async function recognizeText(img, onProgress) {
  onProgress?.('Metin okunuyor…');
  const file = await writeJpeg(img, 'ocr');
  try {
    // Native module: missing in Expo Go, available in development/production builds.
    const TextRecognition = require('@react-native-ml-kit/text-recognition').default;
    const result = await TextRecognition.recognize(file.uri);
    return result.text;
  } catch (err) {
    if (/linked|Expo managed/i.test(String(err?.message))) {
      throw new Error('OCR için geliştirme derlemesi gerekiyor (Expo Go desteklemiyor)');
    }
    throw err;
  } finally {
    if (file.exists) file.delete();
  }
}
