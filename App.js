import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { buildVCard, vcardFileName } from './src/contact/vcard';
import { scanToPdf } from './src/export/document';
import useOcr from './src/hooks/useOcr';
import usePageImage from './src/hooks/usePageImage';
import { createPageRenderer } from './src/imaging/pipeline';
import { detectDocument, fullQuad } from './src/imaging/perspective';
import { MODES, modeByKey } from './src/modes';
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
import { currentPage, initialSession, newPage, sessionReducer } from './src/session';
import Button from './src/ui/Button';
import ContactForm from './src/ui/ContactForm';
import CropEditor from './src/ui/CropEditor';
import PageStrip from './src/ui/PageStrip';
import PageView from './src/ui/PageView';
import Segmented from './src/ui/Segmented';
import { layout, text, useColors } from './src/ui/theme';

const timestamp = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

// Decode a picked photo and find the page in it.
async function photoToPage(asset) {
  const pixels = await loadPixels(asset);
  const rendered = await renderPixels(pixels);
  const detected = detectDocument(pixels);
  return newPage({ pixels, rendered }, detected ?? fullQuad(pixels), !!detected);
}

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

  const renderer = useMemo(createPageRenderer, []);
  const page = currentPage(session);
  const filterKey = page?.filter ?? mode.defaultFilter;
  // A business card is a single page; documents and boards can have many.
  const multiPage = !mode.readsContact;
  const hasPages = session.pages.length > 0;
  const editing = session.cropping ? null : page;
  const image = usePageImage(renderer, editing, filterKey, showOriginal);
  const ocr = useOcr(mode.readsContact && editing ? image.final : null);
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

  // `newScan` discards the current pages; otherwise the photo becomes a new page.
  const addPhoto = (source, { newScan }) =>
    run('Görsel yükleniyor…', 'Görsel açılamadı', async () => {
      const asset = await pickImage(source);
      if (!asset) return setNotice('');
      const added = await photoToPage(asset);
      setShowOriginal(false);
      if (newScan) dispatch({ type: 'reset' });
      dispatch({ type: 'addPage', page: added });
      setNotice(
        added.detected
          ? 'Kenarlar bulundu. Köşeleri sürükleyerek düzeltebilirsiniz.'
          : 'Kenarlar bulunamadı. Köşeleri belgenin köşelerine sürükleyin.',
      );
    });

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
              <Button title="Fotoğraf çek" onPress={() => addPhoto('camera', { newScan: true })} />
              <Button
                title="Görsel seç"
                onPress={() => addPhoto('library', { newScan: true })}
                variant="outline"
              />
            </>
          )}
        </View>

        <View style={styles.status} accessibilityLiveRegion="polite">
          {busy && <ActivityIndicator color={c.accent} />}
          <Text style={[text.body, { color: c.muted, flex: 1 }]}>{status}</Text>
        </View>

        {session.cropping && page && (
          <CropEditor
            image={page.source.rendered}
            quad={page.quad}
            onMove={moveCorner}
            onDragChange={setDragging}
            onConfirm={() => finishCrop(false)}
            onUseWhole={() => finishCrop(true)}
          />
        )}

        {multiPage && hasPages && !session.cropping && (
          <PageStrip
            pages={session.pages}
            current={session.current}
            onSelect={(index) => dispatch({ type: 'selectPage', index })}
            onAdd={(source) => addPhoto(source, { newScan: false })}
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

        {multiPage && editing && (
          <View style={layout.row}>
            <Button
              title={`PDF olarak ${shareVerb} (${session.pages.length} sayfa)`}
              onPress={onExportPdf}
              disabled={busy}
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
