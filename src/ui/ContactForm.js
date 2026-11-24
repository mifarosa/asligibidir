import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { contactToForm, EMPTY_FORM, formToContact } from '../contact/form';
import { parseContact } from '../contact/vcard';
import Button from './Button';
import { layout, text, useColors } from './theme';

const FIELDS = [
  { key: 'name', label: 'Ad Soyad' },
  { key: 'title', label: 'Ünvan' },
  { key: 'org', label: 'Kurum' },
  {
    key: 'phones',
    label: 'Telefonlar',
    note: 'her satıra bir numara; "Cep:", "İş:" veya "Faks:" ile başlayabilir',
    lines: 3,
  },
  { key: 'emails', label: 'E-postalar', note: 'her satıra bir adres', lines: 2, keyboard: 'email-address' },
  { key: 'urls', label: 'Web', note: 'her satıra bir adres', lines: 1, keyboard: 'url' },
  { key: 'address', label: 'Adres', lines: 2 },
];

// Editable contact fields, pre-filled from OCR text. Once the user edits a
// field, new OCR results (e.g. after rotating) no longer overwrite the form;
// they can be pulled in explicitly instead.
export default function ContactForm({ ocrText, onExport, exportLabel }) {
  const c = useColors();
  const [form, setForm] = useState(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const fillFromOcr = () => {
    setForm(ocrText ? contactToForm(parseContact(ocrText)) : EMPTY_FORM);
    setDirty(false);
  };

  useEffect(() => {
    if (!dirty) fillFromOcr();
    // Only new OCR text refills the form; edits must not trigger it.
  }, [ocrText]);

  const change = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  return (
    <View style={layout.section}>
      <Text style={[text.h2, { color: c.text, marginTop: 8 }]}>Kişi bilgileri</Text>
      <Text style={[text.body, { color: c.muted }]}>
        OCR sonucunu kontrol edip düzeltin, ardından kişi kartını dışa aktarın.
      </Text>

      {FIELDS.map((f) => (
        <View key={f.key} style={styles.field}>
          <Text style={[text.label, { color: c.text }]}>
            {f.label}
            {f.note ? <Text style={[styles.note, { color: c.muted }]}> ({f.note})</Text> : null}
          </Text>
          <TextInput
            value={form[f.key]}
            onChangeText={(v) => change(f.key, v)}
            multiline={(f.lines ?? 1) > 1}
            numberOfLines={f.lines ?? 1}
            keyboardType={f.keyboard ?? 'default'}
            autoCapitalize={f.keyboard ? 'none' : 'words'}
            autoCorrect={false}
            accessibilityLabel={f.label}
            style={[
              styles.input,
              { color: c.text, backgroundColor: c.surface, borderColor: c.border },
              (f.lines ?? 1) > 1 && { minHeight: 22 * f.lines + 16, textAlignVertical: 'top' },
            ]}
          />
        </View>
      ))}

      <View style={layout.row}>
        <Button title={exportLabel} onPress={() => onExport(formToContact(form))} />
        {dirty && !!ocrText && (
          <Button title="OCR'dan yeniden doldur" onPress={fillFromOcr} variant="outline" />
        )}
      </View>

      {!!ocrText && (
        <View style={styles.field}>
          <Pressable onPress={() => setShowRaw((v) => !v)} accessibilityRole="button">
            <Text style={[text.label, { color: c.accent }]}>{showRaw ? '▾' : '▸'} Ham OCR metni</Text>
          </Pressable>
          {showRaw && (
            <Text
              selectable
              style={[
                styles.raw,
                text.mono,
                { color: c.text, backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              {ocrText}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4, marginTop: 4 },
  note: { fontWeight: '400' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  raw: { borderWidth: 1, borderRadius: 8, padding: 12 },
});
