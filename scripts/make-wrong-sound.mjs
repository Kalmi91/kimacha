// Writes assets/sounds/wrong.wav: the "wrong answer" sound of the grammar Big test (app/grammar/big-test.tsx,
// played by lib/chime.ts playWrongSound), the pair of the right-answer chime (scripts/make-chime.mjs). An original
// sound: two short low sine tones going down (330 Hz, then 247 Hz), a soft 5 ms attack and an exponential decay,
// -9 dBFS peak (softer than the chime), 44.1 kHz mono 16-bit.
// Usage: node scripts/make-wrong-sound.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'sounds', 'wrong.wav');

const SAMPLE_RATE = 44100;
const PEAK = Math.pow(10, -9 / 20);
const ATTACK_S = 0.005;
const END_FADE_S = 0.003; // the decay stops near zero, this last bit takes it to zero exactly
const TONES = [
  { hz: 330, seconds: 0.11 },
  { hz: 247, seconds: 0.2 },
];

const samples = [];
for (const { hz, seconds } of TONES) {
  const n = Math.round(seconds * SAMPLE_RATE);
  const tau = seconds / 3; // a slower decay than the chime: the low tone stays audible on a phone speaker
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / ATTACK_S);
    const fade = Math.min(1, (seconds - t) / END_FADE_S);
    samples.push(Math.sin(2 * Math.PI * hz * t) * attack * Math.exp(-t / tau) * fade);
  }
}
const top = Math.max(...samples.map(Math.abs));

const data = Buffer.alloc(samples.length * 2);
samples.forEach((v, i) => data.writeInt16LE(Math.round((v / top) * PEAK * 32767), i * 2));

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // PCM
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([header, data]));
console.log(`wrote ${path.relative(ROOT, OUT)}: ${(samples.length / SAMPLE_RATE * 1000).toFixed(0)} ms, ${header.length + data.length} bytes`);
