// Web has no public Downloads folder / MediaStore, so file backup is a no-op here.
// The Save/Load buttons surface a "phone only" message when these throw.
export class PermissionError extends Error {}

export async function saveProgress(): Promise<string> {
  throw new Error('web-unsupported');
}

export async function loadProgress(): Promise<void> {
  throw new Error('web-unsupported');
}

export function openAllFilesAccessSettings(): void {}
