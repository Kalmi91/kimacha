import { useEffect, useRef, useState } from 'react';

import { audioSegments } from '@/lib/exam/mock/audio';
import { DEFAULT_PLAYS, type MockAudioLine, type MockTarget } from '@/lib/exam/mock/types';
import { speechLang } from '@/lib/languages';
import { speakSequence, stop as stopSpeaking } from '@/lib/speech';

// The play logic of the authored recorded tasks, the same as the older kinds in MockTaskCard: every recording has
// `plays` listens (default 2), the button is mute while a recording plays (a double tap must not use up two listens),
// and the speech stops when the task goes away. A task with several recordings (clips, prompts) counts the plays per recording.

export interface MockAudio {
  playsLeft: (id: string) => number;
  play: (id: string, lines: MockAudioLine[]) => void;
}

export function useMockAudio(target: MockTarget, maxPlays: number = DEFAULT_PLAYS): MockAudio {
  const [plays, setPlays] = useState<Record<string, number>>({});
  // The recording that is playing right now (a token, so a cut-off recording cannot release the next one's lock).
  const playing = useRef<object | null>(null);

  // The screen rebuilds the card with key={task.id}: a new task starts with zero plays, and a recording that is still playing stops.
  useEffect(() => {
    return () => {
      playing.current = null;
      stopSpeaking();
    };
  }, []);

  const playsLeft = (id: string) => Math.max(0, maxPlays - (plays[id] ?? 0));

  const play = (id: string, lines: MockAudioLine[]) => {
    if (playing.current || playsLeft(id) <= 0 || lines.length === 0) return;
    const token = {};
    playing.current = token;
    setPlays((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
    const release = () => {
      if (playing.current === token) playing.current = null;
    };
    speakSequence(audioSegments(lines, speechLang(target)), release, release);
  };

  return { playsLeft, play };
}
