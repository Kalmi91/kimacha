import { View, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { Text } from '@/components/KText';
import { speak } from '@/lib/speech';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { DAILY_XP_GOAL } from '@/lib/dailyXp';
import { suggestedGrade } from '@/lib/pcicMatch';
import { ARTICLE_OPTIONS, articlePickerApplies, articleRowAppliesForPos, type ArticlePick } from '@/lib/articlePicker';
import { LEARNING_STEPS } from '@/lib/sm2';
import { PCIC_NEW_BONUS_STEP, PCIC_NEW_BONUS_STEPS, countFinishedToday, dayProgressPercent, finishedInBatch } from '@/lib/pcicSession';
import { posOf } from '@/lib/pcicPos';
import ScreenFeedback from '@/lib/screenFeedback';
import SpeakButton from '@/components/SpeakButton';
import BadgeRow from '@/components/learn/BadgeRow';
import CardShell from '@/components/learn/CardShell';
import CardNote from '@/components/learn/CardNote';
import { SkinBackdrop, SkinHeader, SkinSpeakLabel, SkinWord } from '@/components/skins/Slots';
import DockedAction from '@/components/learn/DockedAction';
import { dockScrollInsets } from '@/components/learn/dockScrollInsets';
import PcicRevealedAnswer from '@/components/learn/PcicRevealedAnswer';
import MistakesEntry from '@/components/learn/MistakesEntry';
import { answerInputProps } from '@/lib/inputProps';
import LevelPickerSheet from '@/components/LevelPickerSheet';
import { BrutalBox, BrutalButton, SegmentBar, brutalInputStyle, segmentsFilled, textOnFill } from '@/components/grammar/Brutal';
import EasySentenceCard from '@/components/EasySentenceCard';
import FitText from '@/components/FitText';
import DoneBadge from '@/components/DoneBadge';
import TypedSentenceCard from '@/components/TypedSentenceCard';
import type { usePcicSession } from '@/lib/learn/usePcicSession';
import { styles } from './pcicStyles';

// Everything the PCIC card view reads from the session hook (lib/learn/usePcicSession.ts).
export type PcicCardViewProps = ReturnType<typeof usePcicSession>;

export default function PcicCardView({
  loading,
  level,
  setLevelSheetOpen,
  newOrder,
  dueRemaining,
  newRemaining,
  doneToday,
  xpToday,
  lastGraded,
  handleUndo,
  introducedTodayByKind,
  todayNewBudget,
  sentenceCard,
  setSentenceCard,
  levelSheetOpen,
  allLevelCards,
  target,
  examRow,
  openPlacement,
  handleSelectLevel,
  sourceLang,
  strictAccents,
  dockLift,
  kbHeight,
  dockH,
  setDockH,
  languagePair,
  current,
  currentItem,
  allCards,
  sessionAnswered,
  sessionNew,
  sessionAgain,
  handleMoreNew,
  queue,
  today,
  batchBase,
  answerText,
  promptSource,
  noteOpenFor,
  setNoteOpenFor,
  grade,
  articlePick,
  setArticlePick,
  typedAnswer,
  setTypedAnswer,
  cardSeq,
  inputRef,
  handleCheck,
  handleGrade,
  handleDontLearn,
}: PcicCardViewProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  // The header's FIRST chip is the selected level,
  // tapping it opens the level picker sheet; the existing four chips are unchanged.
  // A BadgeRow chip row instead of the old single-line text header (`s.pcic.header`);
  // the four numbers are the same, just from separate i18n keys (badgeTotal/Due/New/Done).
  // The "My mistakes" entry is a standalone component (with its own
  // loading) so that this file (785 lines) does not grow past 800; it only
  // renders if there is a loaded bundle.

  // The 💬 button sits in the header row's right end (the Learn tab has no navigator header); its card context follows the
  // screen: the sentence card, the done screen, or the word card on top.
  const feedbackCard = sentenceCard ? `sentence:${sentenceCard.itemId}` : current && currentItem ? `pcic:${current.itemId}` : 'pcic';

  const headerRow = (
    <SkinHeader>
    <View style={styles.headerRow}>
      <View style={styles.headerBadges}>
        {g.brutal ? (
          // The level chip box (active = filled).
          <BrutalBox testID="learn-level-chip" fill="a" offset={2} boxStyle={styles.brutalLevelChip} onPress={() => setLevelSheetOpen(true)}>
            <Text style={[styles.levelChipText, { color: g.onFill, fontWeight: '500' }]}>{level} ▾</Text>
          </BrutalBox>
        ) : (
          <Pressable style={[styles.levelChip, { backgroundColor: colors.tint }]} onPress={() => setLevelSheetOpen(true)}>
            <Text style={[styles.levelChipText, { color: colors.onTint }]}>{level} ▾</Text>
          </Pressable>
        )}
        <BadgeRow
          colors={colors}
          items={[
            { label: s.pcic.badgeTotal(newOrder.length) },
            { label: s.pcic.badgeDue(dueRemaining), tone: 'blue' },
            { label: s.pcic.badgeNew(newRemaining), tone: 'green' },
            { label: s.pcic.badgeDone(doneToday) },
            { label: s.pcic.badgeXp(xpToday, DAILY_XP_GOAL), tone: 'accent', accessibilityLabel: s.pcic.badgeXpA11y(xpToday, DAILY_XP_GOAL), tabular: true },
          ]}
        />
      </View>
      <View style={styles.headerIcons}>
        {lastGraded && (
          <Pressable onPress={handleUndo} hitSlop={12} style={styles.resetBtn} accessibilityLabel={s.pcic.undo}>
            <Text style={styles.resetIcon}>↶</Text>
          </Pressable>
        )}
        <ScreenFeedback placement="inline" level={level} languagePair={languagePair} currentCard={feedbackCard} />
      </View>
    </View>
    {/* fix: the old fifth BadgeRow chip (what today's introduction consists of
        + today's total budget) was one long, continuous text that stuck out
        of the screen's right edge as a chip (it did not fit in the row, and the chip's interior
        cannot wrap). It became a separate, full-width, wrappable row
        BELOW the chip row; the content (i18n) is unchanged. */}
    <Text style={[styles.todayLine, { color: colors.tabIconDefault }]}>
      {s.pcic.badgeIntroducedToday(introducedTodayByKind.words, introducedTodayByKind.sentences, todayNewBudget)}
    </Text>
    <MistakesEntry colors={colors} />
    </SkinHeader>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // The sentence card comes before the next word card
  // (before the done screen too). Its own button closes it; it does not write SRS.
  if (sentenceCard) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SkinBackdrop />
        {headerRow}
        <LevelPickerSheet
          visible={levelSheetOpen}
          active={level}
          cards={allLevelCards}
          colors={colors}
          title={s.pcic.chooseLevel}
          target={target}
          exam={examRow}
          onPlacement={openPlacement}
          onSelect={handleSelectLevel}
          onClose={() => setLevelSheetOpen(false)}
        />
        {sentenceCard.kind === 'tiles' ? (
          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={[styles.cardScrollContent, { paddingBottom: 24 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <EasySentenceCard
              key={sentenceCard.itemId}
              sourceSentence={sentenceCard.source}
              targetWords={sentenceCard.targetWords}
              trapWords={sentenceCard.trapWords}
              speechLocale={speechLang(target)}
              sourceSpeechLocale={speechLang(sourceLang)}
              onResult={() => setSentenceCard(null)}
              gradeButtons
            />
          </ScrollView>
        ) : (
          // The typing sentence card has its own scroller + the docked Check bar above the
          // keyboard (like on the word card), so there is no outer ScrollView.
          <TypedSentenceCard
            key={sentenceCard.itemId}
            sourceSentence={sentenceCard.source}
            targetSentence={sentenceCard.target}
            strictAccents={strictAccents}
            speechLocale={speechLang(target)}
            sourceSpeechLocale={speechLang(sourceLang)}
            onResult={() => setSentenceCard(null)}
            dockLift={dockLift}
            keyboardOpen={kbHeight > 0}
            dockH={dockH}
            onDockHeight={setDockH}
            gradeButtons
          />
        )}
      </KeyboardAvoidingView>
    );
  }

  if (!current || !currentItem) {
    // How many PCIC items are already introduced (not in 'new' state) in the whole
    // list, for the done screen's own progress bar.
    const introducedCount = [...allCards.values()].filter((c) => c.state !== 'new').length;
    const introducedPct = newOrder.length > 0 ? (introducedCount / newOrder.length) * 100 : 0;
    return (
      <View style={[styles.container, styles.doneContainer, { backgroundColor: colors.background }]}>
        <SkinBackdrop />
        {headerRow}
        <LevelPickerSheet
          visible={levelSheetOpen}
          active={level}
          cards={allLevelCards}
          colors={colors}
          title={s.pcic.chooseLevel}
          target={target}
          exam={examRow}
          onPlacement={openPlacement}
          onSelect={handleSelectLevel}
          onClose={() => setLevelSheetOpen(false)}
        />
        <View style={styles.doneHeader}>
          {/* drawn badge (check mark + confetti) instead of the 🎉 emoji, in the neo-brutalist style. */}
          <DoneBadge />
          <Text variant="title" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>{s.pcic.doneTitle}</Text>
        </View>
        {g.brutal ? (
          <View style={styles.tilesRow}>
            {([['b', sessionAnswered, s.pcic.tileAnswered], ['paper', sessionNew, s.pcic.tileNew], ['a', sessionAgain, s.pcic.tileAgain]] as const).map(([fill, n, label]) => (
              <BrutalBox key={label} testID="learn-done-tile" fill={fill} style={styles.brutalTile} boxStyle={styles.brutalTileBox}>
                <Text style={[styles.tileNumber, { color: textOnFill(g, fill), fontWeight: '500' }]}>{n}</Text>
                <Text style={[styles.tileLabel, { color: textOnFill(g, fill) }]}>{label}</Text>
              </BrutalBox>
            ))}
          </View>
        ) : (
        <View style={styles.tilesRow}>
          <View style={[styles.tile, { backgroundColor: '#38BDF8' }]}>
            <Text style={styles.tileNumber}>{sessionAnswered}</Text>
            <Text style={styles.tileLabel}>{s.pcic.tileAnswered}</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: colors.successFill }]}>
            <Text style={styles.tileNumber}>{sessionNew}</Text>
            <Text style={styles.tileLabel}>{s.pcic.tileNew}</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: '#F472B6' }]}>
            <Text style={styles.tileNumber}>{sessionAgain}</Text>
            <Text style={styles.tileLabel}>{s.pcic.tileAgain}</Text>
          </View>
        </View>
        )}
        <View style={styles.introducedBlock}>
          <Text style={[styles.introducedLabel, { color: colors.tabIconDefault }]}>
            {s.pcic.introduced(introducedCount, newOrder.length)}
          </Text>
          {g.brutal ? (
            <SegmentBar filled={segmentsFilled(introducedPct, 8)} segments={8} />
          ) : (
            <View style={[styles.introducedTrack, { backgroundColor: colors.card }]}>
              <View style={[styles.introducedFill, { backgroundColor: '#38BDF8', width: `${introducedPct}%` }]} />
            </View>
          )}
        </View>
        {newOrder.some((id) => !allCards.has(id) || allCards.get(id)!.state === 'new') && (
          // +5 / +10 / +15 new words, in one row (the +10 testID is unchanged: learn-more-new).
          <View style={styles.moreNewBlock}>
            <Text style={[styles.moreNewHint, { color: colors.tabIconDefault }]}>{s.pcic.moreNewHint}</Text>
            <View style={styles.moreNewRow}>
              {PCIC_NEW_BONUS_STEPS.map((n) => {
                const testID = n === PCIC_NEW_BONUS_STEP ? 'learn-more-new' : `learn-more-new-${n}`;
                return g.brutal ? (
                  <BrutalButton key={n} testID={testID} accessibilityLabel={s.pcic.moreNew(n)} label={s.pcic.moreNewShort(n)} onPress={() => handleMoreNew(n)} style={styles.moreNewBtn} />
                ) : (
                  <Pressable key={n} testID={testID} accessibilityRole="button" accessibilityLabel={s.pcic.moreNew(n)} style={[styles.checkBtn, styles.moreNewBtn, { backgroundColor: '#38BDF8' }]} onPress={() => handleMoreNew(n)}>
                    <Text style={styles.checkBtnText}>{s.pcic.moreNewShort(n)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  }

  // The progress bar under the header is built from the persisted `doneToday`
  // daily count (not from `sessionAnswered`, which resets on every mount), so that
  // it shows the real daily progress after a tab switch or an app restart,
  // and does not jump back to empty.
  // The bar shows what remains of TODAY's batch (empty at the first
  // card, full at the last, it does not restart mid-batch; lib/pcicSession.ts
  // dayProgressPercent). The earlier measurement by sets of 10 restarted at every 10th card.
  // After +N it shows the progress of the new batch (finishedInBatch), not the day's total.
  const barPct = dayProgressPercent(
    finishedInBatch(countFinishedToday([...allCards.values()], queue, today), batchBase.day === today && batchBase.level === level ? batchBase.n : 0),
    queue.length
  );

  // The page/step badge placed at the top of the card (CardShell's chip prop),
  // in place of the earlier stepBadge texts in sectionRow.
  const chipLabel =
    current.state === 'new'
      ? s.pcic.newBadge
      : current.state === 'learning' && LEARNING_STEPS > 1
        ? s.pcic.learningStep(current.step + 1, LEARNING_STEPS)
        : undefined;

  // Part-of-speech chip under the word, from the Spanish form (lib/pcicPos.ts).
  // posOf runs only for es as the target language (the
  // rule/corpus is built on Spanish word forms, it makes no sense for English as the target).
  const pos = target === 'es' ? posOf(currentItem) : null;

  const hasNote = !!currentItem.note || !!currentItem.image;
  const noteOpen = hasNote && noteOpenFor === currentItem.id;

  // The docked Check bar switches to "Next" after reveal,
  // in the same place/size, with the suggested grade in the label.
  const nextGrade = grade ? suggestedGrade(grade) : null;
  const dockInsets = dockScrollInsets(dockH, dockLift, kbHeight > 0);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SkinBackdrop />
      {headerRow}
      <LevelPickerSheet
        visible={levelSheetOpen}
        active={level}
        cards={allLevelCards}
        colors={colors}
        title={s.pcic.chooseLevel}
        target={target}
        exam={examRow}
        onPlacement={openPlacement}
        onSelect={handleSelectLevel}
        onClose={() => setLevelSheetOpen(false)}
      />

      {g.brutal ? (
        <SegmentBar testID="learn-progress" filled={segmentsFilled(barPct, 8)} segments={8} style={styles.brutalProgress} />
      ) : (
        <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
          <View testID="learn-progress-fill" style={[styles.progressFill, { backgroundColor: colors.tint, width: `${barPct}%` }]} />
        </View>
      )}

      <ScrollView
        style={[styles.cardScroll, { marginBottom: dockInsets.marginBottom }]}
        contentContainerStyle={[styles.cardScrollContent, { paddingBottom: dockInsets.paddingBottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <CardShell
          compact
          colors={colors}
          chip={chipLabel}
          chipTone={current.state === 'new' ? 'new' : 'neutral'}
          onPress={() => Keyboard.dismiss()}
        >
          {/* the 🔊 next to the word speaks the English again (added afterwards),
              with the same call as the read-aloud on opening a card. */}
          <View style={styles.wordRow}>
            {/* a long word / sentence ("reason (justification)", "they are
                going to arrive") with a font size that depends on its length and a shrinking width;
                without this the native row extended beyond the card and its left edge was clipped. */}
            <SkinWord word={promptSource ?? ''} lang={sourceLang}>
              <FitText variant="word" base={32} maxLines={3} reserve={150} style={[styles.frontText, { color: colors.text }]}>
                {promptSource ?? ''}
              </FitText>
            </SkinWord>
            {/* the senior theme puts a text label under the 🔊 (SkinSpeakLabel). */}
            <View style={{ alignItems: 'center' }}>
              <SpeakButton onPress={() => speak(promptSource ?? '', speechLang(sourceLang))} style={styles.speakBtn} iconStyle={styles.speakIcon} />
              <SkinSpeakLabel />
            </View>
          </View>
          {/* a short sentence under the word when the question has several
              meanings; the part marked `*…*` is bold + pink underline, the asterisks are not
              visible. It stays while typing and after Check; the read-aloud does not change. */}
          {currentItem.hint && (
            <Text testID="learn-hint" style={[styles.hintText, { color: colors.tabIconDefault }]}>
              {currentItem.hint.split('*').map((part, i) =>
                i % 2 === 1 ? (
                  <Text key={i} style={[styles.hintMark, { color: colors.text }]}>{part}</Text>
                ) : (
                  part
                )
              )}
            </Text>
          )}
          {/* the chip (part of speech) + the section appear in the same row
              while typing and after reveal, so that the item can be told apart even with an English
              prompt that repeats three times. */}
          <View style={styles.sectionRow}>
            {pos && (
              <View style={[styles.posChip, { backgroundColor: colors.background }, g.brutal && [styles.brutalPos, { borderColor: g.ink }]]}>
                <Text style={[styles.posChipText, { color: colors.tabIconDefault }]}>
                  {pos.gender ? `${s.pos[pos.pos]} · ${pos.gender}` : s.pos[pos.pos]}
                </Text>
              </View>
            )}
            <Text style={[styles.sectionText, { color: colors.tabIconDefault }]}>{currentItem.section}</Text>
            {/* (i) only on a card with an explanation; tapping toggles the
                card's `note` below the chip row (it does not cover the Check bar or the 💬). */}
            {hasNote &&
              (g.brutal ? (
                <BrutalBox testID="learn-info" accessibilityLabel={s.pcic.noteLabel} fill={noteOpen ? 'b' : 'paper'} offset={2} boxStyle={styles.infoBtn} onPress={() => setNoteOpenFor(noteOpen ? null : currentItem.id)}>
                  <Text style={[styles.infoBtnText, { color: noteOpen ? g.onB : g.ink }]}>i</Text>
                </BrutalBox>
              ) : (
                <Pressable
                  testID="learn-info"
                  accessibilityRole="button"
                  accessibilityLabel={s.pcic.noteLabel}
                  accessibilityState={{ expanded: noteOpen }}
                  hitSlop={8}
                  onPress={() => setNoteOpenFor(noteOpen ? null : currentItem.id)}
                  style={[styles.infoBtn, { borderColor: colors.tint, backgroundColor: noteOpen ? colors.tint : 'transparent' }]}
                >
                  <Text style={[styles.infoBtnText, { color: noteOpen ? colors.background : colors.tint }]}>i</Text>
                </Pressable>
              ))}
          </View>
          {noteOpen && <CardNote note={currentItem.note} image={currentItem.image} colors={colors} />}

          {/* article button row from the Learn tab, ⊘ is the default.
              Addition: on PCIC the chip already shows when it is not a noun, so the
              row appears only for noun/unknown part of speech (lib/articlePicker.ts).
              It appears only for es as the target language. */}
          {target === 'es' &&
            articlePickerApplies(target, currentItem.kind !== 'sentence', answerText) &&
            articleRowAppliesForPos(pos) && (
            <View style={styles.articleRow}>
              {([...ARTICLE_OPTIONS, ''] as ArticlePick[]).map((opt) => {
                const active = articlePick === opt;
                if (g.brutal) {
                  return (
                    <BrutalBox
                      key={opt || 'none'}
                      fill={active ? 'a' : 'paper'}
                      offset={2}
                      disabled={!!grade}
                      onPress={() => setArticlePick(active ? '' : opt)}
                      style={grade ? styles.brutalDim : undefined}
                      boxStyle={styles.brutalArticle}
                      accessibilityLabel={opt || 'sin artículo'}
                    >
                      <Text style={[styles.articleChipText, { color: active ? g.onFill : g.ink, fontWeight: '500' }]}>{opt || '⊘'}</Text>
                    </BrutalBox>
                  );
                }
                return (
                  <Pressable
                    key={opt || 'none'}
                    disabled={!!grade}
                    onPress={() => setArticlePick(active ? '' : opt)}
                    style={[
                      styles.articleChip,
                      { backgroundColor: active ? colors.tint : colors.background, opacity: grade ? 0.6 : 1 },
                    ]}
                    accessibilityLabel={opt || 'sin artículo'}
                  >
                    <Text style={[styles.articleChipText, { color: active ? colors.background : colors.text }]}>
                      {opt || '⊘'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <TextInput
            key={`pcic-in-${current.itemId}-${cardSeq}`}
            ref={inputRef}
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, g.brutal && brutalInputStyle(g)]}
            value={typedAnswer}
            onChangeText={setTypedAnswer}
            onSubmitEditing={grade ? () => nextGrade && handleGrade(nextGrade) : handleCheck}
            editable={!grade}
            autoFocus={!grade}
            placeholder={s.card.typeIn(target)}
            placeholderTextColor={colors.tabIconDefault}
            {...answerInputProps}
          />

          {grade && (
            <PcicRevealedAnswer
              colors={colors}
              s={s}
              typedAnswer={typedAnswer}
              grade={grade}
              nextGrade={nextGrade}
              current={current}
              currentItem={currentItem}
              today={today}
              target={target}
              onGrade={handleGrade}
            />
          )}

          <View style={styles.bottomRow}>
            <Pressable onPress={handleDontLearn} hitSlop={8}>
              <Text style={[styles.dontLearn, { color: colors.tabIconDefault }]}>{s.pcic.dontLearn}</Text>
            </Pressable>
          </View>
        </CardShell>
      </ScrollView>

      {/* After Check, the SAME docked bar (place+size
          unchanged) switches to "Next", its label states the suggested grade;
          the two buttons in the card remain for override. */}
      <DockedAction
        label={grade && nextGrade ? s.pcic.next(s.pcic[nextGrade]) : `✓ ${s.card.check}`}
        onPress={grade && nextGrade ? () => handleGrade(nextGrade) : handleCheck}
        tone={grade ? 'next' : 'check'}
        color={grade ? colors.successFill : undefined}
        bottom={dockLift}
        colors={colors}
        onHeight={setDockH}
      />
    </KeyboardAvoidingView>
  );
}
