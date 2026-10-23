// The authored B1-C1 practice-exam papers: the content lives in the JSON files (one per direction, level and paper),
// this module only wires them up (lib/exam/mock/authored.ts picks a form). An empty `forms` list = not written yet.

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
] as unknown as AuthoredPaperFile[];
