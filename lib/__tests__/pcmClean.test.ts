import { cleanPcm } from '../pcmClean';

const SR = 22050;
const dbToLin = (db: number) => Math.pow(10, db / 20);
const rmsDb = (s: Float32Array, from = 0, to = s.length) => {
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += s[i] * s[i];
  return 20 * Math.log10(Math.sqrt(sum / (to - from)));
};
const at = (sec: number) => Math.round(sec * SR);

// deterministic white noise (uniform, scaled to the wanted RMS)
function noise(n: number, rmsDbfs: number): Float32Array {
  let seed = 12345;
  const out = new Float32Array(n);
  const amp = dbToLin(rmsDbfs) * Math.sqrt(3);
  for (let i = 0; i < n; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = (seed / 0xffffffff * 2 - 1) * amp;
  }
  return out;
}

function sine(n: number, peakDbfs: number, hz = 200): Float32Array {
  const out = new Float32Array(n);
  const amp = dbToLin(peakDbfs);
  for (let i = 0; i < n; i += 1) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  return out;
}

// burst 0.3 s, hiss 0.4 s, burst 0.3 s
function signal(): Float32Array {
  const parts = [sine(at(0.3), -10), noise(at(0.4), -52), sine(at(0.3), -10)];
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

describe('cleanPcm (FB544/545)', () => {
  const input = signal();
  const out = cleanPcm(input, SR);
  const b1End = at(0.3);
  const b2Start = at(0.7);

  it('mutes the hiss in the middle of a pause, far from the speech', () => {
    expect(rmsDb(out, b1End + at(0.08), b2Start - at(0.08))).toBeLessThan(-90);
  });

  it('leaves the bursts within half a dB', () => {
    expect(Math.abs(rmsDb(out, 0, b1End) - rmsDb(input, 0, b1End))).toBeLessThan(0.5);
    expect(Math.abs(rmsDb(out, b2Start, out.length) - rmsDb(input, b2Start, out.length))).toBeLessThan(0.5);
  });

  it('keeps the hiss within 40 ms of the speech (no gate there)', () => {
    expect(rmsDb(out, b1End + at(0.001), b1End + at(0.03))).toBeGreaterThan(-60);
  });

  it('has no sample-to-sample jump above 0.05 at the gate edges', () => {
    let max = 0;
    for (let i = b1End; i < b2Start + 1; i += 1) max = Math.max(max, Math.abs(out[i] - out[i - 1]));
    expect(max).toBeLessThan(0.05);
  });

  it('starts and ends on zero, and does not touch its input', () => {
    expect(Math.abs(out[0])).toBe(0);
    expect(Math.abs(out[out.length - 1])).toBe(0);
    expect(input[out.length - 1]).not.toBe(0);
    expect(out.length).toBe(input.length);
  });

  it('a chunk that is quiet all through is not muted (it is not a pause)', () => {
    const quiet = noise(at(0.5), -52);
    expect(rmsDb(cleanPcm(quiet, SR), at(0.05), at(0.4))).toBeGreaterThan(-60);
  });

  it('copes with an empty chunk and one shorter than a window', () => {
    expect(cleanPcm(new Float32Array(0), SR).length).toBe(0);
    expect(cleanPcm(sine(50, -10), SR).length).toBe(50);
  });
});
