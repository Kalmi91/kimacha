import { type ReactNode } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Modal } from 'react-native';
import { Text } from '@/components/KText';
import { TitleText } from '@/components/grammar/Themed';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';
import { t } from '@/lib/i18n';
import { WEEKLY_GOAL_STEP_MINUTES, DAILY_NEW_LIMIT_STEP } from '@/lib/usageStats';
import { AGAIN_DELAY_STEP_SEC } from '@/lib/pcicSession';
import ScreenFeedback from '@/lib/screenFeedback';
import { BrutalBox, BrutalSwitch } from '@/components/grammar/Brutal';
import { SkinBackdrop } from '@/components/skins/Slots';
import ThemeSwatch from '@/components/skins/ThemeSwatch';
// version line in Settings, the same tag the feedback rows carry.
import { appBuildTag } from '@/lib/appBuild';
import { languages } from '@/lib/languages';
import { useBeta, setBeta, BETA_FLAGS, type BetaFlag } from '@/lib/beta';
import { useSettingsScreen } from '@/lib/settings/useSettingsScreen';

const appVersionLabel = appBuildTag();

// The settings row: BrutalBox on the brutalist palette, today's card row on the classic palette.
function Row({ onPress, children }: { onPress?: () => void; children: ReactNode }) {
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <BrutalBox testID="settings-row" onPress={onPress} style={styles.brutalRowOuter} boxStyle={styles.brutalRow}>
        {children}
      </BrutalBox>
    );
  }
  const style = [styles.wordsOnlyRow, { backgroundColor: g.paper }];
  return onPress ? (
    <Pressable accessibilityRole="button" style={style} onPress={onPress}>
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

// One beta switch (lib/beta.ts); off = the old behavior.
function BetaRow({ flag, label }: { flag: BetaFlag; label: string }) {
  const { theme } = useTheme();
  const on = useBeta(flag);
  return (
    <Row>
      <Text style={[styles.wordsOnlyLabel, { color: Colors[theme].text }]}>{label}</Text>
      <BrutalSwitch testID={`settings-beta-${flag}`} accessibilityLabel={label} value={on} onValueChange={(v) => setBeta(flag, v)} />
    </Row>
  );
}

// The −/+ stepper button (a box on the brutalist palette).
function StepBtn({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel: string }) {
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <BrutalBox offset={2} accessibilityLabel={accessibilityLabel} onPress={onPress} style={styles.brutalStepOuter} boxStyle={styles.brutalStep}>
        <Text style={[styles.goalBtnText, { color: g.ink }]}>{label}</Text>
      </BrutalBox>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.goalBtn, { borderColor: g.a }]} onPress={onPress}>
      <Text style={[styles.goalBtnText, { color: g.a }]}>{label}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  // The active theme in the Themes row (name + sample).
  const { id: skinId, skin: activeSkin, mode } = useSkin();
  // In the stepper rows the label cannot be squeezed narrower than this; the stepper wraps below the label first
  // (112 on a theme with a custom body font / enlarged / letter-spaced text, 64 on today's Neo-brutal and Classic looks: there it does not wrap).
  const wideText = !!activeSkin.fonts.body || activeSkin.fontScale > 1 || activeSkin.spacingScope === 'all';
  const stepLabel = { minWidth: wideText ? 112 : 64 };
  const colors = Colors[theme];
  const arrowColor = legibleOn(colors.tint, colors.card, 3);
  const g = useGrammarColors();
  const s = t();
  const router = useRouter();
  const {
    level, direction, directionSheetOpen, setDirectionSheetOpen, weeklyGoal, dailyNewLimit, againDelaySec,
    strictAccents, articlePicker, goalReached, missingVoices, resetLevels, hasGrammarProgress, resetOpen,
    setResetOpen, examSeeded, handleStrictAccentsToggle, handleArticlePickerToggle, handleSelectDirection,
    handleWeeklyGoalChange, handleDailyNewLimitChange, handleAgainDelayChange, handleBackup, handleRestore,
    handleResetDeck, handleResetGrammar, handleSeedExamA1, handleLoadMistakes,
  } = useSettingsScreen();

  // the language's own name for the hint ("Magyar"), not its code.
  const voiceName = (code: string) => languages.find(l => l.code === code)?.name ?? code;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SkinBackdrop />
      {/* the page grew past one screen (the version line at its bottom was
          unreachable), so the settings list scrolls. The modal stays outside, pinned to the screen. */}
      <ScrollView contentContainerStyle={styles.container}>
      <TitleText style={[styles.sectionTitle, { color: colors.text }]}>{s.tabs.settings}</TitleText>

      <Text style={[styles.sectionHint, { color: colors.textMuted, marginBottom: 8 }]}>{s.settings.themes.title}</Text>
      <Row onPress={() => router.push('/themes')}>
        <View testID="settings-theme-row" style={styles.themeRow}>
          <ThemeSwatch skin={activeSkin} mode={mode} small />
          <Text style={[styles.optionText, { color: g.ink }]}>{s.skins.names[skinId]}</Text>
          <Text style={[styles.themeChevron, { color: g.ink }]}>›</Text>
        </View>
      </Row>

      {/* a course language with no installed voice, named so the fix
          (install it in the phone's text-to-speech settings) is obvious. */}
      {missingVoices.length > 0 && (
        <Row>
          <Text style={[styles.missingVoiceText, { color: legibleOn('#EAB308', colors.card) }]}>
            {s.settings.missingVoice(missingVoices.map(voiceName).join(', '))}
          </Text>
        </Row>
      )}

      {/* the "weekly goal reached" card is gone (felesleges);
          the reached state stays as the green tag on the goal row below. */}
      {/* weekly study goal in whole hours, shown on the Stats tab. */}
      <Row>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }, stepLabel]}>{s.settings.weeklyGoal}</Text>
        <View style={styles.goalStepper}>
          <StepBtn label="−" accessibilityLabel={s.a11y.weeklyGoal.down} onPress={() => handleWeeklyGoalChange(-WEEKLY_GOAL_STEP_MINUTES)} />
          <Text style={[styles.goalValue, { color: goalReached ? colors.successFill : colors.text }]}>
            {s.settings.weeklyGoalHours(String(Math.round(weeklyGoal / 60)))}
            {goalReached ? ` ${s.settings.weeklyGoalDoneTag}` : ''}
          </Text>
          <StepBtn label="+" accessibilityLabel={s.a11y.weeklyGoal.up} onPress={() => handleWeeklyGoalChange(WEEKLY_GOAL_STEP_MINUTES)} />
        </View>
      </Row>

      {/* how many brand-new words a day may enter the learning queue. */}
      <Row>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }, stepLabel]}>{s.settings.dailyNewLimit}</Text>
        <View style={styles.goalStepper}>
          <StepBtn label="−" accessibilityLabel={s.a11y.dailyNewLimit.down} onPress={() => handleDailyNewLimitChange(-DAILY_NEW_LIMIT_STEP)} />
          <Text style={[styles.goalValue, { color: colors.text }]}>
            {s.settings.dailyNewLimitWords(String(dailyNewLimit))}
          </Text>
          <StepBtn label="+" accessibilityLabel={s.a11y.dailyNewLimit.up} onPress={() => handleDailyNewLimitChange(DAILY_NEW_LIMIT_STEP)} />
        </View>
      </Row>

      {/* the return time of the PCIC "again" card; the grammar table-deck cooldown
          reads the same value too. */}
      <Row>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }, stepLabel]}>{s.settings.missedWordDelay}</Text>
        <View style={styles.goalStepper}>
          <StepBtn label="−" accessibilityLabel={s.a11y.missedWordDelay.down} onPress={() => handleAgainDelayChange(-AGAIN_DELAY_STEP_SEC)} />
          <Text style={[styles.goalValue, { color: colors.text }]}>
            {s.settings.missedWordDelaySeconds(String(againDelaySec))}
          </Text>
          <StepBtn label="+" accessibilityLabel={s.a11y.missedWordDelay.up} onPress={() => handleAgainDelayChange(AGAIN_DELAY_STEP_SEC)} />
        </View>
      </Row>

      {/* accent strictness, standalone toggle (the
          dial that used to wrap it, the word-in-hand window, is gone). */}
      <Row>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.strictAccents}</Text>
          <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>{s.settings.strictAccentsHint}</Text>
        </View>
        <BrutalSwitch testID="settings-strict-accents" accessibilityLabel={s.settings.strictAccents} value={strictAccents} onValueChange={handleStrictAccentsToggle} />
      </Row>

      {/* article button row on the typing Spanish noun cards.
          It is active only for Spanish as the target language (in index.tsx the button row also appears only at target==='es'). */}
      {direction[1] === 'es' && (
        <Row>
          <View style={styles.difficultyLabelBox}>
            <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.articlePicker}</Text>
            <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>{s.settings.articlePickerHint}</Text>
          </View>
          <BrutalSwitch testID="settings-article-picker" accessibilityLabel={s.settings.articlePicker} value={articlePicker} onValueChange={handleArticlePickerToggle} />
        </Row>
      )}

      {/* learning-direction switch row. */}
      <Row onPress={() => setDirectionSheetOpen(true)}>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.learningDirection}</Text>
          <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>
            {direction[0] === 'en' ? s.settings.directionEnEs : s.settings.directionEsEn}
          </Text>
        </View>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      {/* Backup (export + share) and restore (pick file + confirm + import). */}
      <Row onPress={handleBackup}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>💾 {s.backup.backup}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      <Row onPress={handleRestore}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>♻️ {s.backup.restore}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      {/* import from the "My mistakes" bundle (Drive JSON). */}
      <Row onPress={handleLoadMistakes}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.mistakes.load}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      {/* early features, one switch each (lib/beta.ts). */}
      <Text testID="settings-beta-title" style={[styles.sectionHint, { color: colors.textMuted, marginTop: 20, marginBottom: 0 }]}>{s.settings.beta.title}</Text>
      {BETA_FLAGS.map((flag) => (
        <BetaRow key={flag} flag={flag} label={s.settings.beta[flag]} />
      ))}

      {/* progress reset with confirmation, per deck and for grammar. */}
      {(resetLevels.length > 0 || hasGrammarProgress) && (
        <Row onPress={() => setResetOpen((o) => !o)}>
          <Text testID="settings-reset-section" style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.resetSection}</Text>
          <Text style={[styles.rowArrow, { color: arrowColor }]}>{resetOpen ? '▾' : '▸'}</Text>
        </Row>
      )}
      {resetOpen && (
        <>
          {resetLevels.map((lvl) => (
            <Row key={lvl} onPress={() => handleResetDeck(lvl)}>
              <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.pcic.resetRow(lvl)}</Text>
              <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
            </Row>
          ))}
          {hasGrammarProgress && (
            <Row onPress={handleResetGrammar}>
              <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.resetGrammar}</Text>
              <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
            </Row>
          )}
        </>
      )}

      {/* word-data attribution screen entry point. */}
      <Row onPress={() => router.push('/credits')}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.credits}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      {/* app version, small and grey, so the user can tell which build runs. */}
      <Text style={[styles.versionText, { color: colors.tabIconDefault }]}>{appVersionLabel}</Text>

      {/* developer control; it is not rendered in a release build (`__DEV__ === false`). */}
      {__DEV__ && (
        <Row onPress={handleSeedExamA1}>
          <Text testID="dev-seed-exam" style={[styles.wordsOnlyLabel, { color: colors.text }]}>
            {examSeeded ? s.settings.devSeedExamA1Done : s.settings.devSeedExamA1}
          </Text>
          <Text style={[styles.rowArrow, { color: colors.tint }]}>→</Text>
        </Row>
      )}
      </ScrollView>

      <ScreenFeedback placement="header" level={level} languagePair={direction.join('→')} currentCard="settings-tab" />

      {/* small sheet with the two directions, the
          current one ticked, modeled on LevelPickerSheet (components/LevelPickerSheet.tsx). */}
      <Modal visible={directionSheetOpen} transparent animationType="slide" onRequestClose={() => setDirectionSheetOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setDirectionSheetOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }, g.brutal && [styles.brutalSheet, { borderColor: g.ink }]]} onPress={() => {}}>
            <TitleText style={[styles.sheetTitle, { color: colors.text }]}>{s.settings.chooseDirection}</TitleText>
            {(
              [
                ['en', 'es'],
                ['es', 'en'],
              ] as const
            ).map(([src, tgt]) => {
              const active = direction[0] === src && direction[1] === tgt;
              if (g.brutal) {
                return (
                  <BrutalBox
                    key={src}
                    fill={active ? 'a' : 'paper'}
                    style={styles.brutalSheetOptionOuter}
                    boxStyle={styles.brutalSheetOption}
                    onPress={() => handleSelectDirection(src, tgt)}
                  >
                    <Text style={[styles.sheetOptionText, styles.brutalOptionText, { color: active ? g.onFill : g.ink }]}>
                      {src === 'en' ? s.settings.directionEnEs : s.settings.directionEsEn}
                    </Text>
                    {active && <Text style={[styles.sheetOptionText, { color: g.onFill }]}>✓</Text>}
                  </BrutalBox>
                );
              }
              return (
                <Pressable
                  key={src}
                  accessibilityRole="button"
                  style={[styles.sheetOption, { backgroundColor: active ? colors.tint : colors.background }]}
                  onPress={() => handleSelectDirection(src, tgt)}
                >
                  <Text style={[styles.sheetOptionText, { color: active ? colors.onTint : colors.text }]}>
                    {src === 'en' ? s.settings.directionEnEs : s.settings.directionEsEn}
                  </Text>
                  {active && <Text style={[styles.sheetOptionText, { color: colors.onTint }]}>✓</Text>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  versionText: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
  },
  // The direction switch's small sheet, modeled on the
  // overlay/sheet styles of components/LevelPickerSheet.tsx.
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // brutalist shapes.
  brutalRowOuter: { marginTop: 12 },
  // flexWrap + rowGap: if a theme with a wide font makes the stepper too wide, it wraps below the label.
  brutalRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14 },
  brutalStepOuter: { width: 38 },
  brutalStep: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  brutalOptionText: { fontWeight: '500', textTransform: 'uppercase' },
  brutalSheet: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 2.5 },
  brutalSheetOptionOuter: { marginBottom: 10 },
  brutalSheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Content of the Themes row (sample + name + arrow).
  themeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeChevron: { marginLeft: 'auto', fontSize: 22, fontWeight: '700' },
  sectionHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    // keep the hint from touching the switch / arrow (the label's own marginRight does not apply to the hint).
    marginRight: 12,
  },
  // The label inside already carries the right margin (see wordsOnlyLabel).
  difficultyLabelBox: {
    flex: 1,
  },
  wordsOnlyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 12,
  },
  wordsOnlyLabel: {
    fontSize: 16,
    fontWeight: '600',
    // Spanish labels ("Objetivo semanal de estudio") are long enough to
    // push the switch/stepper out of the card, RN text does not shrink on its own.
    flex: 1,
    marginRight: 12,
  },
  // the "→" sits at the row's right edge, the text gets the remaining width.
  rowArrow: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 0,
  },
  // −/+ stepper for the weekly goal row.
  missingVoiceText: { fontSize: 13, lineHeight: 18, flex: 1 },
  goalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    maxWidth: '100%',
    marginLeft: 'auto',
  },
  goalBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBtnText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  goalValue: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 96,
    flexShrink: 1,
    textAlign: 'center',
  },
});
