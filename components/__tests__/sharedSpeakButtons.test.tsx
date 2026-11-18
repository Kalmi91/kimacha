// E167: every read-aloud control (dictation game, the grammar dictation item, the mock exam player and the sentence
// card's listening step) is the shared SpeakButton (its tap flash layer proves it), and no screen draws a speaker
// glyph of its own outside SpeakButton.
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react-native';

import MockPlayer from '../exam/mock/MockPlayer';
import { DictationDrillItem } from '../grammar/NewKinds';
import TypedSentenceCard from '../TypedSentenceCard';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakAuto: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
  stop: jest.fn(),
  preferredGenderFor: jest.fn(),
}));

describe('shared speak button everywhere', () => {
  it('grammar dictation: play and slow are both the shared button', () => {
    render(<DictationDrillItem item={{ id: 'x', kind: 'dictation', es: 'Yo como.', tr: { en: 'I eat.' } } as never} learnedLang="es" contentLang="en" strictAccents={false} onDone={() => {}} />);
    expect(screen.getByTestId('dictation-play-flash')).toBeTruthy();
    expect(screen.getByTestId('dictation-slow-flash')).toBeTruthy();
  });

  it('mock exam player: the play button is the shared button', () => {
    const audio = { playsLeft: () => 2, playingId: null, play: jest.fn(), failed: false } as never;
    render(<MockPlayer audio={audio} id="a" lines={[]} canSpeak />);
    expect(screen.getByTestId('mock-play-flash')).toBeTruthy();
  });

  it('sentence card listening step: the play button is the shared button', () => {
    render(
      <TypedSentenceCard
        sourceSentence="I eat."
        targetSentence="Yo como."
        lang="es"
        listening
        speechLocale="es-MX"
        onResult={() => {}}
      />
    );
    expect(screen.getByTestId('sentence-listen-play-flash')).toBeTruthy();
  });

  it('no component or screen draws a speaker glyph of its own (only SpeakButton does)', () => {
    const roots = [path.resolve(__dirname, '..'), path.resolve(__dirname, '..', '..', 'app')];
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p);
        } else if (/\.tsx$/.test(e.name) && e.name !== 'SpeakButton.tsx') {
          const code = fs
            .readFileSync(p, 'utf8')
            .split('\n')
            .filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l) && !/\bicon=\{/.test(l));
          if (code.some((l) => /[🔊🔉⏹]/u.test(l))) bad.push(e.name);
        }
      }
    };
    roots.forEach(walk);
    expect(bad).toEqual([]);
  });
});
