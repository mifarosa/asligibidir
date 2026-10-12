# Aslı Gibidir

Tarayıcıda çalışan belge, beyaz tahta ve kartvizit tarayıcı. Görüntüler cihazda
işlenir; sunucuya yüklenmez. Microsoft Lens'in kapanmasıyla Copilot uygulamasında
karşılığı kalmayan modları sunar.

## Modlar

| Mod | Ne yapar |
| --- | --- |
| **Belge** | Işık farklarını ve gölgeyi giderir, metni yüksek kontrastlı gri tonlamaya çevirir. |
| **Beyaz tahta** | Parlamayı ve gölgeyi bastırır, tahta yüzeyini beyaza çeker, kalem çizgilerini koyulaştırır, renkli kalemleri belirginleştirir. |
| **Kartvizit** | OCR (Tesseract.js, Türkçe + İngilizce) ile kartı okur; ad, ünvan, kurum, telefon (cep/iş/faks), e-posta, web ve adresi ayırır. Alanlar düzeltilebilir ve `.vcf` kişi kartı olarak indirilir. |

### Nasıl çalışıyor

- **Aydınlatma düzeltme** (`src/filters.js`): Görüntü bloklara ayrılır; her bloğun
  parlaklık yüzdeliği (%90) çıplak yüzeyin tahmini parlaklığı olarak alınır.
  Bu kaba ızgara yumuşatılıp tam çözünürlüğe büyütülür ve her piksel bu arka plana
  bölünür. Böylece parlama ve gölge eşitlenir; ardından seviye/gama ile kontrast açılır.
- **Kartvizit ayrıştırma** (`src/vcard.js`): E-posta, web ve telefonlar düzenli
  ifadelerle; ad, ünvan, kurum ve adres satır sezgileriyle bulunur. Türkiye cep
  numaraları (5xx) otomatik olarak "Cep" etiketi alır. Çıktı, RFC 2426 kaçışlı ve
  satır katlamalı vCard 3.0'dır.

## Çalıştırma

Derleme adımı yok. Statik bir sunucu yeterli (ES modülleri `file://` üzerinden çalışmaz):

```sh
npm start          # http://localhost:8080
```

Kartvizit modu, OCR kütüphanesini ve dil verilerini ilk kullanımda jsDelivr
CDN'inden indirir (internet bağlantısı gerekir).

## Testler

```sh
npm test
```

## Sonraki adımlar

- Belge kenarı algılama ve perspektif düzeltme (kırpma)
- Çok sayfalı PDF dışa aktarma
- Çevrimdışı kullanım için service worker ve PWA manifesti
- Word/OneNote dışa aktarma, sesli okuma
