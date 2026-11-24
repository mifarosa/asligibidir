import { createElement, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { detectDocument } from '../imaging/perspective';
import { createStabilityTracker, scaleQuad } from '../imaging/stability';
import Button from '../ui/Button';
import { layout, text, useColors } from '../ui/theme';

const ANALYSIS_SIDE = 240; // pixels on the longer side of frames used for detection
const ANALYSIS_MS = 200;
const MAX_SIDE = 2400; // same cap as picked photos
const STABLE_COLOR = '#1a9e55';

function frameCanvas(video, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function grabPixels(video, maxSide) {
  const canvas = frameCanvas(video, maxSide);
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  return { data, width: canvas.width, height: canvas.height };
}

// In-app camera with a live page outline. Calls onCapture({ pixels, quad })
// with the full-resolution frame and the detected corners (null if none),
// onCancel when dismissed and onError if the camera can't be opened.
export default function LiveCamera({ onCapture, onCancel, onError }) {
  const c = useColors();
  const window = useWindowDimensions();
  const videoRef = useRef(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [videoSize, setVideoSize] = useState(null);
  const [outline, setOutline] = useState({ quad: null, progress: 0, frame: null });
  const [auto, setAuto] = useState(true);
  const captured = useRef(false);

  // Latest callbacks/settings for the long-lived effects below.
  const live = useRef({});
  live.current = { onCapture, onError, auto };

  const capture = (quadInFrame, frame) => {
    const video = videoRef.current;
    if (!video || captured.current) return;
    captured.current = true;
    const pixels = grabPixels(video, MAX_SIDE);
    const quad = quadInFrame ? scaleQuad(quadInFrame, frame, pixels) : null;
    live.current.onCapture({ pixels, quad });
  };

  // Open the rear camera; stop it when the screen closes.
  useEffect(() => {
    let stream = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        const video = videoRef.current;
        video.srcObject = s;
        video.onloadedmetadata = () => {
          video.play();
          setVideoSize({ width: video.videoWidth, height: video.videoHeight });
        };
      })
      .catch((err) => !cancelled && live.current.onError(err));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Detect the page on small frames and auto-capture once it holds still.
  useEffect(() => {
    if (!videoSize) return undefined;
    const tracker = createStabilityTracker();
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || captured.current) return;
      const frame = grabPixels(video, ANALYSIS_SIDE);
      const result = tracker.update(detectDocument(frame, { size: ANALYSIS_SIDE }), frame, Date.now());
      setOutline({ ...result, frame });
      if (result.stable && live.current.auto) capture(result.quad, frame);
    }, ANALYSIS_MS);
    return () => clearInterval(timer);
  }, [videoSize]);

  const aspect = videoSize ? videoSize.width / videoSize.height : 4 / 3;
  // Fit the column, but keep the controls on screen for portrait cameras.
  const width = Math.min(boxWidth, window.height * 0.65 * aspect);
  const height = width / aspect;
  const toBox = (q) =>
    q.map((p) => `${(p.x / outline.frame.width) * width},${(p.y / outline.frame.height) * height}`);
  const stable = outline.progress >= 1;

  let hint = 'Kamera açılıyor…';
  if (videoSize) {
    if (!outline.quad) hint = 'Belgeyi çerçeveye alın.';
    else if (!auto) hint = 'Belge bulundu. Çekmek için dokunun.';
    else hint = `Sabit tutun… %${Math.round(outline.progress * 100)}`;
  }

  return (
    <View style={layout.section}>
      <Text style={[text.h2, { color: c.text }]}>Kamera</Text>
      <View style={styles.wrap} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
        <View style={[styles.box, { width, height }]}>
          {createElement('video', {
            ref: videoRef,
            autoPlay: true,
            playsInline: true,
            muted: true,
            'aria-label': 'Kamera önizlemesi',
            style: { width: '100%', height: '100%', objectFit: 'fill', display: 'block' },
          })}
          {outline.quad && width > 0 && (
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Polygon
                points={toBox(outline.quad).join(' ')}
                fill={stable ? STABLE_COLOR : c.accent}
                fillOpacity={0.2}
                stroke={stable ? STABLE_COLOR : c.accent}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </View>
      </View>
      <Text style={[text.body, { color: c.muted }]} accessibilityLiveRegion="polite">
        {hint}
      </Text>
      <View style={layout.row}>
        <Button title="Çek" onPress={() => capture(outline.quad, outline.frame)} disabled={!videoSize} />
        <Button
          title={auto ? 'Otomatik çekim: açık' : 'Otomatik çekim: kapalı'}
          onPress={() => setAuto((a) => !a)}
          variant="outline"
        />
        <Button title="Vazgeç" onPress={onCancel} variant="outline" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  box: { backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' },
});
