import { Image, StyleSheet, Switch, Text, View } from 'react-native';
import { SHARPEN_LEVELS } from '../imaging/adjust';
import Button from './Button';
import Segmented from './Segmented';
import { layout, text, useColors } from './theme';

const SHARPEN_OPTIONS = SHARPEN_LEVELS.map(({ key, label }) => ({ key, label }));

// The processed page with its editing tools: original toggle, rotation,
// sharpening, crop and export.
export default function PageView({
  view,
  page,
  showOriginal,
  onShowOriginal,
  onRotate,
  onSharpen,
  onEditCrop,
  onExport,
  exportLabel,
  busy,
}) {
  const c = useColors();
  return (
    <View>
      <View style={styles.switchRow}>
        <Switch value={showOriginal} onValueChange={onShowOriginal} />
        <Text style={[text.body, { color: c.text }]}>Orijinali göster</Text>
      </View>

      <Image
        source={{ uri: view.uri }}
        style={[styles.preview, { aspectRatio: view.width / view.height, borderColor: c.border }]}
        resizeMode="contain"
        accessibilityLabel={showOriginal ? 'Orijinal görüntü' : 'İşlenmiş görüntü'}
      />

      <View style={layout.row}>
        <Button title="⟲ Sola döndür" onPress={() => onRotate(-1)} variant="outline" disabled={busy} />
        <Button title="Sağa döndür ⟳" onPress={() => onRotate(1)} variant="outline" disabled={busy} />
      </View>

      <Text style={[text.label, { color: c.text }]}>Netleştirme</Text>
      <Segmented
        options={SHARPEN_OPTIONS}
        value={page.sharpen}
        onChange={onSharpen}
        accessibilityLabel="Netleştirme"
        compact
      />

      <View style={layout.row}>
        <Button title={exportLabel} onPress={onExport} disabled={busy} />
        <Button title="Köşeleri düzenle" onPress={onEditCrop} variant="outline" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  preview: { width: '100%', borderWidth: 1, borderRadius: 8, backgroundColor: '#fff' },
});
