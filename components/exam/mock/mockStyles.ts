import { StyleSheet } from 'react-native';

import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import type { GlossaryEntry } from '@/lib/exam/mock/glossary';
import type { MockTarget, MockTaskAnswer } from '@/lib/exam/mock/types';

// Shared bits of the authored B1-C1 task screens (components/exam/mock/*): the props every kind gets, the letter of an
// option (A, B, ...) and the styles. The look follows the older kinds in MockTaskCard (same boxes, option rows, letter buttons).

export type MockOnAnswer = (key: string, value: string | number | boolean | null) => void;

export type MockKindProps<T> = {
  task: T;
  answer: MockTaskAnswer;
  onAnswer: MockOnAnswer;
  /** The learned language (the language of the read-aloud). */
  target: MockTarget;
  /** False if the device has no voice for the learned language: then the transcript is offered. */
  canSpeak: boolean;
  glossary: GlossaryEntry[];
};

export const letterOf = (index: number) => String.fromCharCode(65 + index);

export const mockStyles = StyleSheet.create({
  wrap: { gap: spacing.md },
  instruction: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: lineHeight.md },
  hint: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  body: { fontSize: fontSize.md, lineHeight: lineHeight.md },
  bold: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: lineHeight.md },
  small: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  linkBox: { minHeight: tapTarget, justifyContent: 'center' },
  item: { gap: spacing.sm },
  question: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: lineHeight.md },
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  // a long text scrolls inside its box, so the questions under it stay near
  scrollBox: { maxHeight: tapTarget * 9 },
  optionCard: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  optionCardBox: { padding: spacing.md, gap: spacing.xs },
  options: { gap: spacing.sm },
  option: { minHeight: tapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  optionLetter: { fontSize: fontSize.md, fontWeight: fontWeight.bold, width: spacing.lg },
  optionText: { flex: 1, fontSize: fontSize.md, lineHeight: lineHeight.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { width: tapTarget, minHeight: tapTarget, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.md },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  wideChip: { minHeight: tapTarget, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  audioBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, alignItems: 'flex-start' },
  playBtn: { minHeight: tapTarget, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  playText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: tapTarget, fontSize: fontSize.md },
  inlineInput: { flexGrow: 1, minWidth: tapTarget * 3 },
  textarea: { minHeight: tapTarget * 4, textAlignVertical: 'top' },
  statement: { minHeight: tapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  statementMark: { fontSize: fontSize.lg, width: spacing.lg },
  keyBox: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  glossary: { gap: spacing.xs },
});
