# Aslı Gibidir

Belge, beyaz tahta ve kartvizit tarayıcı. Expo (React Native) ile yazıldı;
aynı kod **PWA** (tarayıcıdan "Ana ekrana ekle"), **Android** ve **iOS** olarak
çalışır. Görüntüler cihazda işlenir; sunucuya yüklenmez.

## Modlar

| Mod | Ne yapar |
| --- | --- |
| **Belge** | Işık farklarını ve gölgeyi giderir, metni yüksek kontrastlı gri tonlamaya çevirir. |
| **Beyaz tahta** | Parlamayı ve gölgeyi bastırır, tahta yüzeyini beyaza çeker, kalem çizgilerini koyulaştırır, renkli kalemleri belirginleştirir. |
| **Kartvizit** | OCR ile kartı okur; ad, ünvan, kurum, telefon (cep/iş/faks), e-posta, web ve adresi ayırır. Alanlar düzeltilebilir ve `.vcf` kişi kartı olarak dışa aktarılır. |

## Platform farkları

| | Web / PWA | Android / iOS |
| --- | --- | --- |
| Görsel alma | Kamera veya dosya seçici | Kamera veya galeri (`expo-image-picker`) |
| Piksel işleme | Canvas | `expo-image-manipulator` + `jpeg-js` (en uzun kenar 1600 px) |
| OCR | Tesseract.js (Türkçe + İngilizce, CDN'den ilk kullanımda iner) | Google ML Kit, cihaz üstünde (`@react-native-ml-kit/text-recognition`) |
| Dışa aktarma | Dosya indirme (PNG, `.vcf`) | Paylaşım menüsü (JPEG, `.vcf`) |
| Çevrimdışı | Service worker: uygulama kabuğu ve OCR dosyaları önbelleğe alınır | Doğal olarak çevrimdışı |

> **Not:** Mobilde OCR, ML Kit yerel modülü gerektirdiği için **Expo Go'da çalışmaz**;
> geliştirme derlemesi gerekir (`npx expo run:android` / `npx expo run:ios` veya
> `eas build --profile development`). Belge ve beyaz tahta modları Expo Go'da da çalışır.

## Geliştirme

```sh
npm install
npm start          # Expo geliştirme sunucusu (w: web, a: Android, i: iOS)
npm run web        # yalnızca web
npm test           # birim testleri
```

## PWA olarak yayınlama

```sh
npm run build:web  # çıktı: dist/
```

`dist/` klasörü herhangi bir statik sunucuya (Netlify, Vercel, GitHub Pages,
Cloudflare Pages…) olduğu gibi yüklenebilir. PWA kurulumu ve service worker için
HTTPS gerekir (yerel denemede `localhost` da olur). PWA dosyaları `public/`
altındadır:

- `public/index.html` — Expo'nun HTML şablonu (manifest ve ikon bağlantıları)
- `public/manifest.webmanifest` — ad, renkler, ikonlar, `standalone` görünüm
- `public/sw.js` — çevrimdışı önbellek (yalnızca production derlemesinde kaydedilir)
- `public/icons/` — 192/512 px ikonlar ve Apple dokunmatik ikonu

## Kod yapısı

- `App.js` — tek ekranlı arayüz (mod seçimi, önizleme, kişi formu)
- `src/filters.js` — aydınlatma düzeltme: görüntü bloklara ayrılır, her bloğun
  %90 parlaklık yüzdeliği yüzey parlaklığı sayılır; ızgara yumuşatılıp
  büyütülür ve her piksel bu arka plana bölünür. Ardından seviye/gama ile kontrast açılır.
- `src/vcard.js` — kartvizit ayrıştırma (düzenli ifadeler + satır sezgileri,
  Türkiye cep numaralarını tanıma) ve RFC 2426 vCard 3.0 üretimi
- `src/platform/scanner.web.js`, `scanner.native.js` — platforma özel katman;
  Metro, platforma göre doğru dosyayı seçer

## Sonraki adımlar

- Belge kenarı algılama ve perspektif düzeltme (kırpma)
- Çok sayfalı PDF dışa aktarma
- Word/OneNote dışa aktarma, sesli okuma
