import { StyleSheet, Text, View } from 'react-native';

import { charDiff } from '@/lib/charDiff';
import { t } from '@/lib/i18n';
import type { GrammarColors } from '@/lib/grammarColors';

// FB416 (PLAN-fb0929 3. lépés): hibás válasznál a tanuló saját válasza és a
// helyes egymás alatt, a különbség kiemelve mindkét sorban: a saját sorban a
// rossz betűk fordított (sötét) mezőn és áthúzva, a helyes sorban a hiányzó /
// eltérő betűk a kitöltés színén és aláhúzva. Az alak (fordított mező, áthúzás,
// aláhúzás) is jelez, nem csak a szín. A kis- és nagybetű eltérése nem hiba,
// az ékezeté igen (ugyanaz, mint a ragozás-drill bírálata és a table-deck diffje).
// Karakter-szintű összevetés: lib/charDiff.ts.
export default function AnswerCompare({
  typed,
  correct,
  g,
  onFill = false,
}: {
  typed: string;
  correct: string;
  g: GrammarColors;
  // true, ha színes kitöltésű doboz (pl. b) belsejében áll: a szöveg on-fill színű.
  onFill?: boolean;
}) {
  const s = t();
  const base = onFill ? g.onFill : g.ink;
  const muted = onFill ? g.onFill : g.mu;
  const fold = { case: true, accents: false };
  // A saját sor: a nem-egyező betűk jelölve; a kihagyott betűk (missing) nem a
  // tanuló írásai, ezért nem jelennek meg itt, csak a helyes sorban.
  const typedChars = typed.trim().length > 0 ? charDiff(typed, correct, fold).filter((d) => !d.missing) : [];
  // A helyes sor: amelyik betű nincs meg a tanuló válaszában, az ki van emelve.
  const correctChars = charDiff(correct, typed, fold).filter((d) => !d.missing);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: muted }]}>{s.grammar.yourAnswer}</Text>
      <Text testID="answer-compare-typed" style={[styles.line, { color: base }]}>
        {typedChars.length === 0 ? ', ' : null}
        {typedChars.map((d, i) => (
          <Text
            key={i}
            style={d.wrong ? { backgroundColor: g.ink, color: g.bg, textDecorationLine: 'line-through' } : undefined}
          >
            {d.ch}
          </Text>
        ))}
      </Text>
      <Text style={[styles.label, { color: muted }]}>{s.grammar.correctAnswer}</Text>
      <Text testID="answer-compare-correct" style={[styles.line, { color: base }]}>
        {correctChars.map((d, i) => (
          <Text
            key={i}
            style={d.wrong ? { backgroundColor: g.a, color: g.onFill, textDecorationLine: 'underline' } : undefined}
          >
            {d.ch}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  line: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
});
