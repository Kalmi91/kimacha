// The English grammar syllabus (es→en direction: a Spanish speaker learning
// English). Generated at import time from the English topic tree, so the
// topic list, order and names live in one place (data/topics/en/*.json,
// data/sublevels/en/*.json) and nothing is copied into code.
//
// Levels are A1, A2, B1, B2 and C1. The A0 `basic_verbs` topic is the very first
// topic of A1 (unit A1.1); the A0 sublevels themselves are not units here.
// Units are the sublevels (A1.1-A1.6, A2.1-A2.5, B1.5-B1.8, B2.1-B2.4, C1.1-C1.4). The B1 sublevels
// B1.1-B1.4 hold vocabulary topics only, so they are not grammar units. The
// topic tree carries no one-line blurb, so `blurb` is empty and the screen
// shows no second line.

import type { SyllabusTopic, SyllabusUnit } from './syllabus';
import a0Topics from '@/data/topics/en/a0.json';
import a1Topics from '@/data/topics/en/a1.json';
import a2Topics from '@/data/topics/en/a2.json';
import b1Topics from '@/data/topics/en/b1.json';
import b2Topics from '@/data/topics/en/b2.json';
import c1Topics from '@/data/topics/en/c1.json';
import a1Sublevels from '@/data/sublevels/en/a1.json';
import a2Sublevels from '@/data/sublevels/en/a2.json';
import b1Sublevels from '@/data/sublevels/en/b1.json';
import b2Sublevels from '@/data/sublevels/en/b2.json';
import c1Sublevels from '@/data/sublevels/en/c1.json';

interface TreeTopic {
  id: string;
  order: number;
  subLevel: string;
  type: string;
  name_hu: string;
  name_en: string;
  name_es: string;
  name_de: string;
}

interface TreeSublevel {
  id: string;
  order: number;
  name_hu: string;
  name_en: string;
  name_es: string;
  name_de: string;
}

const names = (n: { name_hu: string; name_en: string; name_es: string; name_de: string }) => ({
  hu: n.name_hu,
  en: n.name_en,
  es: n.name_es,
  de: n.name_de,
});

const grammarOf = (topics: unknown): TreeTopic[] =>
  (topics as TreeTopic[]).filter((t) => t.type === 'grammar').sort((a, b) => a.order - b.order);

const unitsOf = (level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1', sublevels: unknown): SyllabusUnit[] =>
  (sublevels as TreeSublevel[])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, level, title: names(s) }));

const topicOf = (t: TreeTopic, level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1', unit: string): SyllabusTopic => ({
  id: t.id,
  level,
  unit,
  title: names(t),
  blurb: {},
});

const b1GrammarTopics = grammarOf(b1Topics);
const b2GrammarTopics = grammarOf(b2Topics);
const c1GrammarTopics = grammarOf(c1Topics);

export const EN_UNITS: SyllabusUnit[] = [
  ...unitsOf('A1', a1Sublevels),
  ...unitsOf('A2', a2Sublevels),
  ...unitsOf('B1', b1Sublevels).filter((u) => b1GrammarTopics.some((t) => t.subLevel === u.id)),
  ...unitsOf('B2', b2Sublevels).filter((u) => b2GrammarTopics.some((t) => t.subLevel === u.id)),
  ...unitsOf('C1', c1Sublevels).filter((u) => c1GrammarTopics.some((t) => t.subLevel === u.id)),
];

export const EN_SYLLABUS: SyllabusTopic[] = [
  // A0 basic_verbs opens A1, in the first unit.
  ...grammarOf(a0Topics).map((t) => topicOf(t, 'A1', 'A1.1')),
  ...grammarOf(a1Topics).map((t) => topicOf(t, 'A1', t.subLevel)),
  ...grammarOf(a2Topics).map((t) => topicOf(t, 'A2', t.subLevel)),
  ...b1GrammarTopics.map((t) => topicOf(t, 'B1', t.subLevel)),
  ...b2GrammarTopics.map((t) => topicOf(t, 'B2', t.subLevel)),
  ...c1GrammarTopics.map((t) => topicOf(t, 'C1', t.subLevel)),
];
