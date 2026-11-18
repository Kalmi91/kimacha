// The grammar lesson page's example sentences carry the shared SpeakButton (tap flash, the chosen voice), like the Learn
// card, and no grammar screen draws its own 🔊 text next to a sentence.
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react-native';

import LessonBody from '../grammar/LessonBody';
import lessonJson from '@/data/games/grammar/es/pronombres-od.json';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

describe('lesson page speaker buttons', () => {
  it('every example sentence of the lesson has the shared button (its tap flash layer proves it)', () => {
    const lesson = lessonJson as unknown as LessonV2;
    render(<LessonBody blocks={lesson.body} contentLang="en" learnedLang="es" />);
    const buttons = screen.getAllByTestId('lessonbody-speak');
    expect(buttons.length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('lessonbody-speak-flash')).toHaveLength(buttons.length);
  });

  it('no grammar component draws a bare 🔊 text of its own (only SpeakButton does)', () => {
    const root = path.resolve(__dirname, '..', 'grammar');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== '__tests__') walk(p);
        } else if (p.endsWith('.tsx')) files.push(p);
      }
    };
    walk(root);
    const bare = files.filter((f) => />\s*🔊\s*</.test(fs.readFileSync(f, 'utf8')));
    expect(bare.map((f) => path.basename(f))).toEqual([]);
  });
});
