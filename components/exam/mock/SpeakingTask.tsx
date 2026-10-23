import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { lineHeight, spacing } from '@/constants/Theme';
import { useDockedAction } from '@/components/learn/DockSlot';
import { countWords } from '@/lib/exam/mock/score';
import { formatClock } from '@/lib/exam/mock/session';
import type { MockSpeakingChoice, MockSpeakingTask } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { speak, stop as stopSpeaking } from '@/lib/speech';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from '../ExamButton';
import MockTaskFrame from './MockTaskFrame';
import SpeakingSheet, { SpeakingPhotos } from './SpeakingSheet';
import { letterOf, mockStyles as styles, type MockKindProps } from './mockStyles';

// speaking: an individual task the app leads. Steps inside the task: the topic chooser (2-3 choices and no `follows`), the task sheet
// (with the preparation time and the notes when the task has `prepSeconds`; the paper's clock stands still meanwhile), then the
// examiner's turns one by one: the question is shown and read aloud, the learner answers in a multiline field that keeps the
// keyboard's microphone (no answerInputProps, as in ExamSpeakCard) or types. One primary button at the bottom follows the step.
// On the turn screen the photos of the choice are always on top; a choice with a written stimulus (`input`: proposals, options, a
// survey, an article) has its sheet open there by default (it can be collapsed), the notes are collapsed. The answer field is a window
// of 4-7 lines that scrolls inside, and when the keyboard is up the screen's scroller (it ends above the docked bar and the keyboard,
// app/mock-exam.tsx) is brought to the examiner's question and the field, so what is typed and the word count stay in view.
// The answer key: `choice` = the picked choice id (a task that `follows` another writes the inherited one), `<turn id>` = the text of
// the turn, `notes` = the preparation notes (not scored). Every change goes into the answer, so the per-paper save keeps it.

type Props = MockKindProps<MockSpeakingTask> & {
  /** A task that `follows` another: the choice id of the followed task (the screen resolves it). */
  inheritedChoice?: string;
  /** True when the preparation time starts, false when it ends (or the task goes away): the paper's clock stands still meanwhile. */
  onHoldClock?: (hold: boolean) => void;
  /** The paper's own next-task action: the primary button of the last turn calls it. */
  onNextTask?: () => void;
  /** The last task of the paper: the label there is "Finish paper". */
  lastTask?: boolean;
  /** Scroll the screen so that this y (the top of the examiner's question + the answer field, from the top of this card) is at the top. */
  onScrollTo?: (y: number) => void;
};

type Step = 'choose' | 'sheet' | 'turns';

/** The first sentence of a prompt (the whole text when it has no full stop). */
const firstSentence = (text: string) => /^[\s\S]*?[.!?](?=\s|$)/.exec(text.trim())?.[0] ?? text.trim();

export default function SpeakingTask({ task, answer, onAnswer, target, canSpeak, glossary, inheritedChoice, onHoldClock, onNextTask, lastTask, onScrollTo }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;

  // The same order as the scoring: the picked sheet, else the followed task's, else (a single choice / a follow) the first.
  const needsPicker = task.choices.length > 1 && task.follows === undefined;
  const pickedId = typeof answer.choice === 'string' ? answer.choice : inheritedChoice;
  const choice: MockSpeakingChoice | undefined = task.choices.find((c) => c.id === pickedId) ?? (needsPicker ? undefined : task.choices[0]);
  const choiceId = choice?.id;
  const turns = choice?.turns ?? [];
  const textOf = (id: string) => String(answer[id] ?? '');

  // Where the learner is. A card that is rebuilt (the leave dialog was opened and closed) resumes at the first unanswered turn.
  const answeredAny = turns.some((tn) => textOf(tn.id).trim() !== '');
  const [step, setStep] = useState<Step>(!choice ? 'choose' : answeredAny ? 'turns' : 'sheet');
  const [turnIdx, setTurnIdx] = useState(() => {
    const open = turns.findIndex((tn) => textOf(tn.id).trim() === '');
    return answeredAny ? (open === -1 ? turns.length - 1 : open) : 0;
  });
  // The sheet next to the turns: open by default when the choice has a written stimulus to talk about; a tap on the toggle decides.
  const [sheetToggled, setSheetToggled] = useState<boolean | null>(null);
  const sheetOpen = sheetToggled ?? !!choice?.input;
  const [notesOpen, setNotesOpen] = useState(false);
  const turn = turns[Math.min(turnIdx, Math.max(0, turns.length - 1))];

  // A task that follows another carries the inherited choice in its own answer as well.
  const latest = useRef({ onAnswer, onHoldClock, onScrollTo });
  useEffect(() => {
    latest.current = { onAnswer, onHoldClock, onScrollTo };
  });
  useEffect(() => {
    if (task.follows !== undefined && choiceId && answer.choice !== choiceId) latest.current.onAnswer('choice', choiceId);
  }, [task.follows, choiceId, answer.choice]);

  // --- Preparation: the sheet with a countdown; it ends by the button or by itself, and the paper's clock waits for it.
  const prep = task.prepSeconds && task.prepSeconds > 0 ? task.prepSeconds : 0;
  const inPrep = step === 'sheet' && prep > 0;
  const [prepLeft, setPrepLeft] = useState(prep);
  useEffect(() => {
    if (!inPrep) return;
    latest.current.onHoldClock?.(true);
    const end = Date.now() + prep * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setPrepLeft(left);
      if (left <= 0) {
        clearInterval(id);
        setStep('turns');
      }
    }, 1000);
    return () => {
      clearInterval(id);
      latest.current.onHoldClock?.(false);
    };
  }, [inPrep, prep]);

  // --- The examiner speaks the question once when the turn opens (and again on request); it stops when the turn goes away.
  const turnAsk = turn?.ask;
  useEffect(() => {
    if (step !== 'turns' || !turnAsk) return;
    if (canSpeak) speak(turnAsk, speechLang(target));
    return () => stopSpeaking();
  }, [step, turnIdx, turnAsk, canSpeak, target]);

  // --- With the keyboard up the scroller shows the question and the field: when the keyboard comes up while the field has the
  // focus (its viewport shrinks first, hence the short wait), when the field gets the focus with the keyboard already up, and
  // when the next question is opened (a longer question moves the field).
  const blockY = useRef(0);
  const focused = useRef(false);
  const keyboardUp = useRef(false);
  const reveal = useCallback(() => latest.current.onScrollTo?.(blockY.current), []);
  useEffect(() => {
    if (step !== 'turns') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(reveal, 100);
    };
    keyboardUp.current = Keyboard.isVisible();
    const show = Keyboard.addListener('keyboardDidShow', () => {
      keyboardUp.current = true;
      if (focused.current) soon();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardUp.current = false;
    });
    if (focused.current && keyboardUp.current) soon();
    return () => {
      clearTimeout(timer);
      show.remove();
      hide.remove();
    };
  }, [step, turnIdx, reveal]);

  const replay = () => {
    if (!turn) return;
    stopSpeaking();
    speak(turn.ask, speechLang(target));
  };

  // --- The one primary button at the bottom (docked above the keyboard on the exam screen).
  const lastTurn = turnIdx >= turns.length - 1;
  const primary =
    step === 'choose'
      ? { label: s.continue, disabled: !choice, onPress: () => setStep('sheet') }
      : step === 'sheet'
        ? { label: s.speakStart, disabled: false, onPress: () => setStep('turns') }
        : !lastTurn
          ? { label: s.speakNextQuestion, disabled: false, onPress: () => setTurnIdx(turnIdx + 1) }
          : { label: lastTask ? s.finishPaper : s.nextTask, disabled: false, onPress: () => onNextTask?.() };
  const { docked } = useDockedAction({ label: primary.label, tone: 'next', testID: 'mock-speaking-primary', disabled: primary.disabled, onPress: primary.onPress });

  const hint = step === 'choose' ? s.speakHintChoose : step === 'sheet' ? (prep > 0 ? s.speakHintPrep : s.speakHintSheet) : s.speakHintTurns;
  const notes = (
    <>
      <Text style={[styles.question, { color: colors.text }]}>{s.speakNotes}</Text>
      <TextInput
        testID="mock-speaking-notes"
        accessibilityLabel={s.speakNotes}
        value={textOf('notes')}
        onChangeText={(v) => onAnswer('notes', v)}
        placeholder={s.speakNotesPlaceholder}
        placeholderTextColor={colors.textMuted}
        multiline
        style={[styles.input, styles.textarea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
      />
    </>
  );

  return (
    <>
      <MockTaskFrame instruction={task.instruction} hint={hint} glossary={glossary}>
        {step === 'choose' && (
          <View style={styles.options}>
            {task.choices.map((c, i) => {
              const on = c.id === choice?.id;
              return (
                <Pressable
                  key={c.id}
                  testID={`mock-speaking-choice-${c.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onAnswer('choice', c.id)}
                  style={[styles.option, { backgroundColor: on ? colors.tint : colors.card, borderColor: on ? colors.tint : colors.border }]}
                >
                  <Text style={[styles.optionLetter, { color: on ? colors.onTint : colors.textMuted }]}>{letterOf(i)}</Text>
                  <View style={local.choiceText}>
                    <Text style={[styles.bold, { color: on ? colors.onTint : colors.text }]}>{c.title}</Text>
                    <Text style={[styles.small, { color: on ? colors.onTint : colors.textMuted }]}>{firstSentence(c.prompt)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {step === 'sheet' && choice && (
          <>
            <SpeakingSheet choice={choice} talkMinutes={task.talkMinutes} />
            {prep > 0 && (
              <>
                <Text testID="mock-speaking-prep-left" style={[styles.bold, { color: prepLeft <= 60 ? colors.warning : colors.tint }]}>
                  {s.speakPrepLeft(formatClock(prepLeft))}
                </Text>
                {notes}
              </>
            )}
          </>
        )}

        {step === 'turns' && choice && turn && (
          <>
            {choice.photos?.length ? <SpeakingPhotos keys={choice.photos} /> : null}
            <Pressable testID="mock-speaking-sheet-toggle" accessibilityRole="button" style={styles.linkBox} onPress={() => setSheetToggled(!sheetOpen)}>
              <Text style={[styles.link, { color: colors.tint }]}>{sheetOpen ? s.speakSheetHide : s.speakSheetShow}</Text>
            </Pressable>
            {sheetOpen && (
              <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SpeakingSheet choice={choice} talkMinutes={task.talkMinutes} photos={false} />
              </View>
            )}
            <View
              testID="mock-speaking-turn"
              style={styles.wrap}
              onLayout={(e) => {
                blockY.current = e.nativeEvent.layout.y;
              }}
            >
              <Text testID="mock-speaking-turn-counter" style={[styles.small, { color: colors.textMuted }]}>
                {s.speakQuestionOf(turnIdx + 1, turns.length)}
              </Text>
              <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.small, { color: colors.textMuted }]}>{s.speakExaminer}</Text>
                <Text testID="mock-speaking-ask" style={[styles.bold, { color: colors.text }]}>
                  {turn.ask}
                </Text>
                {canSpeak ? (
                  <Pressable testID="mock-speaking-replay" accessibilityRole="button" onPress={replay} style={styles.linkBox}>
                    <Text style={[styles.link, { color: colors.tint }]}>🔊 {s.speakReplay}</Text>
                  </Pressable>
                ) : (
                  <Text testID="mock-speaking-no-voice" style={[styles.small, { color: colors.warning }]}>
                    {s.speakNoVoice}
                  </Text>
                )}
              </View>
              {/* Intentionally no answerInputProps (as in ExamSpeakCard): it would turn off the suggestion bar and could hide the
                  keyboard's microphone button; the answer is dictated with the stock keyboard. The field keeps its focus (and the
                  keyboard stays up) from one question to the next. With a photo or a written stimulus to look at it does not grab
                  the keyboard by itself: the learner looks first, then taps the field. */}
              <TextInput
                testID="mock-speaking-answer"
                accessibilityLabel={turn.ask}
                value={textOf(turn.id)}
                onChangeText={(v) => onAnswer(turn.id, v)}
                onFocus={() => {
                  focused.current = true;
                  if (keyboardUp.current) reveal();
                }}
                onBlur={() => {
                  focused.current = false;
                }}
                placeholder={s.speakAnswerPlaceholder}
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus={!choice.photos?.length && !choice.input}
                style={[styles.input, local.answer, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              />
              <Text testID="mock-speaking-hint" style={[styles.small, { color: colors.textMuted }]}>
                {s.speakAnswerHint}
              </Text>
              <Text testID="mock-speaking-words" style={[styles.small, { color: countWords(textOf(turn.id)) >= turn.minWords ? colors.success : colors.textMuted }]}>
                {s.speakWords(countWords(textOf(turn.id)), turn.minWords)}
              </Text>
              {turnIdx > 0 && (
                <Pressable testID="mock-speaking-prev" accessibilityRole="button" style={styles.linkBox} onPress={() => setTurnIdx(turnIdx - 1)}>
                  <Text style={[styles.link, { color: colors.tint }]}>← {s.speakPrevQuestion}</Text>
                </Pressable>
              )}
            </View>
            {prep > 0 && (
              <>
                <Pressable testID="mock-speaking-notes-toggle" accessibilityRole="button" style={styles.linkBox} onPress={() => setNotesOpen((v) => !v)}>
                  <Text style={[styles.link, { color: colors.tint }]}>{notesOpen ? s.speakNotesHide : s.speakNotesShow}</Text>
                </Pressable>
                {notesOpen && notes}
              </>
            )}
          </>
        )}
      </MockTaskFrame>
      {/* docked: the bar is the screen's, and the scroller ends above it (app/mock-exam.tsx), so no room is left here */}
      {docked ? null : <ExamButton testID="mock-speaking-primary" label={primary.label} disabled={primary.disabled} onPress={primary.onPress} />}
    </>
  );
}

const local = StyleSheet.create({
  choiceText: { flex: 1, gap: spacing.xs },
  // a window of 4 to 7 lines (the text scrolls inside when it is longer), so the field, the word count and the button are in view together
  answer: { minHeight: lineHeight.md * 4 + spacing.sm * 2 + 2, maxHeight: lineHeight.md * 7 + spacing.sm * 2 + 2, textAlignVertical: 'top' },
});
