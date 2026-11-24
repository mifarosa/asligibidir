import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from './theme';

export default function Button({ title, onPress, disabled, variant = 'solid', accessibilityLabel }) {
  const c = useColors();
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        solid ? { backgroundColor: c.accent } : { borderWidth: 1, borderColor: c.accent },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
      ]}
    >
      <Text style={[styles.text, { color: solid ? c.accentText : c.accent }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, flexGrow: 1, alignItems: 'center' },
  text: { fontSize: 15, fontWeight: '600' },
});
