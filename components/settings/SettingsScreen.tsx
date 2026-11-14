import { type ReactNode } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Modal, Platform, useWindowDimensions } from 'react-native';
import { Text } from '@/components/KText';
import { TitleText, BackButton, themedSheetStyle } from '@/components/grammar/Themed';
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
import { exportAppLog } from '@/lib/exportAppLog';
import { languages, pairLabel, supportedPairs } from '@/lib/languages';
import { articleOptionsFor } from '@/lib/articlePicker';
import { requestCloudSignIn, useIsCloudGuest } from '@/lib/cloud/guest';
import { useSettingsScreen } from '@/lib/settings/useSettingsScreen';
import BetterVoiceRows from '@/components/settings/BetterVoiceRows';
import SpeakerPickerRows from '@/components/settings/SpeakerPickerRows';
import { brutalHeaderRowStyle } from '@/lib/brutalHeader';
import type { NeuralLang } from '@/lib/neuralVoices';

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

export type SettingsSection = 'home' | 'learning' | 'voice' | 'data';

export default function SettingsScreen({ section = 'home' }: { section?: SettingsSection }) {
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
  // the direction sheet lists all 12 pairs: its rows scroll inside a list that leaves room for the title on a small phone.
  const sheetListMax = useWindowDimensions().height * 0.6;
  // web guest (no cloud account yet): the sign-in row below
  const isCloudGuest = useIsCloudGuest();
  const {
    level, direction, directionSheetOpen, setDirectionSheetOpen, weeklyGoal, dailyNewLimit, againDelaySec,
    strictAccents, articlePicker, tiredButton, missCap, goalReached, missingVoices, resetLevels, hasGrammarProgress, resetOpen,
    setResetOpen, examSeeded, handleStrictAccentsToggle, handleArticlePickerToggle, handleSelectDirection,
    handleWeeklyGoalChange, handleDailyNewLimitChange, handleAgainDelayChange, handleBackup, handleRestore,
    handleResetDeck, handleResetGrammar, handleSeedExamA1,
    handleTiredButtonToggle, handleMissCapToggle,
  } = useSettingsScreen();

  // the language's own name for the hint ("Magyar"), not its code.
  const voiceName = (code: string) => languages.find(l => l.code === code)?.name ?? code;

  const voiceLanguages = [direction[1], direction[0]].filter(
    (code): code is NeuralLang => ['es', 'en', 'hu', 'de'].includes(code),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SkinBackdrop />
      {section !== 'home' && (
        <View style={[styles.headerRow, brutalHeaderRowStyle(g)]}>
          <BackButton testID={`settings-${section}-back`} onPress={() => router.back()} wrapStyle={styles.exitBtn} pressStyle={styles.exitBtn} arrowStyle={[styles.exitIcon, { color: g.ink }]} />
          <TitleText style={[styles.folderTitle, { color: g.ink }]}>{s.settings.folders[section]}</TitleText>
          <View style={styles.exitBtn} />
        </View>
      )}
      {/* the page grew past one screen (the version line at its bottom was
          unreachable), so the settings list scrolls. The modal stays outside, pinned to the screen. */}
      <ScrollView contentContainerStyle={styles.container}>

      {/* web guest only, first on the page so it is found: opens the sign-in chooser of the cloud gate (components/cloud/CloudGate.tsx). */}
      {section === 'home' && Platform.OS === 'web' && isCloudGuest && (
        <Row onPress={requestCloudSignIn}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.signIn}</Text>
          <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
        </Row>
      )}

      {section === 'home' && (
      <>
      {/* a course language with no installed voice, named so the fix
          (install it in the phone's text-to-speech settings) is obvious. */}
      {missingVoices.length > 0 && (
        <Row>
          <Text style={[styles.missingVoiceText, { color: legibleOn('#EAB308', colors.card) }]}>
            {s.settings.missingVoice(missingVoices.map(voiceName).join(', '))}
          </Text>
        </Row>
      )}

      <Row onPress={() => router.push('/settings-learning')}>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.folders.learning}</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{pairLabel(direction[0], direction[1])}, {s.settings.dailyNewLimitWords(String(dailyNewLimit))}</Text>
        </View>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>›</Text>
      </Row>
      {Platform.OS !== 'web' && (
        <Row onPress={() => router.push('/settings-voice')}>
          <View style={styles.difficultyLabelBox}>
            <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.folders.voice}</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{s.settings.folders.voiceHint}</Text>
          </View>
          <Text style={[styles.rowArrow, { color: arrowColor }]}>›</Text>
        </Row>
      )}
      <Row onPress={() => router.push('/themes')}>
        <View testID="settings-theme-row" style={styles.themeRow}>
          <ThemeSwatch skin={activeSkin} mode={mode} small />
          <View style={styles.difficultyLabelBox}>
            <Text style={[styles.wordsOnlyLabel, { color: g.ink }]}>{s.settings.themes.title}</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{s.skins.names[skinId]}</Text>
          </View>
          <Text style={[styles.themeChevron, { color: g.ink }]}>›</Text>
        </View>
      </Row>

      <Row onPress={() => router.push('/settings-data')}>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.folders.data}</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{s.settings.folders.dataHint}</Text>
        </View>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>›</Text>
      </Row>
      <Row onPress={() => router.push('/credits')}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.credits}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>›</Text>
      </Row>
      </>
      )}

      {section === 'voice' && Platform.OS !== 'web' && (
        <>
          <BetterVoiceRows Row={Row} />
          <SpeakerPickerRows Row={Row} languages={voiceLanguages} />
        </>
      )}

      {section === 'learning' && (
      <>
      {/* learning-direction switch row. */}
      <Row onPress={() => setDirectionSheetOpen(true)}>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.learningDirection}</Text>
          <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>
            {pairLabel(direction[0], direction[1])}
          </Text>
        </View>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      {/* the "weekly goal reached" card is gone (felesleges);
          the reached state stays as the green tag on the goal row below. */}
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

      {/* article button row on the typing noun cards of the languages with articles to pick (Spanish el/la/los/las, German der/die/das). */}
      {articleOptionsFor(direction[1]).length > 0 && (
        <Row>
          <View style={styles.difficultyLabelBox}>
            <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.articlePicker}</Text>
            <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>{s.settings.articlePickerHint}</Text>
          </View>
          <BrutalSwitch testID="settings-article-picker" accessibilityLabel={s.settings.articlePicker} value={articlePicker} onValueChange={handleArticlePickerToggle} />
        </Row>
      )}

      <Row>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.tiredButton}</Text>
          <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>{s.settings.tiredButtonHint(s.tabs.pcic)}</Text>
        </View>
        <BrutalSwitch testID="settings-tired-button" accessibilityLabel={s.settings.tiredButton} value={tiredButton} onValueChange={handleTiredButtonToggle} />
      </Row>

      <Row>
        <View style={styles.difficultyLabelBox}>
          <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.missCap}</Text>
          <Text style={[styles.sectionHint, { color: colors.tabIconDefault }]}>{s.settings.missCapHint}</Text>
        </View>
        <BrutalSwitch testID="settings-miss-cap" accessibilityLabel={s.settings.missCap} value={missCap} onValueChange={handleMissCapToggle} />
      </Row>

      </>
      )}

      {section === 'data' && (
      <>
      {/* Backup (export + share) and restore (pick file + confirm + import). */}
      <Row onPress={handleBackup}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>💾 {s.backup.backup}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      <Row onPress={handleRestore}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>♻️ {s.backup.restore}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

      <Row onPress={exportAppLog}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>📋 {s.settings.diagnostics.export}</Text>
        <Text style={[styles.rowArrow, { color: arrowColor }]}>→</Text>
      </Row>

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

      </>
      )}

      {section === 'home' && (
      <>
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
      </>
      )}
      </ScrollView>

      <ScreenFeedback placement="header" level={level} languagePair={direction.join('→')} currentCard={section === 'home' ? 'settings-tab' : `settings-${section}`} />

      {/* small sheet with the two directions, the
          current one ticked, modeled on LevelPickerSheet (components/LevelPickerSheet.tsx). */}
      <Modal visible={section === 'learning' && directionSheetOpen} transparent animationType="slide" onRequestClose={() => setDirectionSheetOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setDirectionSheetOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }, themedSheetStyle(g)]} onPress={() => {}}>
            <TitleText style={[styles.sheetTitle, { color: colors.text }]}>{s.settings.chooseDirection}</TitleText>
            <ScrollView style={{ maxHeight: sheetListMax }}>
            {supportedPairs.map(([src, tgt]) => {
              const active = direction[0] === src && direction[1] === tgt;
              if (g.brutal) {
                return (
                  <BrutalBox
                    key={`${src}-${tgt}`}
                    fill={active ? 'a' : 'paper'}
                    style={styles.brutalSheetOptionOuter}
                    boxStyle={styles.brutalSheetOption}
                    onPress={() => handleSelectDirection(src, tgt)}
                  >
                    <Text style={[styles.sheetOptionText, styles.brutalOptionText, { color: active ? g.onFill : g.ink }]}>
                      {pairLabel(src, tgt)}
                    </Text>
                    {active && <Text style={[styles.sheetOptionText, { color: g.onFill }]}>✓</Text>}
                  </BrutalBox>
                );
              }
              return (
                <Pressable
                  key={`${src}-${tgt}`}
                  accessibilityRole="button"
                  style={[styles.sheetOption, { backgroundColor: active ? colors.tint : colors.background }]}
                  onPress={() => handleSelectDirection(src, tgt)}
                >
                  <Text style={[styles.sheetOptionText, { color: active ? colors.onTint : colors.text }]}>
                    {pairLabel(src, tgt)}
                  </Text>
                  {active && <Text style={[styles.sheetOptionText, { color: colors.onTint }]}>✓</Text>}
                </Pressable>
              );
            })}
            </ScrollView>
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
    paddingTop: 4,
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
  brutalSheetOptionOuter: { marginBottom: 10 },
  brutalSheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 8 },
  folderTitle: { flex: 1, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  exitBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  exitIcon: { fontSize: 28 },
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
