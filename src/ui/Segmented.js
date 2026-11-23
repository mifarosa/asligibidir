import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from './theme';

// A row of mutually exclusive options (radio group). `options` is
// [{ key, label }]; `compact` uses smaller buttons for toolbars.
export default function Segmented({ options, value, onChange, accessibilityLabel, compact }) {
  const c = useColors();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[
              styles.option,
              compact && styles.compact,
              { backgroundColor: c.surface, borderColor: selected ? c.accent : c.border },
              selected && styles.selected,
            ]}
          >
            <Text
              style={[styles.text, compact && styles.compactText, { color: c.text }, selected && styles.bold]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    flexGrow: 1,
    flexBasis: 100,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { flexBasis: 64, paddingVertical: 7, paddingHorizontal: 8 },
  selected: { borderWidth: 2 },
  text: { fontSize: 15 },
  compactText: { fontSize: 14 },
  bold: { fontWeight: '700' },
});
