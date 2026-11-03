// The downloads and the state of the better voice (lib/neuralModels.ts) with an in-memory file system, a
// scripted downloader and a stub extractor: what installs, what a failed item leaves behind, what the
// switch and the engine choice do. The word pack's URL may not exist yet, so a 404 on it must not stop the
// models.

import { NEURAL_MODELS, PACK_KEY, PIPER_MODEL_KEYS, SENTENCES_KEY, voiceFor } from '../neuralVoices';

const FILES = '/data/files';
const TTS = `${FILES}/tts`;
const mockFs = new Map<string, string>();
const mockDownloads: { url: string; status: number }[] = [];
const mockStatusFor: Record<string, number> = {};
const mockExtracted: { id: string; target: string }[] = [];
const mockFailExtract = new Set<string>();
const mockPauseExtract = new Set<string>();
const mockFailLoad = new Set<string>();
const mockLoaded: string[] = [];
const mockReady = new Set<string>();
const mockPairReleased: string[] = [];
let mockReleased = 0;

// the sentence pack's index: the same sentence by the two speakers
const SENTENCE = 'El perro duerme en el sofá.';
const SENTENCE_INDEX = { version: 1, engine: 'kokoro-v1.0', files: { es: { 'f|El perro duerme en el sofá.': 'es/f/aaaaaaaa.mp3', 'm|El perro duerme en el sofá.': 'es/m/bbbbbbbb.mp3' } } };
const HASH_GENDER = voiceFor('es', 'kokoro', SENTENCE).gender;

const under = (path: string) => [...mockFs.keys()].filter(key => key === path || key.startsWith(`${path}/`));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/data/files',
  exists: async (path: string) => under(path).length > 0,
  mkdir: async (path: string) => {
    mockFs.set(`${path}/.dir`, '');
  },
  readFile: async (path: string) => {
    if (!mockFs.has(path)) throw new Error(`ENOENT ${path}`);
    return mockFs.get(path);
  },
  writeFile: async (path: string, data: string) => {
    mockFs.set(path, data);
  },
  unlink: async (path: string) => {
    for (const key of under(path)) mockFs.delete(key);
  },
  downloadFile: (options: any) => {
    const status = mockStatusFor[options.fromUrl] ?? 200;
    mockDownloads.push({ url: options.fromUrl, status });
    options.begin?.({ statusCode: status, contentLength: 5000 });
    options.progress?.({ bytesWritten: 2500, contentLength: 5000 });
    mockFs.set(options.toFile, 'archive');
    return { jobId: 1, promise: Promise.resolve({ jobId: 1, statusCode: status, bytesWritten: 5000 }) };
  },
}), { virtual: true });

jest.mock('react-native-sherpa-onnx/extraction', () => ({
  extractArchive: async (archive: { modelId: string }, target: string) => {
    mockExtracted.push({ id: archive.modelId, target });
    if (mockFailExtract.has(archive.modelId)) throw new Error('extract failed');
    if (mockPauseExtract.has(archive.modelId)) {
      mockFs.set(`${target}/${archive.modelId === 'pack' || archive.modelId === 'sentences' ? 'half' : (require('../neuralVoices').NEURAL_MODELS as typeof NEURAL_MODELS)[archive.modelId].dir}/part`, 'x');
      return { success: false, paused: true, reason: 'paused' };
    }
    if (archive.modelId === 'pack') mockFs.set(`${target}/index.json`, JSON.stringify({ version: 1, engine: 'kokoro-v1.0', files: { es: { 'el perro': 'es/27956ac4.mp3' } } }));
    else if (archive.modelId === 'sentences') mockFs.set(`${target}/index.json`, JSON.stringify(SENTENCE_INDEX));
    else mockFs.set(`${target}/${(require('../neuralVoices').NEURAL_MODELS as typeof NEURAL_MODELS)[archive.modelId].dir}/tokens.txt`, 't');
    return { success: true };
  },
}), { virtual: true });

jest.mock('../neuralTts', () => ({
  loadNeuralVoice: async (voice: { id: string; engine: string; model: string }, lang: string, dir: string) => {
    mockLoaded.push(`${lang}:${voice.id}@${dir}`);
    if (mockFailLoad.has(voice.id)) throw new Error('bad model');
    mockReady.add(`${lang}:${voice.engine}:${voice.id}`);
    return 1;
  },
  isNeuralReady: (lang: string, engine: string) => {
    const { voicePair } = require('../neuralVoices');
    return voicePair(lang, engine).every((v: { id: string }) => mockReady.has(`${lang}:${engine}:${v.id}`));
  },
  releaseNeural: async () => {
    mockReleased += 1;
    mockReady.clear();
  },
  releaseNeuralPair: async (lang: string, engine: string) => {
    mockPairReleased.push(`${lang}:${engine}`);
    for (const key of [...mockReady]) if (key.startsWith(`${lang}:${engine}:`)) mockReady.delete(key);
  },
  stopNeural: jest.fn(),
}));
jest.mock('../packAudio', () => ({ stopPack: jest.fn() }));

type Models = typeof import('../neuralModels');
const load = (): Models => {
  let mod!: Models;
  jest.isolateModules(() => {
    // the isolated registry has its own react-native: the platform is set on that one
    jest.replaceProperty(require('react-native').Platform, 'OS', 'android');
    mod = require('../neuralModels');
  });
  return mod;
};
const flush = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise(resolve => setTimeout(resolve, 0));
};
const installSentences = () => {
  mockFs.set(`${TTS}/kimacha-tts-sentences-v1/index.json`, JSON.stringify(SENTENCE_INDEX));
  mockFs.set(`${TTS}/kimacha-tts-sentences-v1.ok`, '1');
};
const installModel = (key: string) => {
  mockFs.set(`${TTS}/${NEURAL_MODELS[key].dir}/tokens.txt`, 't');
  mockFs.set(`${TTS}/${NEURAL_MODELS[key].dir}.ok`, '1');
};

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {}); // the layer logs its installs and failures
});

beforeEach(() => {
  mockFs.clear();
  mockDownloads.length = 0;
  mockExtracted.length = 0;
  mockFailExtract.clear();
  mockPauseExtract.clear();
  mockFailLoad.clear();
  mockPairReleased.length = 0;
  mockLoaded.length = 0;
  mockReady.clear();
  mockReleased = 0;
  for (const key of Object.keys(mockStatusFor)) delete mockStatusFor[key];
});

describe('better voice: state at start', () => {
  it('nothing downloaded: not usable, switch on by default, Piper everywhere', async () => {
    const m = load();
    await m.startNeural();
    const s = m.getNeuralState();
    expect(s.supported).toBe(true);
    expect(s.ready).toBe(true);
    expect(s.enabled).toBe(true);
    expect(s.engines).toEqual({ es: 'piper', en: 'piper', hu: 'piper', de: 'piper' });
    expect(Object.values(s.installed).every(v => !v)).toBe(true);
    expect(m.neuralEngineFor('es')).toBeNull();
    expect(m.neuralPackFile('es', 'el perro')).toBeNull();
  });

  it('a model without its marker (a download or extraction that was cut off) is not installed', async () => {
    mockFs.set(`${TTS}/${NEURAL_MODELS['hu_HU-berta-medium'].dir}/tokens.txt`, 't');
    const m = load();
    await m.startNeural();
    expect(m.getNeuralState().installed['hu_HU-berta-medium']).toBe(false);
  });

  it('installed models load lazily: nothing at start, a language at its first use', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    const m = load();
    await m.startNeural();
    await flush();
    expect(mockLoaded).toEqual([]);
    expect(m.neuralEngineFor('es')).toBeNull(); // asking starts its load
    await flush();
    expect(mockLoaded.map(x => x.split('@')[0]).sort()).toEqual(['es:es_MX-ald-medium', 'es:es_MX-claude-high']);
    expect(m.neuralEngineFor('es')).toBe('piper');
    expect(m.neuralEngineFor('hu')).toBeNull();
    await flush();
    expect(m.neuralEngineFor('hu')).toBe('piper');
    expect(mockLoaded.some(x => x.startsWith('en:'))).toBe(false); // English was never asked for
  });

  it('German loads Kerstin and Thorsten (Piper) on first use and is Piper only', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    const m = load();
    await m.startNeural();
    await flush();
    expect(m.neuralEngineFor('de')).toBeNull(); // asking starts its load
    await flush();
    expect(mockLoaded.map(x => x.split('@')[0]).sort()).toEqual(['de:de_DE-kerstin-low', 'de:de_DE-thorsten-medium']);
    expect(m.neuralEngineFor('de')).toBe('piper');
    expect(m.neuralPackFile('de', 'der Hund')).toBeNull();
    await m.setNeuralEngine('de', 'kokoro');
    expect(m.getNeuralState().engines.de).toBe('piper');
  });

  it('German stays on the phone while its voices are not installed', async () => {
    const m = load();
    await m.startNeural();
    await flush();
    expect(m.neuralEngineFor('de')).toBeNull();
    await flush();
    expect(mockLoaded.some(x => x.startsWith('de:'))).toBe(false);
  });

  it('a model that fails to load is not tried again on every speech', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    mockFailLoad.add('es_MX-claude-high');
    const m = load();
    await m.startNeural();
    for (let i = 0; i < 4; i += 1) {
      expect(m.neuralEngineFor('es')).toBeNull();
      await flush();
    }
    expect(mockLoaded).toHaveLength(1); // one attempt, the first voice of the pair
  });

  it('a download that ran lets the failed language try again at its next use', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    mockFailLoad.add('es_MX-claude-high');
    const m = load();
    await m.startNeural();
    m.neuralEngineFor('es');
    await flush();
    mockFailLoad.clear();
    mockFs.delete(`${TTS}/kimacha-tts-pack-v1.ok`);
    await m.downloadNeural(); // the pack is missing, so something is fetched
    m.neuralEngineFor('es');
    await flush();
    expect(m.neuralEngineFor('es')).toBe('piper');
  });

  it('the saved switch and choices come back after a restart', async () => {
    mockFs.set(`${TTS}/settings.json`, JSON.stringify({ enabled: false, engines: { es: 'kokoro', en: 'piper', hu: 'kokoro', de: 'kokoro' } }));
    const m = load();
    await m.startNeural();
    expect(m.getNeuralState().enabled).toBe(false);
    expect(m.getNeuralState().engines).toEqual({ es: 'kokoro', en: 'piper', hu: 'piper', de: 'piper' });
  });
});

// Settings -> Voice: the chosen person per language is kept in settings.json next to the switch and the engines.
describe('better voice: the chosen speaker', () => {
  type Prefs = typeof import('../voicePreference');
  const loadBoth = (): { m: Models; prefs: Prefs } => {
    let both!: { m: Models; prefs: Prefs };
    jest.isolateModules(() => {
      jest.replaceProperty(require('react-native').Platform, 'OS', 'android');
      both = { m: require('../neuralModels'), prefs: require('../voicePreference') };
    });
    return both;
  };
  const saved = () => JSON.parse(mockFs.get(`${TTS}/settings.json`) as string);

  it('starts on Automatic everywhere, also from a settings file written before the choice existed', async () => {
    mockFs.set(`${TTS}/settings.json`, JSON.stringify({ enabled: true, engines: { es: 'piper', en: 'piper', hu: 'piper' } }));
    const { m, prefs } = loadBoth();
    await m.startNeural();
    expect(prefs.getSpeakerChoices()).toEqual({ es: 'auto', en: 'auto', hu: 'auto' });
    expect(prefs.preferredGender('es')).toBeUndefined();
  });

  it('a choice is saved with the switch and the engines, and comes back after a restart', async () => {
    const first = loadBoth();
    await first.m.startNeural();
    first.m.setNeuralSpeaker('es', 'm');
    first.m.setNeuralSpeaker('hu', 'f');
    await flush();
    expect(first.prefs.preferredGender('es')).toBe('m');
    expect(saved()).toEqual({ enabled: true, engines: { es: 'piper', en: 'piper', hu: 'piper' }, speakers: { es: 'm', en: 'auto', hu: 'f' } });

    const second = loadBoth(); // the app restarted: a fresh module registry reads the file
    expect(second.prefs.preferredGender('es')).toBeUndefined();
    await second.m.startNeural();
    expect(second.prefs.getSpeakerChoices()).toEqual({ es: 'm', en: 'auto', hu: 'f' });
    expect(second.prefs.preferredGender('hu')).toBe('f');
  });

  it('Automatic again is saved, an unchanged choice writes nothing, and the other settings are kept', async () => {
    mockFs.set(`${TTS}/settings.json`, JSON.stringify({ enabled: false, engines: { es: 'kokoro', en: 'piper', hu: 'piper' }, speakers: { es: 'm', en: 'f', hu: 'auto' } }));
    const { m, prefs } = loadBoth();
    await m.startNeural();
    m.setNeuralSpeaker('es', 'auto');
    await flush();
    expect(saved()).toEqual({ enabled: false, engines: { es: 'kokoro', en: 'piper', hu: 'piper' }, speakers: { es: 'auto', en: 'f', hu: 'auto' } });
    mockFs.set(`${TTS}/settings.json`, 'untouched');
    m.setNeuralSpeaker('es', 'auto');
    await flush();
    expect(mockFs.get(`${TTS}/settings.json`)).toBe('untouched');
    expect(prefs.preferredGender('en')).toBe('f');
  });

  it('a damaged value in the file is Automatic, not a crash', async () => {
    mockFs.set(`${TTS}/settings.json`, JSON.stringify({ enabled: true, engines: {}, speakers: { es: 'x', en: 3, hu: 'm' } }));
    const { m, prefs } = loadBoth();
    await m.startNeural();
    expect(prefs.getSpeakerChoices()).toEqual({ es: 'auto', en: 'auto', hu: 'm' });
  });
});

describe('better voice: download', () => {
  it('fetches the word pack first, then the six Piper models and the sentence pack last, extracts each into the right folder and marks it installed', async () => {
    const m = load();
    await m.startNeural();
    await m.downloadNeural();
    expect(mockDownloads.map(d => d.url)[0]).toContain('kimacha-tts-pack-v1.tar.bz2');
    expect(mockDownloads).toHaveLength(2 + PIPER_MODEL_KEYS.length);
    expect(mockDownloads[mockDownloads.length - 1].url).toContain('kimacha-tts-sentences-v1.tar.bz2');
    expect(mockDownloads.some(d => d.url.includes('kokoro'))).toBe(false);
    expect(mockExtracted.find(e => e.id === PACK_KEY)?.target).toBe(`${TTS}/kimacha-tts-pack-v1`);
    expect(mockExtracted.find(e => e.id === SENTENCES_KEY)?.target).toBe(`${TTS}/kimacha-tts-sentences-v1`);
    expect(mockExtracted.find(e => e.id === 'es_MX-claude-high')?.target).toBe(TTS);
    const s = m.getNeuralState();
    expect(s.download).toEqual({ running: false, percent: 100, phase: 'download', failed: [] });
    expect([PACK_KEY, SENTENCES_KEY, ...PIPER_MODEL_KEYS].every(key => s.installed[key])).toBe(true);
    expect([...mockFs.keys()].some(k => k.includes('/dl/') && !k.endsWith('.dir'))).toBe(false); // no archive left behind
    expect(m.neuralPackFile('es', 'el perro')).toBe(`${TTS}/kimacha-tts-pack-v1/es/27956ac4.mp3`);
    expect(m.neuralPackFile('es', 'la casa')).toBeNull();
    expect(m.neuralSentenceFile('es', SENTENCE, 'f')).toBe(`${TTS}/kimacha-tts-sentences-v1/es/f/aaaaaaaa.mp3`);
    expect(m.neuralEngineFor('en')).toBeNull(); // the first ask loads the language
    await flush();
    expect(m.neuralEngineFor('en')).toBe('piper');
  });

  it('the pack answering 404 is a failure of the pack only: the models still install', async () => {
    mockStatusFor['https://github.com/Kalmi91/kimacha/releases/download/tts-pack-v1/kimacha-tts-pack-v1.tar.bz2'] = 404;
    const m = load();
    await m.startNeural();
    await m.downloadNeural();
    const s = m.getNeuralState();
    expect(s.download.failed).toEqual([PACK_KEY]);
    expect(s.download.running).toBe(false);
    expect(s.installed[PACK_KEY]).toBe(false);
    expect(PIPER_MODEL_KEYS.every(key => s.installed[key])).toBe(true);
    expect(m.neuralPackFile('es', 'el perro')).toBeNull();
    expect([...mockFs.keys()].some(k => k.includes('/dl/') && !k.endsWith('.dir'))).toBe(false);
  });

  it('an extraction that fails leaves no marker and no half folder, and the next run fetches only that model', async () => {
    mockFailExtract.add('hu_HU-imre-medium');
    const m = load();
    await m.startNeural();
    await m.downloadNeural();
    expect(m.getNeuralState().download.failed).toEqual(['hu_HU-imre-medium']);
    expect(m.getNeuralState().installed['hu_HU-imre-medium']).toBe(false);
    expect(under(`${TTS}/${NEURAL_MODELS['hu_HU-imre-medium'].dir}`)).toEqual([]);
    mockFailExtract.clear();
    mockDownloads.length = 0;
    await m.downloadNeural();
    expect(mockDownloads).toHaveLength(1);
    expect(mockDownloads[0].url).toContain('hu_HU-imre-medium');
    expect(m.getNeuralState().download.failed).toEqual([]);
  });

  it('an extraction that came back paused (success false, no throw) leaves no marker and no half folder', async () => {
    mockPauseExtract.add('en_US-john-medium');
    const m = load();
    await m.startNeural();
    await m.downloadNeural();
    expect(m.getNeuralState().download.failed).toEqual(['en_US-john-medium']);
    expect(m.getNeuralState().installed['en_US-john-medium']).toBe(false);
    expect(mockFs.has(`${TTS}/${NEURAL_MODELS['en_US-john-medium'].dir}.ok`)).toBe(false);
    expect(under(`${TTS}/${NEURAL_MODELS['en_US-john-medium'].dir}`)).toEqual([]);
    expect(m.getNeuralState().installed['en_US-kristin-medium']).toBe(true); // the others went on
  });

  it('nothing missing means nothing to download', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    mockFs.set(`${TTS}/kimacha-tts-pack-v1.ok`, '1');
    installSentences();
    const m = load();
    await m.startNeural();
    await m.downloadNeural();
    expect(mockDownloads).toHaveLength(0);
  });

  it('the sentence pack answering 404 fails only itself: the word pack, the models and the engines are fine', async () => {
    mockStatusFor['https://github.com/Kalmi91/kimacha/releases/download/tts-sentences-v1/kimacha-tts-sentences-v1.tar.bz2'] = 404;
    const m = load();
    await m.startNeural();
    await m.downloadNeural();
    const s = m.getNeuralState();
    expect(s.download.failed).toEqual([SENTENCES_KEY]);
    expect(s.installed[SENTENCES_KEY]).toBe(false);
    expect([PACK_KEY, ...PIPER_MODEL_KEYS].every(key => s.installed[key])).toBe(true);
    expect(m.neuralSentenceFile('es', SENTENCE, 'f')).toBeNull();
    expect(m.neuralPackFile('es', 'el perro')).toBe(`${TTS}/kimacha-tts-pack-v1/es/27956ac4.mp3`);
    expect(m.neuralEngineFor('es')).toBeNull(); // the first ask loads the language
    await flush();
    expect(m.neuralEngineFor('es')).toBe('piper');
    expect([...mockFs.keys()].some(k => k.includes('/dl/') && !k.endsWith('.dir'))).toBe(false);
  });

  it('a sentence pack whose extraction fails leaves no marker and no folder, and the next run fetches only it', async () => {
    mockFailExtract.add(SENTENCES_KEY);
    const m = load();
    await m.startNeural();
    await m.downloadNeural();
    expect(m.getNeuralState().download.failed).toEqual([SENTENCES_KEY]);
    expect(under(`${TTS}/kimacha-tts-sentences-v1`)).toEqual([]);
    mockFailExtract.clear();
    mockDownloads.length = 0;
    await m.downloadNeural();
    expect(mockDownloads.map(d => d.url)).toEqual([expect.stringContaining('kimacha-tts-sentences-v1')]);
    expect(m.neuralSentenceFile('es', SENTENCE, 'm')).toBe(`${TTS}/kimacha-tts-sentences-v1/es/m/bbbbbbbb.mp3`);
  });

  it('an installed sentence pack is found at the next start: the speaker decides, no gender means the hash gender', async () => {
    installSentences();
    const m = load();
    await m.startNeural();
    expect(m.neuralSentenceFile('es', SENTENCE, 'f')).toBe(`${TTS}/kimacha-tts-sentences-v1/es/f/aaaaaaaa.mp3`);
    expect(m.neuralSentenceFile('es', SENTENCE, 'm')).toBe(`${TTS}/kimacha-tts-sentences-v1/es/m/bbbbbbbb.mp3`);
    expect(m.neuralSentenceFile('es', SENTENCE)).toBe(`${TTS}/kimacha-tts-sentences-v1/es/${HASH_GENDER}/${HASH_GENDER === 'f' ? 'aaaaaaaa' : 'bbbbbbbb'}.mp3`);
    expect(m.neuralSentenceFile('es', 'Otra oración.', 'f')).toBeNull();
    expect(m.neuralSentenceFile('hu', SENTENCE, 'f')).toBeNull();
  });

  it('a sentence pack with an unreadable index is just absent: the word pack still works', async () => {
    mockFs.set(`${TTS}/kimacha-tts-pack-v1/index.json`, JSON.stringify({ version: 1, engine: 'x', files: { es: { 'el perro': 'es/a.mp3' } } }));
    mockFs.set(`${TTS}/kimacha-tts-pack-v1.ok`, '1');
    mockFs.set(`${TTS}/kimacha-tts-sentences-v1/index.json`, '{not json');
    mockFs.set(`${TTS}/kimacha-tts-sentences-v1.ok`, '1');
    const m = load();
    await m.startNeural();
    expect(m.neuralSentenceFile('es', SENTENCE, 'f')).toBeNull();
    expect(m.neuralPackFile('es', 'el perro')).toBe(`${TTS}/kimacha-tts-pack-v1/es/a.mp3`);
  });

  it('the switch off silences the sentence pack too', async () => {
    installSentences();
    const m = load();
    await m.startNeural();
    expect(m.neuralSentenceFile('es', SENTENCE, 'f')).not.toBeNull();
    await m.setNeuralEnabled(false);
    expect(m.neuralSentenceFile('es', SENTENCE, 'f')).toBeNull();
  });
});

describe('better voice: switch and engine choice', () => {
  it('choosing Kokoro for a language downloads the Kokoro model once, saves the choice, and Piper speaks until it is loaded', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    mockFs.set(`${TTS}/kimacha-tts-pack-v1.ok`, '1');
    installSentences();
    const m = load();
    await m.startNeural();
    m.neuralEngineFor('es');
    m.neuralEngineFor('en');
    await flush();
    await m.setNeuralEngine('es', 'kokoro');
    expect(mockDownloads.map(d => d.url)).toEqual([NEURAL_MODELS.kokoro.archive]);
    expect(m.getNeuralState().engines.es).toBe('kokoro');
    expect(JSON.parse(mockFs.get(`${TTS}/settings.json`) as string).engines.es).toBe('kokoro');
    await flush();
    expect(mockLoaded.some(x => x.startsWith('es:ef_dora@'))).toBe(true);
    expect(m.neuralEngineFor('es')).toBe('kokoro');
    expect(m.neuralEngineFor('en')).toBe('piper');
  });

  it('when the new engine is loaded the old one of that language is freed, and only of that language', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    installModel('kokoro');
    mockFs.set(`${TTS}/kimacha-tts-pack-v1.ok`, '1');
    installSentences();
    const m = load();
    await m.startNeural();
    m.neuralEngineFor('es');
    m.neuralEngineFor('en');
    await flush();
    expect(mockPairReleased).toEqual(['es:kokoro', 'en:kokoro']); // the chosen Piper is loaded: nothing else of the language is kept
    mockPairReleased.length = 0;
    await m.setNeuralEngine('es', 'kokoro');
    await flush();
    expect(mockPairReleased).toEqual(['es:piper']);
    expect(m.neuralEngineFor('es')).toBe('kokoro');
    expect(m.neuralEngineFor('en')).toBe('piper');
    await m.setNeuralEngine('es', 'piper');
    await flush();
    expect(mockPairReleased).toEqual(['es:piper', 'es:kokoro']);
    expect(m.neuralEngineFor('es')).toBe('piper');
  });

  it('Hungarian cannot be switched to Kokoro, and an unchanged choice does nothing', async () => {
    const m = load();
    await m.startNeural();
    await m.setNeuralEngine('hu', 'kokoro');
    expect(m.getNeuralState().engines.hu).toBe('piper');
    await m.setNeuralEngine('es', 'piper');
    expect(mockDownloads).toHaveLength(0);
  });

  it('switching it off frees the engines and puts the phone back; on loads them again', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    mockFs.set(`${TTS}/kimacha-tts-pack-v1/index.json`, JSON.stringify({ version: 1, engine: 'x', files: { es: { 'el perro': 'es/a.mp3' } } }));
    mockFs.set(`${TTS}/kimacha-tts-pack-v1.ok`, '1');
    const m = load();
    await m.startNeural();
    m.neuralEngineFor('es');
    await flush();
    expect(m.neuralPackFile('es', 'el perro')).not.toBeNull();
    await m.setNeuralEnabled(false);
    expect(mockReleased).toBe(1);
    expect(m.neuralEngineFor('es')).toBeNull();
    expect(m.neuralPackFile('es', 'el perro')).toBeNull();
    expect(JSON.parse(mockFs.get(`${TTS}/settings.json`) as string).enabled).toBe(false);
    await m.setNeuralEnabled(true);
    expect(m.neuralEngineFor('es')).toBeNull(); // loads at its next use
    await flush();
    expect(m.neuralEngineFor('es')).toBe('piper');
    expect(m.neuralPackFile('es', 'el perro')).not.toBeNull();
  });

  it('Kokoro chosen but not loaded yet: the other engine speaks, and when none is ready the phone does', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    mockFs.set(`${TTS}/settings.json`, JSON.stringify({ enabled: true, engines: { es: 'kokoro', en: 'piper', hu: 'piper', de: 'piper' } }));
    const m = load();
    await m.startNeural();
    await flush();
    mockReady.clear(); // pretend the engines are not up
    expect(m.neuralEngineFor('es')).toBeNull();
    mockReady.add('es:piper:es_MX-claude-high');
    mockReady.add('es:piper:es_MX-ald-medium');
    expect(m.neuralEngineFor('es')).toBe('piper');
  });
});
