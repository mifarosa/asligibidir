# Aslı Gibidir

Belge, beyaz tahta ve kartvizit tarayıcı. Expo (React Native) ile yazıldı;
aynı kod **PWA** (tarayıcıdan "Ana ekrana ekle"), **Android** ve **iOS** olarak
çalışır. Görüntüler cihazda işlenir; sunucuya yüklenmez.

## Kırpma ve perspektif düzeltme

Fotoğraf seçildikten sonra belge (sayfa, kart veya tahta) kenarları otomatik
bulunur ve köşeleri işaretlenir. Köşeler sürüklenerek düzeltilebilir; "Kırp ve
devam et" eğik çekilmiş belgeyi düz bir dikdörtgene çevirir, "Tamamını kullan"
fotoğrafın tamamını alır. Sonuç ekranındaki "Köşeleri düzenle" ile geri dönülebilir.

## Düzenleme

Her sayfa için ayrı ayrı:

- **Filtre:** Orijinal, Renkli (tahta için), Gri (belge için), Siyah-beyaz. Varsayılan, seçili moda göre gelir.
- **Netleştirme:** Kapalı / Hafif / Orta / Güçlü (unsharp mask).
- **Döndürme:** 90° sola veya sağa.
- **Orijinali göster:** Kırpılmış ama filtrelenmemiş hâli.

## Çok sayfalı PDF

Belge ve beyaz tahta modlarında "+ Fotoğraf çek" / "+ Görsel ekle" ile sayfa
eklenir. Sayfalar küçük resimlerden seçilip ayrı ayrı düzenlenebilir ya da
silinebilir. "PDF olarak indir" (mobilde "paylaş") tüm sayfaları tek bir PDF'te
birleştirir. Her sayfa, yönüne uygun (dikey/yatay) bir A4'e oturtulur. PDF,
harici kütüphane olmadan `src/export/pdf.js` ile üretilir: her sayfa JPEG
olarak olduğu gibi gömülür.

## Tarama geçmişi

"Geçmişe kaydet" taramanın bitmiş sayfalarını cihazda saklar (web/PWA'da
tarayıcının IndexedDB'si, mobilde uygulamanın belge klasörü; hiçbir şey sunucuya
gitmez). Başlangıç ekranındaki **Geçmiş** listesinden kayıt açılıp düzenlenebilir,
doğrudan PDF olarak indirilebilir/paylaşılabilir veya silinebilir (silme iki
dokunuş ister). Kayıttan sonra yapılan her düzenleme "Kaydedildi" durumunu
kaldırır, böylece güncel hâl yeniden kaydedilebilir.

## Modlar

| Mod             | Ne yapar                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Belge**       | Işık farklarını ve gölgeyi giderir, metni yüksek kontrastlı gri tonlamaya çevirir.                                                                             |
| **Beyaz tahta** | Parlamayı ve gölgeyi bastırır, tahta yüzeyini beyaza çeker, kalem çizgilerini koyulaştırır, renkli kalemleri belirginleştirir.                                 |
| **Kartvizit**   | OCR ile kartı okur; ad, ünvan, kurum, telefon (cep/iş/faks), e-posta, web ve adresi ayırır. Alanlar düzeltilebilir ve `.vcf` kişi kartı olarak dışa aktarılır. |

## Platform farkları

|               | Web / PWA                                                         | Android / iOS                                                          |
| ------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Görsel alma   | Kamera veya dosya seçici                                          | Kamera veya galeri (`expo-image-picker`)                               |
| Piksel işleme | Canvas                                                            | `expo-image-manipulator` + `jpeg-js` (en uzun kenar 1600 px)           |
| OCR           | Tesseract.js (Türkçe + İngilizce, CDN'den ilk kullanımda iner)    | Google ML Kit, cihaz üstünde (`@react-native-ml-kit/text-recognition`) |
| Dışa aktarma  | Dosya indirme (PNG, `.vcf`)                                       | Paylaşım menüsü (JPEG, `.vcf`)                                         |
| Çevrimdışı    | Service worker: uygulama kabuğu ve OCR dosyaları önbelleğe alınır | Doğal olarak çevrimdışı                                                |

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

## GitHub Actions (CI)

`.github/workflows/ci.yml` her PR'da ve `main`'e her push'ta çalışır:

| İş                         | Ne yapar                                                                                   | Çıktı                                               |
| -------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| **Tests**                  | `npm test`                                                                                 | —                                                   |
| **Web (PWA) build**        | `expo export`; kök yol Pages ayarından okunur (özel alan adında `/`, yoksa `/asligibidir`) | Pages paketi                                        |
| **Deploy to GitHub Pages** | Yalnızca `main`'e push'ta yayınlar                                                         | https://asligibidir.mifarosa.com/                   |
| **Android APK**            | `expo prebuild` + Gradle `assembleRelease` (arm64)                                         | Çalışma sayfasında `asligibidir-android` artifact'ı |

**Bir kerelik ayar:** Repo → _Settings_ → _Pages_ → _Build and deployment_ →
_Source_: **GitHub Actions** seçilmeli. Yoksa yayınlama adımı hata verir.

**APK'yı telefona kurma:** _Actions_ sekmesinde ilgili çalışmayı açın,
_Artifacts_ bölümünden `asligibidir-android` dosyasını indirin, zip'i açın ve
APK'yı telefona aktarıp kurun ("bilinmeyen kaynaklar" izni gerekir). APK
hata ayıklama anahtarıyla imzalıdır: test içindir, Play Store'a yüklenemez.
iOS derlemesi macOS ve Apple geliştirici hesabı gerektirdiği için CI'da yok.

## Kod yapısı

```
App.js                 ekranı oluşturan ince katman (durum + bileşenler)
src/
  session.js           tarama oturumu: sayfalar ve her sayfanın düzenlemeleri (reducer)
  history.js           geçmiş kayıtlarının üst verisi (başlık, tarih)
  scanLibrary.js       taramayı geçmişe kaydetme, geri açma, geçmişten PDF
  modes.js             modlar ve varsayılan filtreleri
  imaging/             saf görüntü işleme (platformdan bağımsız, testli)
    filters.js         aydınlatma düzeltme, gri, siyah-beyaz
    perspective.js     köşe algılama ve perspektif düzeltme
    adjust.js          90° döndürme, netleştirme (unsharp mask)
    pipeline.js        kırp → netleştir → filtre → döndür; aşama aşama önbellekli
  contact/             kartvizit ayrıştırma, vCard ve form dönüşümleri
  export/              PDF yazıcısı ve sayfaları PDF'e dönüştürme
  hooks/               usePageImage (sayfayı işler), useOcr (metni okur), useHistory
  ui/                  bileşenler: CropEditor, PageView, PageStrip, HistoryList, ContactForm, Button, Segmented, tema
  platform/            web/mobil farkları: piksel erişimi, dışa aktarma, OCR, görsel seçici, depolama
```

- **Aydınlatma düzeltme:** Görüntü bloklara ayrılır ve her bloğun %90 parlaklık
  yüzdeliği yüzeyin parlaklığı sayılır. Bu ızgara yumuşatılıp büyütülür, her
  piksel bu arka plana bölünür, ardından seviye/gama ile kontrast açılır.
- **Köşe algılama:** Otsu eşikleme ile en büyük açık renkli bölge bulunur ve
  köşegenlerdeki uç noktaları köşe kabul edilir. Perspektif homografi ile düzeltilir.
- **Netleştirme:** Unsharp mask uygulanır; bulanıklık yarıçapı çözünürlükle ölçeklenir.

Kod biçimi Prettier ile denetlenir: `npm run lint` (CI'da çalışır), düzeltmek için `npm run format`.

## Sonraki adımlar

- Word/OneNote dışa aktarma, sesli okuma
