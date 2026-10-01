import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import { useRouter } from 'expo-router';

import { BrutalBackButton, BrutalBox, BrutalButton } from '@/components/grammar/Brutal';
import Choice from '@/components/skins/Choice';
import { COLOR_CHOICES, SKIN_ORDER, decorChoices, shapeKey, uniqueShapeChoices } from '@/components/skins/mixChoices';
import { SkinBackdrop, SkinCardFrame, SkinHeader, SkinWord } from '@/components/skins/Slots';
import { previewTextStyle } from '@/components/skins/previewText';
import { PALETTE_FILLS, type FillPaletteId } from '@/constants/GrammarPalettes';
import { SKINS, isSkinId, resolveMode, skinColorsFor, type SkinMix, type SkinMode } from '@/constants/Skins';
import { brutalHeaderRowStyle } from '@/lib/brutalHeader';
import { useGrammarColors } from '@/lib/grammarColors';
import { currentLanguage, t } from '@/lib/i18n';
import { colorsSourceOf, modesOfSource, themeKeyFor } from '@/lib/skinTheme';
import { ThemeContext, useTheme } from '@/lib/ThemeContext';
import { useSkin } from '@/lib/useSkin';

// PLAN-temak 4D: a Saját mix. Négy szekció (Colors / Font / Shape / Decor), mindegyik vízszintesen
// görgethető chip-sor; fölötte az élő előnézet-kártya a minta-szóval. A választás egy piszkozat,
// a "Use this mix" gomb menti (setSkinMix + setSkin('mix')).

function PreviewBody() {
  const g = useGrammarColors();
  const { skin } = useSkin();
  const sample = t().settings.themes;
  return (
    <View testID="mix-preview" style={[styles.preview, { backgroundColor: g.bg }]}>
      <SkinBackdrop />
      <SkinHeader>
        <Text style={[previewTextStyle(skin, 'title', 20), { color: g.ink }]}>kimacha</Text>
      </SkinHeader>
      <SkinCardFrame>
        <BrutalBox boxStyle={styles.previewCard}>
          <SkinWord word={sample.sample} lang={currentLanguage() === 'en' ? 'es' : 'en'}>
            <Text testID="mix-preview-word" style={[previewTextStyle(skin, 'word', 30), { color: g.ink }]}>
              {sample.sample}
            </Text>
          </SkinWord>
          <BrutalBox fill="a" kind="button" offset={2} boxStyle={styles.previewPill}>
            <Text style={[previewTextStyle(skin, 'body', 14), { color: g.onA }]}>{sample.know}</Text>
          </BrutalBox>
        </BrutalBox>
      </SkinCardFrame>
    </View>
  );
}

// Az előnézet a piszkozat-mixszel felülírt kontextusban rajzol, így a téma-komponensek (BrutalBox,
// dísz-helyek) a piszkozatot látják, nem az aktív témát.
function MixPreview({ draft }: { draft: SkinMix }) {
  const ctx = useTheme();
  const { mode } = useSkin();
  const source = colorsSourceOf('mix', draft);
  const previewMode: SkinMode = resolveMode(modesOfSource(source), mode, mode);
  const theme = themeKeyFor(source, previewMode, ctx.grammarPalette);
  return (
    <ThemeContext.Provider value={{ ...ctx, skin: 'mix', skinMix: draft, theme }}>
      <PreviewBody />
    </ThemeContext.Provider>
  );
}

function Section({ title, testID, children }: { title: string; testID: string; children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View testID={testID} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: g.mu }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {children}
      </ScrollView>
    </View>
  );
}

function Dots({ a, b, ink }: { a: string; b: string; ink: string }) {
  return (
    <View style={styles.dots}>
      <View style={[styles.dot, { backgroundColor: a, borderColor: ink }]} />
      <View style={[styles.dot, { backgroundColor: b, borderColor: ink }]} />
    </View>
  );
}

export default function ThemeMixScreen() {
  const router = useRouter();
  const s = t();
  const g = useGrammarColors();
  const { skinMix, setSkinMix, setSkin } = useTheme();
  const { mode } = useSkin();
  // A piszkozat addig a mentett mix (a db-ből a képernyő megnyitása után is betöltődhet), amíg
  // az első chip-koppintás felül nem írja.
  const [edited, setDraft] = useState<SkinMix | null>(null);
  const draft = edited ?? skinMix;

  const names = s.skins.names;
  const paletteLabels: Record<FillPaletteId, string> = {
    brand: s.settings.paletteBrand,
    electric: s.settings.paletteElectric,
    lime: s.settings.paletteLime,
    cyan: s.settings.paletteCyan,
    orange: s.settings.paletteOrange,
  };

  const save = () => {
    setSkinMix(draft);
    setSkin('mix');
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: g.bg }]}>
      <SkinBackdrop />
      <View style={[styles.headerRow, brutalHeaderRowStyle(g)]}>
        {g.brutal ? (
          <View style={styles.exitBtn}>
            <BrutalBackButton testID="mix-back" onPress={() => router.back()} />
          </View>
        ) : (
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.exitBtn}>
            <Text style={[styles.exitIcon, { color: g.ink }]}>←</Text>
          </Pressable>
        )}
        <Text style={[styles.title, { color: g.ink }, g.brutal && styles.brutalTitle]}>{s.settings.themes.mixTitle}</Text>
        <View style={styles.exitBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <MixPreview draft={draft} />

        <Section title={s.settings.themes.mixColors} testID="mix-section-colors">
          {COLOR_CHOICES.map((id) => {
            const colors = isSkinId(id) ? skinColorsFor(SKINS[id], mode) : null;
            const a = colors ? colors.a : PALETTE_FILLS[id as FillPaletteId].a;
            const b = colors ? (colors.b ?? colors.a) : PALETTE_FILLS[id as FillPaletteId].b;
            return (
              <Choice
                key={id}
                testID={`mix-colors-${id}`}
                selected={draft.colors === id}
                onPress={() => setDraft({ ...draft, colors: id })}
                label={isSkinId(id) ? names[id] : paletteLabels[id as FillPaletteId]}
                leading={<Dots a={a} b={b} ink={g.ink} />}
              />
            );
          })}
        </Section>

        <Section title={s.settings.themes.mixFont} testID="mix-section-font">
          {SKIN_ORDER.map((id) => (
            <Choice
              key={id}
              testID={`mix-font-${id}`}
              selected={draft.font === id}
              onPress={() => setDraft({ ...draft, font: id })}
              label={names[id]}
              leading={
                <Text style={[styles.aa, { color: g.ink }, SKINS[id].fonts.title ? { fontFamily: SKINS[id].fonts.title } : { fontWeight: '700' }]}>
                  Aa
                </Text>
              }
            />
          ))}
        </Section>

        <Section title={s.settings.themes.mixShape} testID="mix-section-shape">
          {uniqueShapeChoices().map((id) => {
            const shape = SKINS[id].shape;
            const radius = typeof shape.radius === 'number' ? shape.radius : shape.radius[0];
            return (
              <Choice
                key={id}
                testID={`mix-shape-${id}`}
                selected={shapeKey(draft.shape) === shapeKey(id)}
                onPress={() => setDraft({ ...draft, shape: id })}
                label={names[id]}
                leading={
                  <View
                    style={[
                      styles.shapeBox,
                      { borderColor: g.ink, borderWidth: Math.min(3, shape.borderWidth), borderRadius: Math.min(9, radius) },
                    ]}
                  />
                }
              />
            );
          })}
        </Section>

        <Section title={s.settings.themes.mixDecor} testID="mix-section-decor">
          {decorChoices().map((id) => (
            <Choice
              key={id}
              testID={`mix-decor-${id}`}
              selected={draft.decor === id}
              onPress={() => setDraft({ ...draft, decor: id })}
              label={id === 'none' ? s.settings.themes.mixNone : names[id]}
            />
          ))}
        </Section>

        <View style={styles.saveRow}>
          {g.brutal ? (
            <BrutalButton testID="mix-save" fill="a" onPress={save} label={s.settings.themes.mixSave} style={styles.flex1} />
          ) : (
            <Pressable testID="mix-save" onPress={save} style={[styles.savePlain, { backgroundColor: g.a }]}>
              <Text style={[styles.savePlainText, { color: g.onA }]}>{s.settings.themes.mixSave}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 0 },
  exitBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  exitIcon: { fontSize: 26, fontWeight: '700' },
  title: { flex: 1, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  container: { padding: 20, paddingBottom: 48 },
  preview: { padding: 16, marginBottom: 20, overflow: 'hidden' },
  previewCard: { padding: 18, alignItems: 'center', gap: 14 },
  previewPill: { paddingVertical: 8, paddingHorizontal: 22, alignItems: 'center' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  chipRow: { gap: 10, paddingRight: 12, paddingBottom: 6 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  aa: { fontSize: 16 },
  shapeBox: { width: 20, height: 14 },
  saveRow: { flexDirection: 'row', marginTop: 8 },
  flex1: { flex: 1 },
  savePlain: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  savePlainText: { fontSize: 16, fontWeight: '600' },
});
