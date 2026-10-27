import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';

import { documentScan, whiteboard } from './src/filters';
import { buildVCard, formatPhoneLine, parseContact, parsePhoneLine, vcardFileName } from './src/vcard';
import {
  exportImage,
  exportVCard,
  loadPixels,
  recognizeText,
  releaseRendered,
  renderPixels,
  shareVerb,
} from './src/platform/scanner';

const MODES = [
  {
    key: 'document',
    label: 'Belge',
    prefix: 'belge',
    hint: 'Gölge ve ışık farklarını giderir, metni yüksek kontrastlı siyah-beyaz yapar.',
  },
  {
    key: 'whiteboard',
    label: 'Beyaz tahta',
    prefix: 'tahta',
    hint: 'Parlamayı ve gölgeyi bastırır, tahtayı beyazlatır, kalem renklerini belirginleştirir.',
  },
  {
    key: 'card',
    label: 'Kartvizit',
    prefix: 'kartvizit',
    hint: 'Kartviziti okur; ad, telefon ve e-postayı ayırıp kişi kartı (.vcf) olarak dışa aktarır.',
  },
];

const EMPTY_FORM = { name: '', title: '', org: '', phones: '', emails: '', urls: '', address: '' };

const FIELDS = [
  { key: 'name', label: 'Ad Soyad' },
  { key: 'title', label: 'Ünvan' },
  { key: 'org', label: 'Kurum' },
  { key: 'phones', label: 'Telefonlar', note: 'her satıra bir numara; "Cep:", "İş:" veya "Faks:" ile başlayabilir', lines: 3 },
  { key: 'emails', label: 'E-postalar', note: 'her satıra bir adres', lines: 2, keyboard: 'email-address' },
  { key: 'urls', label: 'Web', note: 'her satıra bir adres', lines: 1, keyboard: 'url' },
  { key: 'address', label: 'Adres', lines: 2 },
];

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

function contactToForm(c) {
  return {
    name: c.name,
    title: c.title,
    org: c.org,
    phones: c.phones.map(formatPhoneLine).join('\n'),
    emails: c.emails.join('\n'),
    urls: c.urls.join('\n'),
    address: c.address,
  };
}

function formToContact(f) {
  const lines = (v) => v.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    name: f.name.trim(),
    title: f.title.trim(),
    org: f.org.trim(),
    phones: lines(f.phones).map(parsePhoneLine),
    emails: lines(f.emails),
    urls: lines(f.urls),
    address: f.address.trim(),
  };
}

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
}

// Keeps the latest rendered image and frees the previous one (blob URL/cache file).
function useRendered() {
  const [rendered, setRendered] = useState(null);
  const ref = useRef(null);
  const update = useCallback((next) => {
    if (ref.current && ref.current !== next) releaseRendered(ref.current);
    ref.current = next;
    setRendered(next);
  }, []);
  useEffect(() => () => releaseRendered(ref.current), []);
  return [rendered, update];
}

export default function App() {
  const dark = useColorScheme() === 'dark';
  const c = dark ? COLORS.dark : COLORS.light;

  const [mode, setMode] = useState('document');
  const [original, setOriginal] = useState(null); // { pixels, rendered }
  const [processed, setProcessed] = useState(null); // pixels
  const [rendered, setRendered] = useRendered();
  const [showOriginal, setShowOriginal] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [ocrText, setOcrText] = useState('');
  const [showOcr, setShowOcr] = useState(false);
  // Bumped on every new input so slow work (filtering, OCR) can't overwrite newer results.
  const runRef = useRef(0);

  const modeInfo = MODES.find((m) => m.key === mode);

  useEffect(() => {
    if (!original) return;
    const run = ++runRef.current;
    let cancelled = false;
    const isStale = () => cancelled || run !== runRef.current;

    (async () => {
      setBusy(true);
      setStatus('İşleniyor…');
      await nextTick();
      try {
        // Business cards are OCR'd from the clean grayscale version as well.
        const pixels = mode === 'whiteboard' ? whiteboard(original.pixels) : documentScan(original.pixels);
        const view = await renderPixels(pixels);
        if (isStale()) return releaseRendered(view);
        setProcessed(pixels);
        setRendered(view);
        setStatus('');

        if (mode === 'card') {
          setForm(EMPTY_FORM);
          setOcrText('');
          const text = await recognizeText(pixels, view, (msg) => !isStale() && setStatus(msg));
          if (isStale()) return;
          setOcrText(text);
          setForm(contactToForm(parseContact(text)));
          setStatus('Bilgileri kontrol edin.');
        }
      } catch (err) {
        console.error(err);
        if (isStale()) return;
        setStatus(
          mode === 'card'
            ? `OCR başarısız: ${err.message}. Bilgileri elle girebilirsiniz.`
            : `İşlem başarısız: ${err.message}`,
        );
      } finally {
        if (!isStale()) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [original, mode, setRendered]);

  const pick = async (source) => {
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setStatus('Kamera izni verilmedi.');
          return;
        }
      }
      const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await launch({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets?.length) return;
      setBusy(true);
      setStatus('Görsel yükleniyor…');
      const asset = result.assets[0];
      const pixels = await loadPixels(asset);
      releaseRendered(original?.rendered);
      setShowOriginal(false);
      setOriginal({ pixels, rendered: await renderPixels(pixels) });
    } catch (err) {
      console.error(err);
      setBusy(false);
      setStatus(`Görsel açılamadı: ${err.message}`);
    }
  };

  const onExportImage = async () => {
    try {
      await exportImage(rendered, `${modeInfo.prefix}-${timestamp()}`);
    } catch (err) {
      setStatus(`Dışa aktarılamadı: ${err.message}`);
    }
  };

  const onExportVCard = async () => {
    try {
      const contact = formToContact(form);
      await exportVCard(buildVCard(contact), vcardFileName(contact));
    } catch (err) {
      setStatus(`Kişi kartı oluşturulamadı: ${err.message}`);
    }
  };

  const shown = showOriginal ? original?.rendered : rendered;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.text }]}>Aslı Gibidir</Text>
        <Text style={[styles.muted, { color: c.muted }]}>Belge, beyaz tahta ve kartvizit tarayıcı</Text>

        <Text style={[styles.label, { color: c.text }]}>Mod</Text>
        <View style={styles.modes} accessibilityRole="radiogroup">
          {MODES.map((m) => {
            const selected = m.key === mode;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[
                  styles.mode,
                  { backgroundColor: c.surface, borderColor: selected ? c.accent : c.border },
                  selected && { borderWidth: 2 },
                ]}
              >
                <Text style={[styles.modeText, { color: c.text }, selected && styles.bold]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.muted, { color: c.muted }]}>{modeInfo.hint}</Text>

        <View style={styles.row}>
          <Button title="Fotoğraf çek" onPress={() => pick('camera')} colors={c} />
          <Button title="Görsel seç" onPress={() => pick('library')} colors={c} variant="outline" />
        </View>

        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          {busy && <ActivityIndicator color={c.accent} />}
          <Text style={[styles.muted, { color: c.muted, flex: 1 }]}>{status}</Text>
        </View>

        {shown && (
          <View>
            <View style={styles.switchRow}>
              <Switch value={showOriginal} onValueChange={setShowOriginal} />
              <Text style={{ color: c.text }}>Orijinali göster</Text>
            </View>
            <Image
              source={{ uri: shown.uri }}
              style={[styles.preview, { aspectRatio: shown.width / shown.height, borderColor: c.border }]}
              resizeMode="contain"
              accessibilityLabel={showOriginal ? 'Orijinal görüntü' : 'İşlenmiş görüntü'}
            />
            <View style={styles.row}>
              <Button
                title={`Görüntüyü ${shareVerb}`}
                onPress={onExportImage}
                disabled={!rendered || !processed}
                colors={c}
              />
            </View>
          </View>
        )}

        {mode === 'card' && original && (
          <View>
            <Text style={[styles.h2, { color: c.text }]}>Kişi bilgileri</Text>
            <Text style={[styles.muted, { color: c.muted }]}>
              OCR sonucunu kontrol edip düzeltin, ardından kişi kartını dışa aktarın.
            </Text>
            {FIELDS.map((f) => (
              <View key={f.key} style={styles.field}>
                <Text style={[styles.label, { color: c.text }]}>
                  {f.label}
                  {f.note ? <Text style={[styles.note, { color: c.muted }]}> ({f.note})</Text> : null}
                </Text>
                <TextInput
                  value={form[f.key]}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                  multiline={!!f.lines && f.lines > 1}
                  numberOfLines={f.lines ?? 1}
                  keyboardType={f.keyboard ?? 'default'}
                  autoCapitalize={f.keyboard ? 'none' : 'words'}
                  autoCorrect={false}
                  style={[
                    styles.input,
                    { color: c.text, backgroundColor: c.surface, borderColor: c.border },
                    f.lines > 1 && { minHeight: 22 * f.lines + 16, textAlignVertical: 'top' },
                  ]}
                />
              </View>
            ))}
            <View style={styles.row}>
              <Button title={`Kişi kartını ${shareVerb} (.vcf)`} onPress={onExportVCard} colors={c} />
            </View>
            {!!ocrText && (
              <View style={styles.field}>
                <Pressable onPress={() => setShowOcr((v) => !v)} accessibilityRole="button">
                  <Text style={[styles.label, { color: c.accent }]}>
                    {showOcr ? '▾' : '▸'} Ham OCR metni
                  </Text>
                </Pressable>
                {showOcr && (
                  <Text selectable style={[styles.pre, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}>
                    {ocrText}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Button({ title, onPress, disabled, colors, variant = 'solid' }) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        solid ? { backgroundColor: colors.accent } : { borderWidth: 1, borderColor: colors.accent },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
      ]}
    >
      <Text style={[styles.buttonText, { color: solid ? colors.accentText : colors.accent }]}>{title}</Text>
    </Pressable>
  );
}

const COLORS = {
  light: {
    bg: '#f6f7f9',
    surface: '#ffffff',
    text: '#1c2024',
    muted: '#5d6670',
    border: '#d9dde2',
    accent: '#1f6feb',
    accentText: '#ffffff',
  },
  dark: {
    bg: '#111418',
    surface: '#1a1f25',
    text: '#e6e9ec',
    muted: '#9aa4ae',
    border: '#2d343c',
    accent: '#4c8dff',
    accentText: '#0b0e12',
  },
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 24 : 64,
    paddingBottom: 48,
    gap: 8,
  },
  h1: { fontSize: 26, fontWeight: '700' },
  h2: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  muted: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  note: { fontWeight: '400' },
  bold: { fontWeight: '700' },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mode: {
    flexGrow: 1,
    flexBasis: 100,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeText: { fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  preview: { width: '100%', borderWidth: 1, borderRadius: 8, backgroundColor: '#fff' },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, flexGrow: 1, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  field: { gap: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  pre: { borderWidth: 1, borderRadius: 8, padding: 12, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});
