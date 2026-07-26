export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

/** Simple offset cursor (base64). Real impl would use a keyset cursor. */
export function paginate<T>(items: T[], limit: number, cursor?: string): Page<T> {
  const offset = decodeCursor(cursor);
  const slice = items.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  const nextCursor = nextOffset < items.length ? encodeCursor(nextOffset) : null;
  return { data: slice, nextCursor };
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}
function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  const n = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function parseLimit(raw: string | undefined, fallback = 25): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), 100);
}
