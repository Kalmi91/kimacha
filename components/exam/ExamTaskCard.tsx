import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { speak, stop as stopSpeaking } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { countWords, type TaskAnswer } from '@/lib/exam/score';
import type { ExamTask } from '@/lib/exam/types';

// One exam task on screen: the instruction line in the TARGET language (as on a
// real paper), then its items. Nothing here tells the learner whether an answer
// is right: in an exam you find out at the end, and that is the whole point of
// the rework (Kálmán, 2026-09-08).

interface Props {
  task: ExamTask;
  answer: TaskAnswer;
  onAnswer: (key: string, value: string | boolean | number | null) => void;
  learnedLang: string;
  /** False when the device has no TTS voice for the learned language (FB144). */
  canSpeak: boolean;
}

const MAX_PLAYS = 2; // a real listening paper plays each recording twice

export default function ExamTaskCard({ task, answer, onAnswer, learnedLang, canSpeak }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [plays, setPlays] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const playingRef = useRef(false);

  // The screen mounts this card with key={task.id}, so a new task arrives as a
  // fresh component and the play counter starts at zero on its own; the effect
  // only has to stop any audio still speaking when the card goes away.
  useEffect(() => {
    return () => {
      playingRef.current = false;
      stopSpeaking();
    };
  }, []);

  const isListening = task.kind === 'listen_mc' || task.kind === 'listen_dialogue' || task.kind === 'listen_match';
  const audioLines = useMemo(() => ('audio' in task && task.audio ? task.audio : []), [task]);

  const playAudio = () => {
    if (plays >= MAX_PLAYS || audioLines.length === 0) return;
    setPlays((p) => p + 1);
    // One utterance per line keeps the pauses between speakers natural.
    audioLines.forEach((line) => speak(line, speechLang(learnedLang)));
  };

  const optionRow = (
    options: string[],
    selected: number | undefined,
    onPick: (index: number) => void,
    keyPrefix: string
  ) => (
    <View style={styles.options}>
      {options.map((opt, i) => {
        const picked = selected === i;
        return (
          <Pressable
            key={`${keyPrefix}-${i}`}
            testID={`exam-option-${keyPrefix}-${i}`}
            onPress={() => onPick(i)}
            style={[
              styles.option,
              { borderColor: picked ? colors.tint : colors.tabIconDefault, backgroundColor: picked ? `${colors.tint}22` : colors.card },
            ]}
          >
            <Text style={[styles.optionLetter, { color: picked ? colors.tint : colors.tabIconDefault }]}>
              {String.fromCharCode(65 + i)}
            </Text>
            <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.instruction, { color: colors.tint }]}>{task.instruction}</Text>

      {isListening ? (
        <View style={[styles.audioBox, { borderColor: colors.tabIconDefault }]}>
          {canSpeak ? (
            <>
              <Pressable
                testID="exam-play"
                onPress={playAudio}
                disabled={plays >= MAX_PLAYS}
                style={[styles.playBtn, { backgroundColor: plays >= MAX_PLAYS ? colors.tabIconDefault : colors.tint }]}
              >
                <Text style={styles.playBtnText}>🔊 {s.exam.play}</Text>
              </Pressable>
              <Text style={[styles.playsLeft, { color: colors.tabIconDefault }]}>
                {s.exam.playsLeft(Math.max(0, MAX_PLAYS - plays))}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.noVoice, { color: colors.text }]}>{s.exam.noVoice}</Text>
              <Pressable onPress={() => setShowTranscript((v) => !v)}>
                <Text style={[styles.transcriptToggle, { color: colors.tint }]}>
                  {showTranscript ? s.exam.hideTranscript : s.exam.showTranscript}
                </Text>
              </Pressable>
            </>
          )}
          {showTranscript ? (
            <Text style={[styles.transcript, { color: colors.tabIconDefault }]}>{audioLines.join('\n')}</Text>
          ) : null}
        </View>
      ) : null}

      {'title' in task && task.title ? <Text style={[styles.title, { color: colors.text }]}>{task.title}</Text> : null}

      {(task.kind === 'text_mc' || task.kind === 'true_false') && task.text ? (
        <View style={[styles.textBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.bodyText, { color: colors.text }]}>{task.text}</Text>
        </View>
      ) : null}

      {task.kind === 'text_mc' || task.kind === 'listen_mc' || task.kind === 'listen_dialogue'
        ? task.questions.map((q, i) => (
            <View key={`q-${i}`} style={styles.item}>
              <Text style={[styles.question, { color: colors.text }]}>
                {i + 1}. {q.q}
              </Text>
              {optionRow(q.options, answer[String(i)] as number | undefined, (idx) => onAnswer(String(i), idx), `q${i}`)}
            </View>
          ))
        : null}

      {task.kind === 'true_false'
        ? task.statements.map((st, i) => {
            const given = answer[String(i)];
            return (
              <View key={`st-${i}`} style={styles.item}>
                <Text style={[styles.question, { color: colors.text }]}>
                  {i + 1}. {st.s}
                </Text>
                <View style={styles.tfRow}>
                  <Pressable
                    testID={`exam-tf-${i}-true`}
                    onPress={() => onAnswer(String(i), true)}
                    style={[
                      styles.tfBtn,
                      { borderColor: given === true ? '#22C55E' : colors.tabIconDefault, backgroundColor: given === true ? '#22C55E22' : colors.card },
                    ]}
                  >
                    <Text style={[styles.tfText, { color: colors.text }]}>✓ {s.exam.true_}</Text>
                  </Pressable>
                  <Pressable
                    testID={`exam-tf-${i}-false`}
                    onPress={() => onAnswer(String(i), false)}
                    style={[
                      styles.tfBtn,
                      { borderColor: given === false ? '#EF4444' : colors.tabIconDefault, backgroundColor: given === false ? '#EF444422' : colors.card },
                    ]}
                  >
                    <Text style={[styles.tfText, { color: colors.text }]}>✗ {s.exam.false_}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        : null}

      {task.kind === 'gap_mc'
        ? (() => {
            const parts = task.text.split('___');
            return (
              <>
                <View style={[styles.textBox, { backgroundColor: colors.card }]}>
                  <Text style={[styles.bodyText, { color: colors.text }]}>
                    {parts.map((part, i) => (
                      <Text key={`p-${i}`}>
                        {part}
                        {i < task.gaps.length ? (
                          <Text style={{ color: colors.tint, fontWeight: '700' }}>
                            {' '}
                            [{i + 1}
                            {typeof answer[String(i)] === 'number' ? `: ${task.gaps[i].options[answer[String(i)] as number]}` : ''}]{' '}
                          </Text>
                        ) : null}
                      </Text>
                    ))}
                  </Text>
                </View>
                {task.gaps.map((gap, i) => (
                  <View key={`g-${i}`} style={styles.item}>
                    <Text style={[styles.question, { color: colors.text }]}>{i + 1}.</Text>
                    {optionRow(gap.options, answer[String(i)] as number | undefined, (idx) => onAnswer(String(i), idx), `g${i}`)}
                  </View>
                ))}
              </>
            );
          })()
        : null}

      {task.kind === 'match' || task.kind === 'listen_match'
        ? (() => {
            const used = new Set(Object.values(answer).filter((v) => typeof v === 'string') as string[]);
            return (
              <>
                <View style={[styles.textBox, { backgroundColor: colors.card }]}>
                  {task.options.map((opt) => (
                    <Text key={opt.id} style={[styles.bodyText, { color: colors.text }]}>
                      <Text style={{ fontWeight: '800', color: colors.tint }}>{opt.id.toUpperCase()}. </Text>
                      {opt.text}
                    </Text>
                  ))}
                </View>
                {task.prompts.map((prompt, i) => (
                  <View key={prompt.id} style={styles.item}>
                    <Text style={[styles.question, { color: colors.text }]}>
                      {i + 1}. {prompt.text}
                    </Text>
                    <View style={styles.letterRow}>
                      {task.options.map((opt) => {
                        const picked = answer[prompt.id] === opt.id;
                        const takenElsewhere = !picked && used.has(opt.id);
                        return (
                          <Pressable
                            key={opt.id}
                            testID={`exam-match-${prompt.id}-${opt.id}`}
                            onPress={() => onAnswer(prompt.id, picked ? null : opt.id)}
                            style={[
                              styles.letterBtn,
                              {
                                borderColor: picked ? colors.tint : colors.tabIconDefault,
                                backgroundColor: picked ? colors.tint : colors.card,
                                opacity: takenElsewhere ? 0.35 : 1,
                              },
                            ]}
                          >
                            <Text style={[styles.letterText, { color: picked ? '#FFFFFF' : colors.text }]}>
                              {opt.id.toUpperCase()}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            );
          })()
        : null}

      {task.kind === 'form_fill' ? (
        <>
          <Text style={[styles.bodyText, { color: colors.text, marginBottom: 8 }]}>{task.context}</Text>
          {task.fields.map((field) => (
            <View key={field.id} style={styles.item}>
              <Text style={[styles.fieldLabel, { color: colors.tabIconDefault }]}>{field.label}</Text>
              <TextInput
                testID={`exam-field-${field.id}`}
                {...answerInputProps}
                value={String(answer[field.id] ?? '')}
                onChangeText={(v) => onAnswer(field.id, v)}
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault, backgroundColor: colors.card }]}
              />
            </View>
          ))}
        </>
      ) : null}

      {task.kind === 'short_message' ? (
        <>
          <Text style={[styles.bodyText, { color: colors.text, marginBottom: 8 }]}>{task.prompt}</Text>
          <TextInput
            testID="exam-message"
            {...answerInputProps}
            value={String(answer.text ?? '')}
            onChangeText={(v) => onAnswer('text', v)}
            multiline
            style={[styles.textarea, { color: colors.text, borderColor: colors.tabIconDefault, backgroundColor: colors.card }]}
          />
          <Text style={[styles.wordCount, { color: colors.tabIconDefault }]}>
            {s.exam.wordCount(countWords(String(answer.text ?? '')), task.minWords)}
          </Text>
        </>
      ) : null}

      {task.kind === 'speaking_prompt' ? (
        <>
          <Text style={[styles.bodyText, { color: colors.text }]}>{task.prompt}</Text>
          {task.bullets?.length ? (
            <View style={styles.bullets}>
              {task.bullets.map((b) => (
                <Text key={b} style={[styles.bullet, { color: colors.tabIconDefault }]}>
                  • {b}
                </Text>
              ))}
            </View>
          ) : null}

          <Pressable
            testID="exam-model-toggle"
            onPress={() => onAnswer('modelShown', true)}
            style={[styles.modelBtn, { borderColor: colors.tint }]}
          >
            <Text style={[styles.modelBtnText, { color: colors.tint }]}>{s.exam.showModel}</Text>
          </Pressable>

          {answer.modelShown ? (
            <View style={[styles.textBox, { backgroundColor: colors.card }]}>
              <Text style={[styles.bodyText, { color: colors.text }]}>{task.model}</Text>
              {canSpeak ? (
                <Pressable onPress={() => speak(task.model, speechLang(learnedLang))} style={styles.modelSpeak}>
                  <Text style={{ fontSize: 20 }}>🔊</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.fieldLabel, { color: colors.tabIconDefault, marginTop: 12 }]}>{s.exam.selfRate}</Text>
          <View style={styles.tfRow}>
            {[2, 1, 0].map((value) => {
              const picked = Number(answer.self ?? -1) === value;
              return (
                <Pressable
                  key={value}
                  testID={`exam-self-${value}`}
                  onPress={() => onAnswer('self', value)}
                  style={[
                    styles.tfBtn,
                    { borderColor: picked ? colors.tint : colors.tabIconDefault, backgroundColor: picked ? `${colors.tint}22` : colors.card },
                  ]}
                >
                  <Text style={[styles.tfText, { color: colors.text }]}>
                    {value === 2 ? s.exam.selfGood : value === 1 ? s.exam.selfPartly : s.exam.selfNo}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  instruction: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  title: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  textBox: { borderRadius: 14, padding: 14, gap: 6 },
  bodyText: { fontSize: 15, lineHeight: 22 },
  item: { marginTop: 10, gap: 6 },
  question: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  options: { gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  optionLetter: { fontSize: 13, fontWeight: '800', width: 16 },
  optionText: { fontSize: 15, flex: 1 },
  tfRow: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  tfText: { fontSize: 14, fontWeight: '600' },
  letterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  letterBtn: { borderWidth: 1.5, borderRadius: 10, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 15, fontWeight: '800' },
  audioBox: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 8 },
  playBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  playBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  playsLeft: { fontSize: 12 },
  noVoice: { fontSize: 13, textAlign: 'center' },
  transcriptToggle: { fontSize: 13, fontWeight: '600' },
  transcript: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  textarea: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 140, textAlignVertical: 'top' },
  wordCount: { fontSize: 12, textAlign: 'right' },
  bullets: { gap: 2, marginTop: 4 },
  bullet: { fontSize: 14 },
  modelBtn: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  modelBtnText: { fontSize: 14, fontWeight: '600' },
  modelSpeak: { alignSelf: 'flex-end' },
});
