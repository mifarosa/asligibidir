import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { buildVCard, vcardFileName } from './src/contact/vcard';
import { scanToPdf } from './src/export/document';
import useHistory from './src/hooks/useHistory';
import useOcr from './src/hooks/useOcr';
import usePageImage from './src/hooks/usePageImage';
import { createPageRenderer } from './src/imaging/pipeline';
import { detectDocument, fullQuad } from './src/imaging/perspective';
import { MODES, modeByKey } from './src/modes';
import { cameraStrategy, LiveCamera, scanDocuments } from './src/platform/camera';
import { pickImage } from './src/platform/picker';
import {
  encodeJpeg,
  exportFile,
  exportImage,
  loadPixels,
  releaseRendered,
  renderPixels,
  shareVerb,
} from './src/platform/scanner';
import { openScan, saveScan, savedScanToPdf } from './src/scanLibrary';
import { currentPage, initialSession, newPage, sessionReducer } from './src/session';
import Button from './src/ui/Button';
import ContactForm from './src/ui/ContactForm';
import CropEditor from './src/ui/CropEditor';
import HistoryList from './src/ui/HistoryList';
import PageStrip from './src/ui/PageStrip';
import PageView from './src/ui/PageView';
import Segmented from './src/ui/Segmented';
import { layout, text, useColors } from './src/ui/theme';

const timestamp = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

// Build a page from pixels, finding the page outline unless one is given.
async function pixelsToPage(pixels, quad = detectDocument(pixels)) {
  const rendered = await renderPixels(pixels);
  return newPage({ pixels, rendered }, quad ?? fullQuad(pixels), !!quad);
}

const cropHint = (page) =>
  page.detected
    ? 'Kenarlar bulundu. Köşeleri sürükleyerek düzeltebilirsiniz.'
    : 'Kenarlar bulunamadı. Köşeleri belgenin köşelerine sürükleyin.';

// Frees display copies and cached renders of pages that left the scan.
function useReleaseRemovedPages(pages, renderer) {
  const previous = useRef([]);
  useEffect(() => {
    const kept = new Set(pages.map((p) => p.source));
    for (const p of previous.current) if (!kept.has(p.source)) releaseRendered(p.source.rendered);
    previous.current = pages;
    renderer.retain(pages.map((p) => p.id));
  }, [pages, renderer]);
}

export default function App() {
  const c = useColors();
  const [modeKey, setModeKey] = useState('document');
  const mode = modeByKey(modeKey);
  const [session, dispatch] = useReducer(sessionReducer, initialSession);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [dragging, setDragging] = useState(false);
  // While set, the in-app camera is open; holds whether its photo starts a new scan.
  const [camera, setCamera] = useState(null);

  const renderer = useMemo(createPageRenderer, []);
  const page = currentPage(session);
  const filterKey = page?.filter ?? mode.defaultFilter;
  // A business card is a single page; documents and boards can have many.
  const multiPage = !mode.readsContact;
  const hasPages = session.pages.length > 0;
  // The page shown in the editor (not while cropping or using the camera).
  const editing = session.cropping || camera ? null : page;
  const image = usePageImage(renderer, editing, filterKey, showOriginal);
  const ocr = useOcr(mode.readsContact && editing ? image.final : null);
  const history = useHistory();
  useReleaseRemovedPages(session.pages, renderer);

  // Run an async action with a progress notice; failures end up in the notice.
  const run = async (progress, failure, task) => {
    setLoading(true);
    setNotice(progress);
    try {
      await task();
    } catch (err) {
      console.error(err);
      setNotice(`${failure}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Add a page to the scan; `newScan` first discards the current pages.
  const addPage = (added, newScan) => {
    setShowOriginal(false);
    if (newScan) dispatch({ type: 'reset' });
    dispatch({ type: 'addPage', page: added });
    setNotice(cropHint(added));
  };

  const fromLibrary = (newScan) =>
    run('Görsel yükleniyor…', 'Görsel açılamadı', async () => {
      const asset = await pickImage('library');
      if (!asset) return setNotice('');
      addPage(await pixelsToPage(await loadPixels(asset)), newScan);
    });

  // The best camera the platform offers: the OS document scanner, the in-app
  // live camera, or the system camera through the picker.
  const fromCamera = (newScan) => {
    const strategy = cameraStrategy();
    if (strategy === 'live') return setCamera({ newScan });
    if (strategy === 'picker') {
      return run('Görsel yükleniyor…', 'Fotoğraf alınamadı', async () => {
        const asset = await pickImage('camera');
        if (!asset) return setNotice('');
        addPage(await pixelsToPage(await loadPixels(asset)), newScan);
      });
    }
    return run('Tarayıcı açılıyor…', 'Tarama başarısız', async () => {
      const scanned = await scanDocuments();
      if (!scanned) return setNotice('');
      const pages = [];
      for (const asset of scanned) {
        const pixels = await loadPixels(asset);
        // The scanner already cropped and straightened each page.
        pages.push(await pixelsToPage(pixels, fullQuad(pixels)));
      }
      setShowOriginal(false);
      if (newScan) dispatch({ type: 'reset' });
      dispatch({ type: 'addPages', pages });
      setNotice('');
    });
  };

  const onCameraCapture = ({ pixels, quad }) => {
    const { newScan } = camera;
    setCamera(null);
    run('İşleniyor…', 'Fotoğraf işlenemedi', async () =>
      addPage(await pixelsToPage(pixels, quad ?? undefined), newScan),
    );
  };

  const onCameraError = (err) => {
    // No permission or no camera: fall back to the system camera / file input.
    console.warn('Live camera unavailable', err);
    const { newScan } = camera;
    setCamera(null);
    run('Görsel yükleniyor…', 'Fotoğraf alınamadı', async () => {
      const asset = await pickImage('camera');
      if (!asset) return setNotice('Kamera açılamadı.');
      addPage(await pixelsToPage(await loadPixels(asset)), newScan);
    });
  };

  const moveCorner = useCallback((index, point) => dispatch({ type: 'moveCorner', index, point }), []);

  const finishCrop = (useWhole) => {
    if (useWhole) dispatch({ type: 'setQuad', quad: fullQuad(page.source.pixels) });
    dispatch({ type: 'finishCrop' });
    setNotice('');
  };

  const editCrop = () => {
    dispatch({ type: 'editCrop' });
    setNotice('Köşeleri sürükleyerek düzeltin.');
  };

  const filterFor = (p) => p.filter ?? mode.defaultFilter;

  const onExportImage = () =>
    run('', 'Dışa aktarılamadı', () => exportImage(image.final, `${mode.prefix}-${timestamp()}`));

  const onExportPdf = () =>
    run('PDF hazırlanıyor…', 'PDF oluşturulamadı', async () => {
      const pdf = await scanToPdf(session.pages, {
        renderPage: (p) => renderer.render(p, filterFor(p)),
        encodeJpeg,
        title: `${mode.label} ${timestamp()}`,
        onProgress: (i, n) => setNotice(`PDF hazırlanıyor… sayfa ${i + 1}/${n}`),
      });
      await exportFile(pdf, `${mode.prefix}-${timestamp()}.pdf`, 'application/pdf');
      setNotice('');
    });

  const onSave = () =>
    run('Kaydediliyor…', 'Kaydedilemedi', async () => {
      const meta = await saveScan(session.pages, {
        mode,
        renderPage: (p) => renderer.render(p, filterFor(p)),
        store: history,
        onProgress: (i, n) => setNotice(`Kaydediliyor… sayfa ${i + 1}/${n}`),
      });
      dispatch({ type: 'markSaved', id: meta.id });
      setNotice('Geçmişe kaydedildi.');
    });

  const onOpenScan = (meta) =>
    run('Açılıyor…', 'Tarama açılamadı', async () => {
      const pages = await openScan(meta, history);
      setShowOriginal(false);
      setModeKey(meta.mode);
      dispatch({ type: 'openScan', pages, id: meta.id });
      setNotice('');
    });

  const onSavedPdf = (meta) =>
    run('PDF hazırlanıyor…', 'PDF oluşturulamadı', async () => {
      const pdf = await savedScanToPdf(meta, history);
      await exportFile(pdf, `${modeByKey(meta.mode).prefix}-${timestamp()}.pdf`, 'application/pdf');
      setNotice('');
    });

  const onDeleteScan = (meta) => run('', 'Silinemedi', () => history.remove(meta));

  const onExportVCard = (contact) =>
    run('', 'Kişi kartı oluşturulamadı', () =>
      exportFile(buildVCard(contact), vcardFileName(contact), 'text/vcard;charset=utf-8'),
    );

  let status = notice;
  let busy = loading;
  if (editing && image.busy) [status, busy] = ['İşleniyor…', true];
  else if (editing && image.error) status = `İşlem başarısız: ${image.error.message}`;
  else if (ocr.busy) [status, busy] = [ocr.progress, true];
  else if (ocr.error) status = `OCR başarısız: ${ocr.error.message}. Bilgileri elle girebilirsiniz.`;
  else if (mode.readsContact && editing && ocr.text) status = 'Bilgileri kontrol edin.';

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragging}
      >
        <Text style={[text.h1, { color: c.text }]}>Aslı Gibidir</Text>
        <Text style={[text.body, { color: c.muted }]}>Belge, beyaz tahta ve kartvizit tarayıcı</Text>

        <Text style={[text.label, { color: c.text, marginTop: 8 }]}>Mod</Text>
        <Segmented options={MODES} value={modeKey} onChange={setModeKey} accessibilityLabel="Mod" />
        <Text style={[text.body, { color: c.muted }]}>{mode.hint}</Text>

        <View style={layout.row}>
          {hasPages ? (
            <Button title="Yeni tarama" onPress={() => dispatch({ type: 'reset' })} variant="outline" />
          ) : (
            <>
              <Button title="Fotoğraf çek" onPress={() => fromCamera(true)} disabled={!!camera} />
              <Button title="Görsel seç" onPress={() => fromLibrary(true)} variant="outline" />
            </>
          )}
        </View>

        <View style={styles.status} accessibilityLiveRegion="polite">
          {busy && <ActivityIndicator color={c.accent} />}
          <Text style={[text.body, { color: c.muted, flex: 1 }]}>{status}</Text>
        </View>

        {camera && LiveCamera && (
          <LiveCamera onCapture={onCameraCapture} onCancel={() => setCamera(null)} onError={onCameraError} />
        )}

        {!camera && session.cropping && page && (
          <CropEditor
            image={page.source.rendered}
            quad={page.quad}
            onMove={moveCorner}
            onDragChange={setDragging}
            onConfirm={() => finishCrop(false)}
            onUseWhole={() => finishCrop(true)}
          />
        )}

        {multiPage && hasPages && editing && (
          <PageStrip
            pages={session.pages}
            current={session.current}
            onSelect={(index) => dispatch({ type: 'selectPage', index })}
            onAdd={(source) => (source === 'camera' ? fromCamera(false) : fromLibrary(false))}
            onRemove={(index) => dispatch({ type: 'removePage', index })}
            disabled={busy}
          />
        )}

        {editing && image.view && (
          <PageView
            view={image.view}
            page={editing}
            filterKey={filterKey}
            showOriginal={showOriginal}
            onShowOriginal={setShowOriginal}
            onFilter={(filter) => dispatch({ type: 'setFilter', filter })}
            onRotate={(turns) => dispatch({ type: 'rotate', turns })}
            onSharpen={(level) => dispatch({ type: 'setSharpen', level })}
            onEditCrop={editCrop}
            onExport={onExportImage}
            exportLabel={`Görüntüyü ${shareVerb}`}
            busy={image.busy}
          />
        )}

        {editing && (
          <View style={layout.row}>
            {multiPage && (
              <Button
                title={`PDF olarak ${shareVerb} (${session.pages.length} sayfa)`}
                onPress={onExportPdf}
                disabled={busy}
              />
            )}
            <Button
              title={session.savedAs ? 'Kaydedildi ✓' : 'Geçmişe kaydet'}
              onPress={onSave}
              disabled={busy || !!session.savedAs}
              variant="outline"
            />
          </View>
        )}

        {mode.readsContact && editing && (
          <ContactForm
            key={editing.id}
            ocrText={ocr.text}
            onExport={onExportVCard}
            exportLabel={`Kişi kartını ${shareVerb} (.vcf)`}
          />
        )}
        {!hasPages && !camera && (
          <HistoryList
            scans={history.scans}
            onOpen={onOpenScan}
            onPdf={onSavedPdf}
            onDelete={onDeleteScan}
            pdfLabel={`PDF ${shareVerb}`}
            disabled={busy}
          />
        )}
      </ScrollView>
    </View>
  );
}

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
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
});
