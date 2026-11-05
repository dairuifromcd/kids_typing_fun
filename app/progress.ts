export type StoredSession = {
  id: string;
  taskVersion: string;
  startedAt: string;
  completedAt?: string;
  status: "active" | "complete";
  accuracy?: number;
  errors: { position: number; expected: string; received: string }[];
  pauses: { position: number; expected: string; durationMs: number }[];
  hints: { position: number; expected: string; level: number; reason: "pause" | "error" }[];
};

export type Bookmark = {
  version: 1;
  taskVersion: string;
  chapterIndex: number;
  position: number;
  phase: "read" | "paused";
  session: StoredSession;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSession(value: unknown): value is StoredSession {
  if (!record(value) || typeof value.id !== "string" || !value.id ||
      typeof value.taskVersion !== "string" || typeof value.startedAt !== "string" ||
      !Number.isFinite(Date.parse(value.startedAt)) ||
      !["active", "complete"].includes(String(value.status))) return false;
  const validLog = (entry: unknown) => record(entry) && Number.isInteger(entry.position) &&
    Number(entry.position) >= 0 && typeof entry.expected === "string" && entry.expected.length === 1;
  return Array.isArray(value.errors) && value.errors.every((entry) => validLog(entry) && typeof entry.received === "string") &&
    Array.isArray(value.pauses) && value.pauses.every((entry) => validLog(entry) && Number.isFinite(entry.durationMs) && entry.durationMs >= 0) &&
    Array.isArray(value.hints) && value.hints.every((entry) => validLog(entry) && [1, 2, 3].includes(entry.level) && ["pause", "error"].includes(entry.reason));
}

/** Reject incompatible or malformed bookmarks instead of resuming at a wrong key. */
export function parseBookmark(raw: string | null, taskVersion: string, chapters: readonly string[]): Bookmark | null {
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!record(saved) || saved.version !== 1 || saved.taskVersion !== taskVersion ||
        !Number.isInteger(saved.chapterIndex) || !Number.isInteger(saved.position) ||
        !["read", "paused"].includes(String(saved.phase)) || !isSession(saved.session) ||
        saved.session.status !== "active" || saved.session.taskVersion !== taskVersion) return null;
    const index = Number(saved.chapterIndex);
    const position = Number(saved.position);
    if (index < 0 || index >= chapters.length) return null;
    const start = chapters.slice(0, index).reduce((sum, chapter) => sum + chapter.length, 0);
    if (position < start || position >= start + chapters[index].length ||
        (saved.phase === "read" && position !== start)) return null;
    const text = chapters.join("");
    for (const entry of [...saved.session.errors, ...saved.session.pauses, ...saved.session.hints]) {
      if (entry.position > position || text[entry.position] !== entry.expected) return null;
    }
    return saved as Bookmark;
  } catch {
    return null;
  }
}
