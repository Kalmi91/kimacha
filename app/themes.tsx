import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import { useRouter } from 'expo-router';

import { BrutalBackButton, BrutalBox } from '@/components/grammar/Brutal';
import Choice from '@/components/skins/Choice';
import { SkinBackdrop } from '@/components/skins/Slots';
import ThemeSwatch from '@/components/skins/ThemeSwatch';
import { PALETTE_FILLS, type FillPaletteId } from '@/constants/GrammarPalettes';
import { SKIN_GROUPS, SKINS, type SkinId } from '@/constants/Skins';
import { brutalHeaderRowStyle } from '@/lib/brutalHeader';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { useSkin } from '@/lib/useSkin';

// PLAN-temak 4D: a témaválasztó. Csoportonként 4 oszlopos rács (a téma háttere, "Aa" a title-betűvel,
// 5 px-es a-sáv, alatta a név); koppintásra azonnal alkalmazódik. Legfelül a Saját mix belépő; a
// kétmódú témánál az Auto / Light / Dark választó, az egymódúnál egy sor a helyén; a Neo-brutál
// alatt a mai 5 al-paletta.

const PALETTE_ORDER: FillPaletteId[] = ['brand', 'electric', 'lime', 'cyan', 'orange'];

function MixEntry({ active, onPress }: { active: boolean; onPress: () => void }) {
  const g = useGrammarColors();
  const content: ReactNode = (
    <>
      <Text style={[styles.mixName, { color: g.ink }]}>
        {active ? '✓ ' : ''}
        {t().skins.names.mix}
      </Text>
      <Text style={[styles.chevron, { color: g.ink }]}>›</Text>
    </>
  );
  if (g.brutal) {
    return (
      <BrutalBox testID="themes-mix-entry" offset={2} onPress={onPress} style={styles.mixOuter} boxStyle={styles.mixBox}>
        {content}
      </BrutalBox>
    );
  }
  return (
    <Pressable testID="themes-mix-entry" onPress={onPress} style={[styles.mixBox, styles.mixPlain, { backgroundColor: g.paper }]}>
      {content}
    </Pressable>
  );
}

export default function ThemesScreen() {
  const router = useRouter();
  const s = t();
  const g = useGrammarColors();
  const { skin: chosen, setSkin, override, setOverride, grammarPalette, setGrammarPalette } = useTheme();
  const { mode, modeLocked } = useSkin();

  const modeOptions: { label: string; value: 'system' | 'light' | 'dark' }[] = [
    { label: `🔄 ${s.settings.themeAuto}`, value: 'system' },
    { label: `☀️ ${s.settings.themeLight}`, value: 'light' },
    { label: `🌙 ${s.settings.themeDark}`, value: 'dark' },
  ];
  const paletteLabels: Record<FillPaletteId, string> = {
    brand: s.settings.paletteBrand,
    electric: s.settings.paletteElectric,
    lime: s.settings.paletteLime,
    cyan: s.settings.paletteCyan,
    orange: s.settings.paletteOrange,
  };
  // A régi 'classic' paletta-érték a Neo-brutálnál a 'brand'-del egyenlő.
  const activePalette = grammarPalette === 'classic' ? 'brand' : grammarPalette;

  // A Classic csempe a régi 'classic' paletta-értéket is beállítja (a mai viselkedés); a Neo-brutál
  // csempe a classic-ból visszalépve a 'brand' al-palettát.
  const pick = (id: SkinId) => {
    setSkin(id);
    if (id === 'classic') setGrammarPalette('classic');
    else if (id === 'brutal' && grammarPalette === 'classic') setGrammarPalette('brand');
  };

  return (
    <View style={[styles.screen, { backgroundColor: g.bg }]}>
      <SkinBackdrop />
      <View style={[styles.headerRow, brutalHeaderRowStyle(g)]}>
        {g.brutal ? (
          <View style={styles.exitBtn}>
            <BrutalBackButton testID="themes-back" onPress={() => router.back()} />
          </View>
        ) : (
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.exitBtn}>
            <Text style={[styles.exitIcon, { color: g.ink }]}>←</Text>
          </Pressable>
        )}
        <Text style={[styles.title, { color: g.ink }, g.brutal && styles.brutalTitle]}>{s.settings.themes.title}</Text>
        <View style={styles.exitBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <MixEntry active={chosen === 'mix'} onPress={() => router.push('/theme-mix')} />

        {modeLocked ? (
          <Text testID="themes-one-look" style={[styles.oneLook, { color: g.mu }]}>
            {s.settings.themes.oneLook}
          </Text>
        ) : (
          <View testID="themes-mode" style={styles.modeRow}>
            {modeOptions.map((opt) => (
              <Choice
                key={opt.value}
                testID={`themes-mode-${opt.value}`}
                selected={override === opt.value}
                onPress={() => setOverride(opt.value)}
                label={opt.label}
                style={styles.flex1}
              />
            ))}
          </View>
        )}

        {SKIN_GROUPS.map((group) => (
          <View key={group.id} testID={`themes-group-${group.id}`}>
            <Text style={[styles.groupTitle, { color: g.mu }]}>{s.skins.groups[group.id]}</Text>
            <View style={styles.grid}>
              {group.skins.map((id) => {
                const selected = chosen === id;
                return (
                  <Pressable
                    key={id}
                    testID={`theme-tile-${id}`}
                    accessibilityState={{ selected }}
                    onPress={() => pick(id)}
                    style={styles.tile}
                  >
                    <View testID={id === 'classic' ? 'palette-classic' : undefined} style={[styles.ring, { borderColor: selected ? g.ink : 'transparent' }]}>
                      <ThemeSwatch skin={SKINS[id]} mode={mode} />
                    </View>
                    <Text numberOfLines={2} style={[styles.tileName, { color: g.ink }]}>
                      {s.skins.names[id]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {group.skins.includes('brutal') && chosen === 'brutal' && (
              <View testID="themes-palettes" style={styles.paletteRow}>
                {PALETTE_ORDER.map((id) => (
                  <Choice
                    key={id}
                    testID={`palette-${id}`}
                    selected={activePalette === id}
                    onPress={() => setGrammarPalette(id)}
                    label={paletteLabels[id]}
                    leading={
                      <View style={styles.paletteDots}>
                        <View style={[styles.paletteDot, { backgroundColor: PALETTE_FILLS[id].a, borderColor: g.ink }]} />
                        <View style={[styles.paletteDot, { backgroundColor: PALETTE_FILLS[id].b, borderColor: g.ink }]} />
                      </View>
                    }
                    style={styles.paletteChoice}
                  />
                ))}
              </View>
            )}
          </View>
        ))}
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
  mixOuter: { marginBottom: 16 },
  mixBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  mixPlain: { borderRadius: 14, marginBottom: 16 },
  mixName: { fontSize: 16, fontWeight: '600' },
  chevron: { fontSize: 22, fontWeight: '700' },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  flex1: { flex: 1 },
  oneLook: { fontSize: 13, marginBottom: 16 },
  groupTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 12, marginBottom: 12 },
  tile: { width: '22.5%' },
  ring: { padding: 3, borderWidth: 2 },
  tileName: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  paletteChoice: { flexBasis: '47%', flexGrow: 1 },
  paletteDots: { flexDirection: 'row', gap: 3 },
  paletteDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
});
