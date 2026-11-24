import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Let the user take a photo or choose one. Resolves to the picked asset, or
// null when cancelled. Throws when camera permission is refused.
export async function pickImage(source) {
  if (source === 'camera' && Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Kamera izni verilmedi');
  }
  const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const result = await launch({ mediaTypes: ['images'], quality: 1 });
  return result.canceled ? null : (result.assets?.[0] ?? null);
}
