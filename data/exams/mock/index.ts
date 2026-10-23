// The authored practice-exam papers (B1-C1, and the speaking paper of every level): the content lives in the JSON files (one
// per direction, level and paper), this module only wires them up (lib/exam/mock/authored.ts picks a form). An empty `forms`
// list = not written yet.

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
] as unknown as AuthoredPaperFile[];
