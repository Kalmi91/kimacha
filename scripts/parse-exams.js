const fs = require('fs');
const path = require('path');

const input = fs.readFileSync('/home/kalmi/Desktop/LanguageAPP_exam_questions.md', 'utf-8');
const lines = input.split('\n');

const levelMap = {
  'A0-A1': 'A0',
  'A2': 'A2',
  'B1': 'B1',
  'B2': 'B2',
  'C1-C2': 'C1',
};

let currentLevel = '';
let currentType = '';
let questions = [];
let id = 1;

let i = 0;
while (i < lines.length) {
  const line = lines[i].trim();

  // Level detection
  const levelMatch = line.match(/^## (A0-A1|A2|B1|B2|C1-C2)/);
  if (levelMatch) {
    currentLevel = levelMap[levelMatch[1]];
    i++;
    continue;
  }

  // Type detection
  if (line === '### GAP FILL') { currentType = 'gap'; i++; continue; }
  if (line.startsWith('### TRANSLATE (ES→HU)')) { currentType = 'translate_es_hu'; i++; continue; }
  if (line.startsWith('### TRANSLATE (HU→ES)')) { currentType = 'translate_hu_es'; i++; continue; }

  if (currentType === 'gap') {
    const qMatch = line.match(/^\d+\.\s+(.+)/);
    if (qMatch) {
      const sentence = qMatch[1];
      const optionsLine = lines[i + 1]?.trim() || '';
      const answerLine = lines[i + 2]?.trim() || '';

      const optMatch = optionsLine.match(/A\)\s*(.+?)\s+B\)\s*(.+?)\s+C\)\s*(.+?)\s+D\)\s*(.+)/);
      const correctMatch = answerLine.match(/→\s*([A-D])/);

      if (optMatch && correctMatch) {
        const options = [optMatch[1].trim(), optMatch[2].trim(), optMatch[3].trim(), optMatch[4].trim()];
        const correctIdx = correctMatch[1].charCodeAt(0) - 65;
        questions.push({
          id: id++,
          level: currentLevel,
          type: 'gap',
          sentence,
          options,
          correctIndex: correctIdx,
        });
      }
      i += 3;
      continue;
    }
  }

  if (currentType === 'translate_es_hu' || currentType === 'translate_hu_es') {
    const tMatch = line.match(/^\d+\.\s+(.+?)\s*→\s*(.+)/);
    if (tMatch) {
      const dir = currentType === 'translate_es_hu' ? 'es_hu' : 'hu_es';
      questions.push({
        id: id++,
        level: currentLevel,
        type: 'translate',
        direction: dir,
        source: tMatch[1].trim(),
        target: tMatch[2].trim(),
      });
      i++;
      continue;
    }
  }

  i++;
}

// Generate TypeScript
let output = `export type ExamType = 'gap' | 'translate';

export interface GapQuestion {
  id: number;
  level: string;
  type: 'gap';
  sentence: string;
  options: string[];
  correctIndex: number;
}

export interface TranslateQuestion {
  id: number;
  level: string;
  type: 'translate';
  direction: 'es_hu' | 'hu_es';
  source: string;
  target: string;
}

export type ExamQuestion = GapQuestion | TranslateQuestion;

export const examQuestions: ExamQuestion[] = [\n`;

for (const q of questions) {
  if (q.type === 'gap') {
    output += `  { id: ${q.id}, level: '${q.level}', type: 'gap', sentence: '${q.sentence.replace(/'/g, "\\'")}', options: [${q.options.map(o => `'${o.replace(/'/g, "\\'")}'`).join(', ')}], correctIndex: ${q.correctIndex} },\n`;
  } else {
    output += `  { id: ${q.id}, level: '${q.level}', type: 'translate', direction: '${q.direction}', source: '${q.source.replace(/'/g, "\\'")}', target: '${q.target.replace(/'/g, "\\'")}' },\n`;
  }
}

output += `];\n\nexport function getExamQuestionsForLevel(level: string): ExamQuestion[] {\n  return examQuestions.filter(q => q.level === level);\n}\n`;

fs.writeFileSync(path.join(__dirname, '..', 'data', 'exams.ts'), output);
console.log(`Parsed ${questions.length} exam questions.`);
console.log(`GAP: ${questions.filter(q => q.type === 'gap').length}`);
console.log(`TRANSLATE: ${questions.filter(q => q.type === 'translate').length}`);
