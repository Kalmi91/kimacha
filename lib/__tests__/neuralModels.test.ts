// The downloads and the state of the better voice (lib/neuralModels.ts) with an in-memory file system, a
// scripted downloader and a stub extractor: what installs, what a failed item leaves behind, what the
// switch and the engine choice do. The word pack's URL may not exist yet, so a 404 on it must not stop the
// models.

import { NEURAL_MODELS, PACK_KEY, PIPER_MODEL_KEYS } from '../neuralVoices';

const FILES = '/data/files';
const TTS = `${FILES}/tts`;
const mockFs = new Map<string, string>();
const mockDownloads: { url: string; status: number }[] = [];
const mockStatusFor: Record<string, number> = {};
const mockExtracted: { id: string; target: string }[] = [];
const mockFailExtract = new Set<string>();
const mockLoaded: string[] = [];
const mockReady = new Set<string>();
let mockReleased = 0;

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
    if (archive.modelId === 'pack') mockFs.set(`${target}/index.json`, JSON.stringify({ version: 1, engine: 'kokoro-v1.0', files: { es: { 'el perro': 'es/27956ac4.mp3' } } }));
    else mockFs.set(`${target}/${(require('../neuralVoices').NEURAL_MODELS as typeof NEURAL_MODELS)[archive.modelId].dir}/tokens.txt`, 't');
    return { success: true };
  },
}), { virtual: true });

jest.mock('../neuralTts', () => ({
  loadNeuralVoice: async (voice: { id: string; engine: string; model: string }, lang: string, dir: string) => {
    mockLoaded.push(`${lang}:${voice.id}@${dir}`);
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
    expect(s.engines).toEqual({ es: 'piper', en: 'piper', hu: 'piper' });
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

  it('installed models load at start: Spanish and English now, Hungarian at its first use', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    const m = load();
    await m.startNeural();
    await flush();
    expect(mockLoaded.map(x => x.split('@')[0]).sort()).toEqual(['en:en_US-john-medium', 'en:en_US-kristin-medium', 'es:es_MX-ald-medium', 'es:es_MX-claude-high']);
    expect(m.neuralEngineFor('es')).toBe('piper');
    expect(m.neuralEngineFor('hu')).toBeNull(); // asking starts its load
    await flush();
    expect(m.neuralEngineFor('hu')).toBe('piper');
  });

  it('the saved switch and choices come back after a restart', async () => {
    mockFs.set(`${TTS}/settings.json`, JSON.stringify({ enabled: false, engines: { es: 'kokoro', en: 'piper', hu: 'kokoro' } }));
    const m = load();
    await m.startNeural();
    expect(m.getNeuralState().enabled).toBe(false);
    expect(m.getNeuralState().engines).toEqual({ es: 'kokoro', en: 'piper', hu: 'piper' });
  });
});

describe('better voice: download', () => {
  it('fetches the pack first, then the six Piper models, extracts each into the right folder and marks it installed', async () => {
    const m = load();
    await m.startNeural();
    await m.downloadNeural();
    expect(mockDownloads.map(d => d.url)[0]).toContain('kimacha-tts-pack-v1.tar.bz2');
    expect(mockDownloads).toHaveLength(1 + PIPER_MODEL_KEYS.length);
    expect(mockDownloads.some(d => d.url.includes('kokoro'))).toBe(false);
    expect(mockExtracted.find(e => e.id === PACK_KEY)?.target).toBe(`${TTS}/kimacha-tts-pack-v1`);
    expect(mockExtracted.find(e => e.id === 'es_MX-claude-high')?.target).toBe(TTS);
    const s = m.getNeuralState();
    expect(s.download).toEqual({ running: false, percent: 100, phase: 'download', failed: [] });
    expect([PACK_KEY, ...PIPER_MODEL_KEYS].every(key => s.installed[key])).toBe(true);
    expect([...mockFs.keys()].some(k => k.includes('/dl/') && !k.endsWith('.dir'))).toBe(false); // no archive left behind
    expect(m.neuralPackFile('es', 'el perro')).toBe(`${TTS}/kimacha-tts-pack-v1/es/27956ac4.mp3`);
    expect(m.neuralPackFile('es', 'la casa')).toBeNull();
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

  it('nothing missing means nothing to download', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    mockFs.set(`${TTS}/kimacha-tts-pack-v1.ok`, '1');
    const m = load();
    await m.startNeural();
    await m.downloadNeural();
    expect(mockDownloads).toHaveLength(0);
  });
});

describe('better voice: switch and engine choice', () => {
  it('choosing Kokoro for a language downloads the Kokoro model once, saves the choice, and Piper speaks until it is loaded', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    mockFs.set(`${TTS}/kimacha-tts-pack-v1.ok`, '1');
    const m = load();
    await m.startNeural();
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
    await flush();
    expect(m.neuralPackFile('es', 'el perro')).not.toBeNull();
    await m.setNeuralEnabled(false);
    expect(mockReleased).toBe(1);
    expect(m.neuralEngineFor('es')).toBeNull();
    expect(m.neuralPackFile('es', 'el perro')).toBeNull();
    expect(JSON.parse(mockFs.get(`${TTS}/settings.json`) as string).enabled).toBe(false);
    await m.setNeuralEnabled(true);
    await flush();
    expect(m.neuralEngineFor('es')).toBe('piper');
    expect(m.neuralPackFile('es', 'el perro')).not.toBeNull();
  });

  it('Kokoro chosen but not loaded yet: the other engine speaks, and when none is ready the phone does', async () => {
    for (const key of PIPER_MODEL_KEYS) installModel(key);
    mockFs.set(`${TTS}/settings.json`, JSON.stringify({ enabled: true, engines: { es: 'kokoro', en: 'piper', hu: 'piper' } }));
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
