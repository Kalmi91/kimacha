// The authored practice-exam papers (B1-C1, and the speaking paper of every level): the content lives in the JSON files (one
// per direction, level and paper), this module only wires them up (lib/exam/mock/authored.ts picks a form). An empty `forms`
// list = not written yet. hu (Hungarian): the A1 / A2 speaking papers and the four papers of B1, B2 and C1 (14 files).

import type { AuthoredPaperFile } from '@/lib/exam/mock/types';
import esB1Reading from './es-b1-reading.json';
import esB1Listening from './es-b1-listening.json';
import esB1Writing from './es-b1-writing.json';
import esB2Reading from './es-b2-reading.json';
import esB2Listening from './es-b2-listening.json';
import esB2Writing from './es-b2-writing.json';
import esC1Reading from './es-c1-reading.json';
import esC1Listening from './es-c1-listening.json';
import esC1Writing from './es-c1-writing.json';
import enB1Reading from './en-b1-reading.json';
import enB1Writing from './en-b1-writing.json';
import enB1Listening from './en-b1-listening.json';
import enB2Readinguse from './en-b2-readinguse.json';
import enB2Writing from './en-b2-writing.json';
import enB2Listening from './en-b2-listening.json';
import enC1Readinguse from './en-c1-readinguse.json';
import enC1Writing from './en-c1-writing.json';
import enC1Listening from './en-c1-listening.json';
import esA1Speaking from './es-a1-speaking.json';
import esA2Speaking from './es-a2-speaking.json';
import esB1Speaking from './es-b1-speaking.json';
import esB2Speaking from './es-b2-speaking.json';
import esC1Speaking from './es-c1-speaking.json';
import enA1Speaking from './en-a1-speaking.json';
import enA2Speaking from './en-a2-speaking.json';
import enB1Speaking from './en-b1-speaking.json';
import enB2Speaking from './en-b2-speaking.json';
import enC1Speaking from './en-c1-speaking.json';
import huA1Speaking from './hu-a1-speaking.json';
import huA2Speaking from './hu-a2-speaking.json';
import huB1Reading from './hu-b1-reading.json';
import huB1Listening from './hu-b1-listening.json';
import huB1Writing from './hu-b1-writing.json';
import huB1Speaking from './hu-b1-speaking.json';
import huB2Reading from './hu-b2-reading.json';
import huB2Listening from './hu-b2-listening.json';
import huB2Writing from './hu-b2-writing.json';
import huB2Speaking from './hu-b2-speaking.json';
import huC1Reading from './hu-c1-reading.json';
import huC1Listening from './hu-c1-listening.json';
import huC1Writing from './hu-c1-writing.json';
import huC1Speaking from './hu-c1-speaking.json';

export const MOCK_AUTHORED = [
  esB1Reading,
  esB1Listening,
  esB1Writing,
  esB2Reading,
  esB2Listening,
  esB2Writing,
  esC1Reading,
  esC1Listening,
  esC1Writing,
  enB1Reading,
  enB1Writing,
  enB1Listening,
  enB2Readinguse,
  enB2Writing,
  enB2Listening,
  enC1Readinguse,
  enC1Writing,
  enC1Listening,
  esA1Speaking,
  esA2Speaking,
  esB1Speaking,
  esB2Speaking,
  esC1Speaking,
  enA1Speaking,
  enA2Speaking,
  enB1Speaking,
  enB2Speaking,
  enC1Speaking,
  huA1Speaking,
  huA2Speaking,
  huB1Reading,
  huB1Listening,
  huB1Writing,
  huB1Speaking,
  huB2Reading,
  huB2Listening,
  huB2Writing,
  huB2Speaking,
  huC1Reading,
  huC1Listening,
  huC1Writing,
  huC1Speaking,
] as unknown as AuthoredPaperFile[];
