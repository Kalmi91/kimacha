// The stored form of the beta switches (user_meta.beta_flags): a JSON object
// {flagName: boolean}. Name-agnostic and import-free on purpose, so both DB
// implementations can use it without a cycle through lib/beta.ts.

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
