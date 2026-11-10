// Legacy user_meta.beta_flags in backups: a JSON object {flagName: boolean}.
// Kept for backup compatibility only; these values do not control app features.

// A missing, invalid or non-object value gives {}; non-boolean entries are dropped.
export function parseBetaFlagMap(raw: unknown): Record<string, boolean> {
  if (typeof raw !== 'string' || raw === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}
