import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { formatDate } from '../history';
import { modeByKey } from '../modes';
import Button from './Button';
import { layout, text, useColors } from './theme';

// Saved scans with open / PDF / delete. Deleting asks for a second tap.
export default function HistoryList({ scans, onOpen, onPdf, onDelete, pdfLabel, disabled }) {
  const c = useColors();
  const [confirming, setConfirming] = useState(null);

  if (!scans.length) {
    return (
      <View style={layout.section}>
        <Text style={[text.h2, { color: c.text }]}>Geçmiş</Text>
        <Text style={[text.body, { color: c.muted }]}>
          Kaydettiğiniz taramalar burada görünür. Taramalar yalnızca bu cihazda saklanır.
        </Text>
      </View>
    );
  }

  return (
    <View style={layout.section}>
      <Text style={[text.h2, { color: c.text }]}>Geçmiş</Text>
      {scans.map((scan) => (
        <View
          key={scan.id}
          style={[styles.item, { backgroundColor: c.surface, borderColor: c.border }]}
          accessibilityLabel={scan.title}
        >
          <Image source={{ uri: scan.thumb }} style={[styles.thumb, { borderColor: c.border }]} />
          <View style={styles.body}>
            <Text style={[text.label, { color: c.text }]} numberOfLines={1}>
              {modeByKey(scan.mode).label}
            </Text>
            <Text style={[text.body, { color: c.muted }]}>
              {formatDate(scan.createdAt)} · {scan.pages.length} sayfa
            </Text>
            <View style={styles.actions}>
              <Button title="Aç" onPress={() => onOpen(scan)} disabled={disabled} />
              <Button title={pdfLabel} onPress={() => onPdf(scan)} variant="outline" disabled={disabled} />
              {confirming === scan.id ? (
                <Button
                  title="Eminim, sil"
                  onPress={() => {
                    setConfirming(null);
                    onDelete(scan);
                  }}
                  disabled={disabled}
                />
              ) : (
                <Button
                  title="Sil"
                  onPress={() => setConfirming(scan.id)}
                  variant="outline"
                  disabled={disabled}
                />
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12, padding: 10, borderWidth: 1, borderRadius: 10 },
  thumb: { width: 64, height: 84, borderRadius: 6, borderWidth: 1, backgroundColor: '#fff' },
  body: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
