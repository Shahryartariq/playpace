const ISO = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/** Converts a YouTube ISO 8601 duration (PT1H2M3S, P1DT2H, P0D) to whole seconds. Returns 0 for anything else. */
export function parseIsoDuration(value: string | undefined | null): number {
  if (!value) return 0;
  const m = ISO.exec(value);
  if (!m) return 0;
  const [, w, d, h, min, s] = m;
  const total =
    Number(w ?? 0) * 604_800 +
    Number(d ?? 0) * 86_400 +
    Number(h ?? 0) * 3_600 +
    Number(min ?? 0) * 60 +
    Number(s ?? 0);
  return Math.round(total);
}
