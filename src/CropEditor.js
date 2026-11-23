import { useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

const HANDLE = 44; // touch target size in px
const CORNER_LABELS = ['Sol üst köşe', 'Sağ üst köşe', 'Sağ alt köşe', 'Sol alt köşe'];

// Shows the photo with the detected page outline and four draggable corners.
// Corner coordinates are in image pixels; `onMove(index, point)` reports drags.
export default function CropEditor({ image, quad, onMove, onDragChange, colors }) {
  const window = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);

  // Fit the photo to the column width, but keep it within ~65% of the screen
  // height so the action buttons stay reachable.
  const maxHeight = window.height * 0.65;
  const aspect = image.width / image.height;
  const width = Math.min(containerWidth, maxHeight * aspect);
  const height = width / aspect;
  const scale = width / image.width;

  // PanResponders are created once; refs give them the current values.
  const live = useRef({});
  live.current = { quad, scale, image, onMove, onDragChange };

  const responders = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        let start = null;
        return PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          // Keep the gesture even if the surrounding ScrollView wants it.
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            start = live.current.quad[i];
            live.current.onDragChange?.(true);
          },
          onPanResponderMove: (_e, g) => {
            const { scale: s, image: img } = live.current;
            if (!start || !s) return;
            const x = Math.min(img.width - 1, Math.max(0, start.x + g.dx / s));
            const y = Math.min(img.height - 1, Math.max(0, start.y + g.dy / s));
            live.current.onMove(i, { x, y });
          },
          onPanResponderRelease: () => live.current.onDragChange?.(false),
          onPanResponderTerminate: () => live.current.onDragChange?.(false),
        });
      }),
    [],
  );

  const points = quad.map((p) => `${p.x * scale},${p.y * scale}`).join(' ');

  return (
    <View style={styles.wrap} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <View style={{ width, height }}>
          <Image source={{ uri: image.uri }} style={{ width, height }} resizeMode="stretch" />
          <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Polygon
              points={points}
              fill={colors.accent}
              fillOpacity={0.15}
              stroke={colors.accent}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {quad.map((p, i) => (
              <Circle
                key={i}
                cx={p.x * scale}
                cy={p.y * scale}
                r={11}
                fill="#ffffff"
                stroke={colors.accent}
                strokeWidth={3}
              />
            ))}
          </Svg>
          {quad.map((p, i) => (
            <View
              key={i}
              {...responders[i].panHandlers}
              accessibilityLabel={CORNER_LABELS[i]}
              style={[
                styles.handle,
                { left: p.x * scale - HANDLE / 2, top: p.y * scale - HANDLE / 2 },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    // Transparent hit area; the visible dot is drawn in the SVG.
    backgroundColor: 'transparent',
    cursor: 'grab',
  },
});
