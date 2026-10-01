import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import type { GlossaryEntry } from '@/lib/exam/mock/glossary';
import { countWords } from '@/lib/exam/mock/score';
import type { MockTarget, MockTask, MockTaskAnswer } from '@/lib/exam/mock/types';
import { answerInputProps } from '@/lib/inputProps';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { speak, stop as stopSpeaking } from '@/lib/speech';
import { useTheme } from '@/lib/ThemeContext';

// PLAN-vizsga E. szakasz (15-16. lépés): egy próbavizsga-feladat a képernyőn. A régi
// (4afeb8c^) components/exam/ExamTaskCard.tsx szerkezete: az utasítás a CÉLNYELVEN, mint egy
// valódi papíron (alatta a felület nyelvén egy rövid segítség), aztán a tételek. Semmi nem
// mondja meg, jó-e a válasz: a vizsgán a végén derül ki. Az ismeretlen szóhoz szójegyzet
// jár (Kálmán E5 c), koppintásra nyílik. A hallásnál legfeljebb 2 lejátszás (MAX_PLAYS).

export const MAX_PLAYS = 2;

type Props = {
  task: MockTask;
  answer: MockTaskAnswer;
  onAnswer: (key: string, value: string | number | boolean | null) => void;
  /** A tanult nyelv (a felolvasás nyelve). */
  target: MockTarget;
  /** Hamis, ha az eszközön nincs hang a tanult nyelvhez: ilyenkor a szöveg látszik. */
  canSpeak: boolean;
  glossary: GlossaryEntry[];
};

export default function MockTaskCard({ task, answer, onAnswer, target, canSpeak, glossary }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;

  const [plays, setPlays] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const playingRef = useRef(false);

  // A képernyő key={task.id}-vel építi újra a kártyát, így az új feladat nulla lejátszással indul;
  // a kártya eltűnésekor a még szóló felvétel leáll.
  useEffect(() => {
    return () => {
      playingRef.current = false;
      stopSpeaking();
    };
  }, []);

  const isListening = task.kind === 'listen_mc' || task.kind === 'listen_dialogue' || task.kind === 'listen_match';
  const audioLines = 'audio' in task && task.audio ? task.audio : [];
  const isDialogue = task.kind === 'listen_dialogue';

  const playAudio = () => {
    // Amíg szól a felvétel, a gomb néma (a dupla koppintás ne égessen el két meghallgatást).
    if (playingRef.current || plays >= MAX_PLAYS || audioLines.length === 0) return;
    playingRef.current = true;
    setPlays((p) => p + 1);
    stopSpeaking();
    const release = () => {
      playingRef.current = false;
    };
    // Soronként egy felolvasás; a párbeszédben a páratlan sorok mélyebb hangon szólnak (két beszélő).
    audioLines.forEach((line, i) => {
      const last = i === audioLines.length - 1;
      speak(line, speechLang(target), {
        ...(isDialogue && i % 2 === 1 ? { pitch: 0.8 } : {}),
        ...(last ? { onDone: release, onStopped: release, onError: release } : {}),
      });
    });
  };

  const optionRow = (options: string[], picked: unknown, onPick: (i: number) => void, id: string) => (
    <View style={styles.options}>
      {options.map((opt, i) => {
        const on = picked === i;
        return (
          <Pressable
            key={`${i}-${opt}`}
            testID={`mock-option-${id}-${i}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(i)}
            style={[styles.option, { backgroundColor: on ? colors.tint : colors.card, borderColor: on ? colors.tint : colors.border }]}
          >
            <Text style={[styles.optionLetter, { color: on ? colors.onTint : colors.textMuted }]}>{String.fromCharCode(65 + i)}</Text>
            <Text style={[styles.optionText, { color: on ? colors.onTint : colors.text }]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const box = (children: ReactNode) => <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>;

  return (
    <View style={styles.wrap}>
      <Text testID="mock-instruction" style={[styles.instruction, { color: colors.tint }]}>
        {task.instruction}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{s.hint[task.kind]}</Text>

      {isListening && (
        <View style={[styles.audioBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {canSpeak ? (
            <>
              <Pressable
                testID="mock-play"
                accessibilityRole="button"
                onPress={playAudio}
                disabled={plays >= MAX_PLAYS}
                style={[styles.playBtn, { backgroundColor: plays >= MAX_PLAYS ? colors.border : colors.tint }]}
              >
                <Text style={[styles.playText, { color: colors.onTint }]}>🔊 {s.play}</Text>
              </Pressable>
              <Text testID="mock-plays-left" style={[styles.small, { color: colors.textMuted }]}>
                {s.playsLeft(Math.max(0, MAX_PLAYS - plays))}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.body, { color: colors.warning }]}>{s.noVoice}</Text>
              <Pressable testID="mock-transcript-toggle" accessibilityRole="button" style={styles.linkBox} onPress={() => setShowTranscript((v) => !v)}>
                <Text style={[styles.link, { color: colors.tint }]}>{showTranscript ? s.hideTranscript : s.showTranscript}</Text>
              </Pressable>
            </>
          )}
          {showTranscript && (
            <Text testID="mock-transcript" style={[styles.small, { color: colors.textMuted }]}>
              {(isDialogue ? audioLines.map((line, i) => `${i % 2 === 0 ? s.speakerA : s.speakerB}: ${line}`) : audioLines).join('\n')}
            </Text>
          )}
        </View>
      )}

      {task.kind === 'read_mc' &&
        task.passages.map((p, i) => (
          <View key={`p-${i}`} style={styles.item}>
            {box(<Text style={[styles.body, { color: colors.text }]}>{p.text}</Text>)}
            <Text style={[styles.question, { color: colors.text }]}>
              {i + 1}. {s.whatSays}
            </Text>
            {optionRow(p.options, answer[String(i)], (idx) => onAnswer(String(i), idx), `r${i}`)}
          </View>
        ))}

      {(task.kind === 'listen_mc' || task.kind === 'listen_dialogue') &&
        task.questions.map((q, i) => (
          <View key={`q-${i}`} style={styles.item}>
            <Text style={[styles.question, { color: colors.text }]}>
              {i + 1}. {task.kind === 'listen_dialogue' ? s.lineQuestion(i + 1) : s.whatHeard}
            </Text>
            {optionRow(q.options, answer[String(i)], (idx) => onAnswer(String(i), idx), `l${i}`)}
          </View>
        ))}

      {task.kind === 'true_false' && (
        <>
          {box(<Text style={[styles.body, { color: colors.text }]}>{task.text}</Text>)}
          {task.statements.map((st, i) => {
            const given = answer[String(i)];
            return (
              <View key={`st-${i}`} style={styles.item}>
                <Text style={[styles.question, { color: colors.text }]}>
                  {i + 1}. {st.s}
                </Text>
                <View style={styles.tfRow}>
                  {[true, false].map((value) => {
                    const on = given === value;
                    return (
                      <Pressable
                        key={String(value)}
                        testID={`mock-tf-${i}-${value}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => onAnswer(String(i), value)}
                        style={[styles.tfBtn, { backgroundColor: on ? colors.tint : colors.card, borderColor: on ? colors.tint : colors.border }]}
                      >
                        <Text style={[styles.tfText, { color: on ? colors.onTint : colors.text }]}>
                          {value ? `✓ ${s.true_}` : `✗ ${s.false_}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </>
      )}

      {task.kind === 'gap_mc' &&
        task.gaps.map((g, i) => (
          <View key={`g-${i}`} style={styles.item}>
            {box(
              <Text style={[styles.body, { color: colors.text }]}>
                {i + 1}. {g.text}
              </Text>,
            )}
            {optionRow(g.options, answer[String(i)], (idx) => onAnswer(String(i), idx), `g${i}`)}
          </View>
        ))}

      {(task.kind === 'match' || task.kind === 'listen_match') &&
        (() => {
          const used = new Set(Object.values(answer).filter((v) => typeof v === 'string') as string[]);
          return (
            <>
              {box(
                task.options.map((opt) => (
                  <Text key={opt.id} style={[styles.body, { color: colors.text }]}>
                    <Text style={{ fontWeight: fontWeight.bold, color: colors.tint }}>{opt.id.toUpperCase()}. </Text>
                    {opt.text}
                  </Text>
                )),
              )}
              {task.prompts.map((prompt, i) => (
                <View key={prompt.id} style={styles.item}>
                  <Text style={[styles.question, { color: colors.text }]}>
                    {i + 1}. {task.kind === 'match' ? prompt.text : s.recording(i + 1)}
                  </Text>
                  <View style={styles.letterRow}>
                    {task.options.map((opt) => {
                      const on = answer[prompt.id] === opt.id;
                      const taken = !on && used.has(opt.id);
                      return (
                        <Pressable
                          key={opt.id}
                          testID={`mock-match-${prompt.id}-${opt.id}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() => onAnswer(prompt.id, on ? null : opt.id)}
                          style={[
                            styles.letterBtn,
                            { backgroundColor: on ? colors.tint : colors.card, borderColor: on ? colors.tint : colors.border, opacity: taken ? 0.35 : 1 },
                          ]}
                        >
                          <Text style={[styles.letterText, { color: on ? colors.onTint : colors.text }]}>{opt.id.toUpperCase()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </>
          );
        })()}

      {task.kind === 'form_fill' && (
        <>
          <Text style={[styles.body, { color: colors.text }]}>{task.context}</Text>
          {task.fields.map((f) => (
            <View key={f.id} style={styles.item}>
              <Text style={[styles.small, { color: colors.textMuted }]}>{f.label}</Text>
              <TextInput
                testID={`mock-field-${f.id}`}
                {...answerInputProps}
                value={String(answer[f.id] ?? '')}
                onChangeText={(v) => onAnswer(f.id, v)}
                keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              />
            </View>
          ))}
        </>
      )}

      {task.kind === 'short_message' && (
        <>
          <Text style={[styles.body, { color: colors.text }]}>{task.prompt}</Text>
          <TextInput
            testID="mock-message"
            {...answerInputProps}
            value={String(answer.text ?? '')}
            onChangeText={(v) => onAnswer('text', v)}
            multiline
            style={[styles.input, styles.textarea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text testID="mock-word-count" style={[styles.small, { color: colors.textMuted }]}>
            {s.wordCount(countWords(String(answer.text ?? '')), task.minWords)}
          </Text>
        </>
      )}

      {glossary.length > 0 && (
        <View style={styles.glossary}>
          <Pressable testID="mock-glossary-toggle" accessibilityRole="button" style={styles.linkBox} onPress={() => setShowGlossary((v) => !v)}>
            <Text style={[styles.link, { color: colors.tint }]}>{showGlossary ? s.glossaryHide : s.glossaryShow(glossary.length)}</Text>
          </Pressable>
          {showGlossary &&
            glossary.map((e) => (
              <Text key={e.itemId} testID="mock-glossary-entry" style={[styles.small, { color: colors.text }]}>
                {e.term} = {e.meaning}
              </Text>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  instruction: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: lineHeight.md },
  hint: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  body: { fontSize: fontSize.md, lineHeight: lineHeight.md },
  small: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  linkBox: { minHeight: tapTarget, justifyContent: 'center' },
  item: { gap: spacing.sm },
  question: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: lineHeight.md },
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  options: { gap: spacing.sm },
  option: { minHeight: tapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  optionLetter: { fontSize: fontSize.md, fontWeight: fontWeight.bold, width: spacing.lg },
  optionText: { flex: 1, fontSize: fontSize.md, lineHeight: lineHeight.md },
  tfRow: { flexDirection: 'row', gap: spacing.sm },
  tfBtn: { flex: 1, minHeight: tapTarget, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.md },
  tfText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  letterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  letterBtn: { width: tapTarget, minHeight: tapTarget, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.md },
  letterText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  audioBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, alignItems: 'flex-start' },
  playBtn: { minHeight: tapTarget, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  playText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: tapTarget, fontSize: fontSize.md },
  textarea: { minHeight: tapTarget * 3, textAlignVertical: 'top' },
  glossary: { gap: spacing.xs },
});
