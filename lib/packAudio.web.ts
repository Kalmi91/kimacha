// Web twin of lib/packAudio.ts: the web build keeps the browser's own speech, the word pack is native only.

export interface PackPlayOptions {
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onFail?: () => void;
}

export function stopPack(): void {}

export function playPackFile(_path: string, options: PackPlayOptions = {}): void {
  options.onFail?.();
}
