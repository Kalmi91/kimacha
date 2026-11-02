// The contract the word pack (scripts/tts-pack.py) and the sentence engines share: the key, the FNV-1a hash,
// which voice of the pair speaks, and the pack lookup. The expected hashes were computed with an independent
// implementation (Node Buffer over the UTF-8 bytes); "", "a" and "foobar" are the published FNV-1a vectors.

import {
  KOKORO_VOICES,
  NEURAL_MODELS,
  PACK_KEY,
  PIPER_MODEL_KEYS,
  PIPER_VOICES,
  fnv1a,
  formatMegabytes,
  missingBytes,
  modelKeysFor,
  normalizeEngines,
  packFileFor,
  packHash,
  packKey,
  requiredItems,
  voiceFor,
  voiceIndexFor,
  type PackIndex,
} from '../neuralVoices';

describe('pack key and hash', () => {
  it('FNV-1a 32 bit: the published vectors', () => {
    expect(fnv1a('').toString(16)).toBe('811c9dc5');
    expect(fnv1a('a').toString(16)).toBe('e40c292c');
    expect(fnv1a('foobar').toString(16)).toBe('bf9cf968');
  });

  it('hashes the UTF-8 bytes: accents, a double acute and a surrogate pair', () => {
    expect(packHash('Mañana')).toBe('285b7793');
    expect(packHash('ő')).toBe('628f4943');
    expect(packHash('😀')).toBe('33a29608');
  });

  it('the key is trimmed and NFC, case and article stay', () => {
    expect(packKey('  el perro \n')).toBe('el perro');
    expect(packKey('é')).toBe('é');
    expect(packHash('é')).toBe(packHash('é'));
    expect(packHash('el perro')).toBe('27956ac4');
    expect(packHash('El perro')).not.toBe(packHash('el perro'));
  });

  it('the hash is 8 lowercase hex digits', () => {
    expect(packHash('')).toBe('811c9dc5');
    expect(packHash('x')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('voice choice', () => {
  it('an even hash is voice 0, an odd one voice 1, for both engines', () => {
    // "el perro" 27956ac4 is even, "Mañana" 285b7793 is odd
    expect(voiceIndexFor('es', 'kokoro', 'el perro')).toBe(0);
    expect(voiceIndexFor('es', 'kokoro', 'Mañana')).toBe(1);
    expect(voiceFor('es', 'kokoro', 'el perro').id).toBe('ef_dora');
    expect(voiceFor('es', 'kokoro', 'Mañana').id).toBe('em_alex');
    expect(voiceFor('en', 'kokoro', 'the dog').id).toBe('af_heart');
    expect(voiceFor('hu', 'piper', 'a kutya').id).toBe('hu_HU-berta-medium');
    expect(voiceFor('hu', 'piper', 'ő').id).toBe('hu_HU-imre-medium');
  });

  it('whitespace around the text does not change the voice', () => {
    expect(voiceFor('en', 'piper', '  the dog ').id).toBe(voiceFor('en', 'piper', 'the dog').id);
  });

  it('the Kokoro voices are the pack contract: dora 28, alex 29, heart 3, michael 16', () => {
    expect(KOKORO_VOICES.es.map(v => [v.id, v.sid])).toEqual([['ef_dora', 28], ['em_alex', 29]]);
    expect(KOKORO_VOICES.en.map(v => [v.id, v.sid])).toEqual([['af_heart', 3], ['am_michael', 16]]);
  });

  it('m / f pick the voice of that sex in every pair, n and nothing keep the hash', () => {
    for (const lang of ['es', 'en', 'hu'] as const) {
      expect(voiceFor(lang, 'piper', 'x', 'f').gender).toBe('f');
      expect(voiceFor(lang, 'piper', 'x', 'm').gender).toBe('m');
    }
    expect(voiceFor('es', 'kokoro', 'x', 'f').id).toBe('ef_dora');
    expect(voiceFor('en', 'kokoro', 'x', 'm').id).toBe('am_michael');
    expect(voiceFor('es', 'kokoro', 'el perro', 'n').id).toBe('ef_dora');
    expect(voiceFor('es', 'kokoro', 'Mañana', undefined).id).toBe('em_alex');
  });

  it('every pair has one female and one male voice', () => {
    for (const pair of [...Object.values(PIPER_VOICES), ...Object.values(KOKORO_VOICES)]) {
      expect(pair.map(v => v.gender).sort()).toEqual(['f', 'm']);
    }
  });

  it('Hungarian has no Kokoro voice: the choice is always Piper', () => {
    expect(normalizeEngines({ es: 'kokoro', en: 'kokoro', hu: 'kokoro' })).toEqual({ es: 'kokoro', en: 'kokoro', hu: 'piper' });
    expect(normalizeEngines(null)).toEqual({ es: 'piper', en: 'piper', hu: 'piper' });
    expect(voiceFor('hu', 'kokoro', 'a kutya').engine).toBe('piper');
  });
});

describe('models', () => {
  it('every voice points at a known model, the archives follow the release naming', () => {
    for (const voice of [...Object.values(PIPER_VOICES).flat(), ...Object.values(KOKORO_VOICES).flat()]) {
      expect(NEURAL_MODELS[voice.model]).toBeDefined();
    }
    expect(PIPER_MODEL_KEYS).toHaveLength(6);
    expect(NEURAL_MODELS['hu_HU-berta-medium'].archive).toBe(
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-hu_HU-berta-medium-int8.tar.bz2',
    );
    expect(NEURAL_MODELS.kokoro.dir).toBe('kokoro-int8-multi-lang-v1_0');
  });

  it('the Kokoro model serves both of its languages, Piper needs two models per language', () => {
    expect(modelKeysFor('es', 'kokoro')).toEqual(['kokoro']);
    expect(modelKeysFor('es', 'piper')).toEqual(['es_MX-claude-high', 'es_MX-ald-medium']);
  });

  it('the first download is the pack and the six Piper models, Kokoro only when a language chose it', () => {
    expect(requiredItems({ es: 'piper', en: 'piper', hu: 'piper' })).toEqual([PACK_KEY, ...PIPER_MODEL_KEYS]);
    expect(requiredItems({ es: 'kokoro', en: 'piper', hu: 'piper' })).toContain('kokoro');
  });

  it('counts the bytes of what is not installed yet', () => {
    const items = requiredItems({ es: 'piper', en: 'piper', hu: 'piper' });
    const all = missingBytes(items, {});
    expect(all).toBe(PIPER_MODEL_KEYS.reduce((sum, key) => sum + NEURAL_MODELS[key].bytes, 0));
    expect(missingBytes(items, { 'hu_HU-berta-medium': true })).toBe(all - NEURAL_MODELS['hu_HU-berta-medium'].bytes);
    expect(formatMegabytes(NEURAL_MODELS.kokoro.bytes)).toBe('126 MB');
  });
});

describe('pack lookup', () => {
  const index: PackIndex = { version: 1, engine: 'kokoro-v1.0', files: { es: { 'el perro': 'es/27956ac4.mp3' }, en: { 'the dog': 'en/ba7d9c5e.mp3' } } };

  it('finds a card word by its key, in its own language', () => {
    expect(packFileFor(index, 'es', ' el perro ')).toBe('es/27956ac4.mp3');
    expect(packFileFor(index, 'en', 'the dog')).toBe('en/ba7d9c5e.mp3');
    expect(packFileFor(index, 'en', 'el perro')).toBeNull();
  });

  it('a sentence, Hungarian and a missing pack are not in the pack', () => {
    expect(packFileFor(index, 'es', 'El perro duerme en el sofá.')).toBeNull();
    expect(packFileFor(index, 'hu', 'a kutya')).toBeNull();
    expect(packFileFor(null, 'es', 'el perro')).toBeNull();
  });
});
