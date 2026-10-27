import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// Offline support for the PWA. Skipped in development so the dev server's
// live reload is never served from cache.
if (Platform.OS === 'web' && !__DEV__ && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
