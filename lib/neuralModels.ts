// The "better voice" (beta): downloads, installed state, settings and the loading of the neural voices.
// Native only: lib/neuralModels.web.ts is the inert twin of the web build. lib/speech.ts asks this file
// two things (neuralPackFile, neuralEngineFor) and speaks with whichever level is ready.
//
// Disk layout (<files> = the app's files dir, DocumentDirectoryPath):
//   <files>/tts/<model dir>/           an extracted sherpa-onnx model (NEURAL_MODELS[key].dir)
//   <files>/tts/<model dir>.ok         marker, written after the extraction finished: no marker = not installed
//   <files>/tts/<PACK_DIR>/index.json  the word pack, its mp3 files below (<PACK_DIR>.ok is its marker)
//   <files>/tts/<SENTENCE_PACK_DIR>/   the sentence pack, same layout (<SENTENCE_PACK_DIR>.ok is its marker)
//   <files>/tts/settings.json          { enabled, engines }
//   <files>/tts/dl/                    the archives while they download
//
// The downloads use react-native-fs, the extraction the sherpa package's own (react-native-sherpa-onnx/
// extraction). A failed item never stops the others: the pack's URL may not exist yet, the Piper
// models then still install. A half-done download or extraction leaves no marker, so the old voice keeps
// speaking and the button offers the download again.

import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import {
  DEFAULT_ENGINES,
  NEURAL_MODELS,
  PACK_DIR,
  PACK_KEY,
  PACK_URL,
  SENTENCES_KEY,
  SENTENCE_PACK_DIR,
  SENTENCE_PACK_URL,
  itemBytes,
  normalizeEngines,
  packFileFor,
  requiredItems,
  sentencePackFileFor,
  voicePair,
  type EngineChoice,
  type NeuralEngine,
  type NeuralLang,
  type PackIndex,
  type VoiceGender,
} from './neuralVoices';
import { isNeuralReady, loadNeuralVoice, releaseNeural, releaseNeuralPair, stopNeural } from './neuralTts';
import { stopPack } from './packAudio';

export interface NeuralDownloadState {
  running: boolean;
  /** 0-100 over the bytes of everything still to fetch. */
  percent: number;
  phase: 'download' | 'unpack';
  /** Item keys the last run could not fetch (NEURAL_MODELS keys, or 'pack'). */
  failed: string[];
}

export interface NeuralState {
  /** A native build that can run the voices (Android); false on the web. */
  supported: boolean;
  /** The settings and the installed state have been read. */
  ready: boolean;
  /** The switch: off = the phone's own voice speaks. */
  enabled: boolean;
  engines: EngineChoice;
  installed: Record<string, boolean>;
  download: NeuralDownloadState;
}

const IDLE_DOWNLOAD: NeuralDownloadState = { running: false, percent: 0, phase: 'download', failed: [] };

let state: NeuralState = {
  supported: Platform.OS === 'android',
  ready: false,
  enabled: true,
  engines: { ...DEFAULT_ENGINES },
  installed: {},
  download: IDLE_DOWNLOAD,
};
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
function update(patch: Partial<NeuralState>): void {
  state = { ...state, ...patch };
  listeners.forEach(fn => fn());
}

export function getNeuralState(): NeuralState {
  return state;
}

export function useNeuralState(): NeuralState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

// Loaded on first use (a plain require: Metro bundles it, jest can stub it), so importing this file never touches the native module.
type Fs = typeof import('@dr.pogodin/react-native-fs');
const getFs = (): Fs => require('@dr.pogodin/react-native-fs');

const ttsDir = (fs: Fs) => `${fs.DocumentDirectoryPath}/tts`;
// The two packs (word, sentence) install into their own folder; a model's archive carries its own.
const isPack = (key: string) => key === PACK_KEY || key === SENTENCES_KEY;
const packDirName = (key: string) => (key === SENTENCES_KEY ? SENTENCE_PACK_DIR : PACK_DIR);
const itemDir = (fs: Fs, key: string) => `${ttsDir(fs)}/${isPack(key) ? packDirName(key) : NEURAL_MODELS[key].dir}`;
const itemMarker = (fs: Fs, key: string) => `${itemDir(fs, key)}.ok`;
const itemUrl = (key: string) => (key === PACK_KEY ? PACK_URL : key === SENTENCES_KEY ? SENTENCE_PACK_URL : NEURAL_MODELS[key].archive);

let packIndex: PackIndex | null = null;
let packRoot: string | null = null;
let sentenceIndex: PackIndex | null = null;
let sentenceRoot: string | null = null;

async function readInstalled(fs: Fs): Promise<Record<string, boolean>> {
  const installed: Record<string, boolean> = {};
  for (const key of [...Object.keys(NEURAL_MODELS), PACK_KEY, SENTENCES_KEY]) {
    installed[key] = await fs.exists(itemMarker(fs, key)).catch(() => false);
  }
  return installed;
}

async function readSettings(fs: Fs): Promise<Pick<NeuralState, 'enabled' | 'engines'>> {
  try {
    const raw = JSON.parse(await fs.readFile(`${ttsDir(fs)}/settings.json`, 'utf8'));
    return { enabled: raw?.enabled !== false, engines: normalizeEngines(raw?.engines) };
  } catch {
    return { enabled: true, engines: { ...DEFAULT_ENGINES } };
  }
}

async function writeSettings(): Promise<void> {
  try {
    const fs = getFs();
    await fs.mkdir(ttsDir(fs));
    await fs.writeFile(`${ttsDir(fs)}/settings.json`, JSON.stringify({ enabled: state.enabled, engines: state.engines }), 'utf8');
  } catch (e) {
    console.log(`[neural] settings not saved: ${String(e)}`);
  }
}

// A pack's index.json, from the pack folder (or one folder below it, if the archive had a top folder). A pack
// that is not installed or whose index is unreadable is simply absent: the other levels keep speaking.
async function readPackIndex(fs: Fs, key: string, label: string): Promise<{ index: PackIndex; root: string } | null> {
  if (!state.installed[key]) return null;
  const base = itemDir(fs, key);
  for (const root of [base, `${base}/${packDirName(key)}`]) {
    try {
      const index = JSON.parse(await fs.readFile(`${root}/index.json`, 'utf8')) as PackIndex;
      if (index && typeof index === 'object' && index.files) return { index, root };
    } catch {
      // not here
    }
  }
  console.log(`[neural] ${label} installed but its index.json is unreadable`);
  return null;
}

async function loadPackIndex(fs: Fs): Promise<void> {
  const word = await readPackIndex(fs, PACK_KEY, 'word pack');
  packIndex = word?.index ?? null;
  packRoot = word?.root ?? null;
  const sentences = await readPackIndex(fs, SENTENCES_KEY, 'sentence pack');
  sentenceIndex = sentences?.index ?? null;
  sentenceRoot = sentences?.root ?? null;
}

// Voices load one after the other (a load takes seconds and memory). A language loads lazily, on its first
// use (neuralEngineFor), and once: a load that failed is not tried again until the switch is toggled, the
// engine choice changes or a download ran, so a broken model does not cost a load attempt on every speech.
// The language keeps the phone's voice meanwhile.
const loadedLangs = new Set<string>();
let loadingChain: Promise<void> = Promise.resolve();

function loadEngines(lang: NeuralLang): void {
  if (!state.supported || !state.enabled) return;
  const engine = state.engines[lang];
  const tag = `${lang}:${engine}`;
  const pair = voicePair(lang, engine);
  if (loadedLangs.has(tag) || !pair.every(v => state.installed[v.model])) return;
  loadedLangs.add(tag);
  loadingChain = loadingChain.then(async () => {
    const fs = getFs();
    for (const voice of pair) {
      try {
        await loadNeuralVoice(voice, lang, itemDir(fs, voice.model));
      } catch (e) {
        console.log(`[neural] load failed ${lang}/${voice.id}: ${String(e)}`);
        return; // the tag stays in loadedLangs: no retry on every speech
      }
    }
    update({}); // the engine is ready now
    // The language's other engine is not needed any more (the old choice, or the stand-in while this one loaded).
    if (lang !== 'hu' && state.engines[lang] === engine) {
      const other: NeuralEngine = engine === 'piper' ? 'kokoro' : 'piper';
      loadedLangs.delete(`${lang}:${other}`); // choosing it again loads it again
      await releaseNeuralPair(lang, other);
    }
  });
}

// Once per app run (lib/speech.ts calls it from watchAppStateForSpeech). It reads the settings and the installed
// state; no engine loads here (that waits for the language's first use).
let started = false;
export async function startNeural(): Promise<void> {
  if (started || !state.supported) return;
  started = true;
  try {
    const fs = getFs();
    const settings = await readSettings(fs);
    update({ ...settings, installed: await readInstalled(fs), ready: true });
    await loadPackIndex(fs);
  } catch (e) {
    console.log(`[neural] start failed: ${String(e)}`);
    update({ ready: true });
  }
}

// Which engine speaks this language's sentences right now: the chosen one if it is loaded, else the other
// one of es/en if that is (Kokoro chosen but still downloading or loading: Piper speaks meanwhile);
// null = none is ready, the phone speaks. Asking also starts the first load of a language.
export function neuralEngineFor(lang: NeuralLang): NeuralEngine | null {
  if (!state.supported || !state.enabled) return null;
  loadEngines(lang);
  const chosen = state.engines[lang];
  if (isNeuralReady(lang, chosen)) return chosen;
  const other: NeuralEngine = chosen === 'piper' ? 'kokoro' : 'piper';
  if (lang !== 'hu' && isNeuralReady(lang, other)) return other;
  return null;
}

// Absolute path of the word pack's audio for this card word, or null (not installed, switched off, or the
// text is not a card word).
export function neuralPackFile(lang: NeuralLang, text: string): string | null {
  if (!state.supported || !state.enabled || !packIndex || !packRoot) return null;
  const relative = packFileFor(packIndex, lang, text);
  return relative ? `${packRoot}/${relative}` : null;
}

// Absolute path of the sentence pack's audio for this sentence spoken by the speaker of `gender` (f / m; without
// one the text's own hash gender), or null (not installed, switched off, or the sentence is not in the pack).
export function neuralSentenceFile(lang: NeuralLang, text: string, gender?: VoiceGender): string | null {
  if (!state.supported || !state.enabled || !sentenceIndex || !sentenceRoot) return null;
  const relative = sentencePackFileFor(sentenceIndex, lang, text, gender);
  return relative ? `${sentenceRoot}/${relative}` : null;
}

export async function setNeuralEnabled(enabled: boolean): Promise<void> {
  if (state.enabled === enabled) return;
  update({ enabled });
  void writeSettings();
  if (!enabled) {
    stopNeural();
    stopPack();
    loadedLangs.clear();
    await releaseNeural();
  }
}

// A language's sentence engine (hu is always Piper). Kokoro that is not installed starts its download.
export async function setNeuralEngine(lang: NeuralLang, engine: NeuralEngine): Promise<void> {
  const next = normalizeEngines({ ...state.engines, [lang]: engine });
  if (next[lang] === state.engines[lang]) return;
  update({ engines: next });
  void writeSettings();
  const needs = voicePair(lang, next[lang]).some(v => !state.installed[v.model]);
  if (needs) await downloadNeural();
  loadEngines(lang);
}

interface Job {
  key: string;
  url: string;
  file: string;
  bytes: number;
}

// Fetches and installs everything the choices need that is not installed yet. Resolves when the run ended;
// state.download.failed names what did not make it.
export async function downloadNeural(): Promise<void> {
  if (!state.supported || state.download.running) return;
  const fs = getFs();
  const { extractArchive } = require('react-native-sherpa-onnx/extraction') as typeof import('react-native-sherpa-onnx/extraction');
  const jobs: Job[] = requiredItems(state.engines)
    .filter(key => !state.installed[key])
    .map(key => {
      const url = itemUrl(key);
      return { key, url, file: `${ttsDir(fs)}/dl/${url.split('/').pop()}`, bytes: itemBytes(key) };
    });
  if (jobs.length === 0) return;

  let totalBytes = jobs.reduce((sum, job) => sum + job.bytes, 0);
  let doneBytes = 0;
  const failed: string[] = [];
  const show = (currentBytes: number, phase: 'download' | 'unpack') =>
    update({ download: { running: true, percent: Math.min(100, Math.floor((100 * (doneBytes + currentBytes)) / Math.max(totalBytes, 1))), phase, failed: [] } });
  show(0, 'download');
  try {
    await fs.mkdir(`${ttsDir(fs)}/dl`);
  } catch {
    // exists
  }

  for (const job of jobs) {
    const dir = itemDir(fs, job.key);
    let size = job.bytes;
    try {
      const transfer = fs.downloadFile({
        fromUrl: job.url,
        toFile: job.file,
        progressDivider: 1,
        progressInterval: 400,
        begin: ({ contentLength }) => {
          if (isPack(job.key) && contentLength > 0) {
            totalBytes += contentLength - size; // the server's size replaces the one built in
            size = contentLength;
          }
        },
        progress: ({ bytesWritten }) => show(Math.min(bytesWritten, size), 'download'),
      });
      const result = await transfer.promise;
      if (result.statusCode !== 200) throw new Error(`HTTP ${result.statusCode}`);
      show(size, 'unpack');
      await fs.unlink(dir).catch(() => {});
      await fs.unlink(`${dir}.ok`).catch(() => {});
      // the packs' files sit at the archive root, the models' in their own folder
      const target = isPack(job.key) ? dir : ttsDir(fs);
      await fs.mkdir(target);
      const extracted = await extractArchive({ modelId: job.key, archivePath: job.file, format: 'tar.bz2' }, target, {
        force: true,
        showNotificationsEnabled: false,
      });
      // a paused or cut-off extraction comes back as { success: false }, not as an error: no marker for it
      if (!extracted?.success) throw new Error(`extraction stopped (${extracted?.success === false ? (extracted.reason ?? 'paused') : 'no result'})`);
      await fs.writeFile(`${dir}.ok`, '1', 'utf8');
      doneBytes += size;
      console.log(`[neural] installed ${job.key} (${size} bytes)`);
    } catch (e) {
      failed.push(job.key);
      console.log(`[neural] download failed ${job.key}: ${String(e).slice(0, 120)}`);
      await fs.unlink(dir).catch(() => {});
    } finally {
      await fs.unlink(job.file).catch(() => {});
    }
  }

  update({ installed: await readInstalled(fs) });
  await loadPackIndex(fs);
  update({ download: { running: false, percent: failed.length ? state.download.percent : 100, phase: 'download', failed } });
  loadedLangs.clear(); // new files may have repaired a model that failed to load: the next use tries again
}
