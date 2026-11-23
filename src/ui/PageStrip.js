import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import { layout, text, useColors } from './theme';

const THUMB = 64;

// Thumbnails of the scan's pages with controls to add, remove and switch pages.
export default function PageStrip({ pages, current, onSelect, onAdd, onRemove, disabled }) {
  const c = useColors();
  return (
    <View style={layout.section}>
      <Text style={[text.label, { color: c.text }]}>Sayfalar ({pages.length})</Text>
      <ScrollView horizontal contentContainerStyle={styles.strip} showsHorizontalScrollIndicator={false}>
        {pages.map((p, i) => {
          const selected = i === current;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelect(i)}
              accessibilityRole="button"
              accessibilityLabel={`Sayfa ${i + 1}`}
              accessibilityState={{ selected }}
              style={[
                styles.thumb,
                { borderColor: selected ? c.accent : c.border },
                selected && styles.selected,
              ]}
            >
              <Image source={{ uri: p.source.rendered.uri }} style={styles.image} resizeMode="cover" />
              <Text style={[styles.badge, { backgroundColor: selected ? c.accent : c.muted }]}>{i + 1}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={layout.row}>
        <Button
          title="+ Fotoğraf çek"
          onPress={() => onAdd('camera')}
          variant="outline"
          disabled={disabled}
        />
        <Button
          title="+ Görsel ekle"
          onPress={() => onAdd('library')}
          variant="outline"
          disabled={disabled}
        />
        <Button
          title="Bu sayfayı sil"
          onPress={() => onRemove(current)}
          variant="outline"
          disabled={disabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 8, paddingVertical: 4 },
  thumb: { width: THUMB, height: THUMB * 1.3, borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  selected: { borderWidth: 3 },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    minWidth: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    overflow: 'hidden',
  },
});
