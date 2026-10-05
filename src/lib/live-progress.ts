import {
  canAcceptProgress,
  isConfirmed,
  normalizeProgress,
  type ProgressSnapshot,
} from "./progress.ts";

export type ConnectionState = "snapshot" | "live" | "retrying" | "offline";
export const POLL_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 300_000;

export function startProgressPolling({
  liveUrl,
  snapshotUrl,
  getCurrent,
  onProgress,
  onConnection,
}: {
  liveUrl: string;
  snapshotUrl: string;
  getCurrent: () => ProgressSnapshot;
  onProgress: (snapshot: ProgressSnapshot) => void;
  onConnection: (state: ConnectionState) => void;
}): () => void {
  let timer = 0;
  let pending: AbortController | null = null;
  let stopped = false;
  let working = false;
  let failures = 0;
  let retryAfter = 0;
  let lastStarted = -Infinity;
  let nextAllowedAt = 0;
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const available = () => !stopped && !document.hidden && navigator.onLine;

  function accept(raw: unknown): ProgressSnapshot | null {
    if (!raw || typeof raw !== "object" ||
      typeof (raw as { username?: unknown }).username !== "string") return null;
    const next = normalizeProgress(raw);
    const current = getCurrent();
    if (!next || !next.updatedAt ||
      next.username.toLowerCase() !== current.username.toLowerCase() ||
      next.target !== current.target ||
      Date.parse(next.updatedAt) > Date.now() + 60_000 ||
      !canAcceptProgress(current, next)) return null;
    onProgress(next);
    return next;
  }

  async function load(url: string) {
    const request = new AbortController();
    pending = request;
    const timeout = window.setTimeout(() => request.abort(), 8000);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: request.signal,
      });
      const retry = response.headers.get("Retry-After");
      if (retry) {
        const milliseconds = /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : Date.parse(retry) - Date.now();
        if (Number.isFinite(milliseconds)) retryAfter = Math.max(retryAfter, Math.min(MAX_BACKOFF_MS, milliseconds));
      }
      if (!response.ok) throw new Error("Progress request failed");
      return await response.json() as unknown;
    } finally {
      window.clearTimeout(timeout);
      if (pending === request) pending = null;
    }
  }

  function schedule(delay: number) {
    window.clearTimeout(timer);
    if (available()) timer = window.setTimeout(() => { void refresh(); }, delay);
  }

  async function refresh() {
    if (!available() || working) return;
    working = true;
    lastStarted = Date.now();
    retryAfter = 0;
    let fresh = false;
    try {
      const raw = await load(liveUrl);
      if (available()) {
        const next = accept(raw);
        fresh = !!next && isConfirmed(next) &&
          !(raw as { stale?: boolean }).stale &&
          Date.now() - Date.parse(next.updatedAt) < 120_000;
      }
    } catch {
      // Keep the last valid snapshot. A build snapshot is a secondary fallback.
    }
    if (!fresh && available()) {
      try {
        const raw = await load(snapshotUrl);
        if (available()) accept(raw);
      } catch {
        // Offline, unavailable and malformed responses never reset the count.
      }
    }
    working = false;
    if (!available()) return;
    failures = fresh ? 0 : Math.min(failures + 1, 4);
    onConnection(fresh ? "live" : "retrying");
    const delay = Math.max(retryAfter, Math.min(MAX_BACKOFF_MS, POLL_INTERVAL_MS * 2 ** failures));
    nextAllowedAt = fresh ? 0 : Date.now() + delay;
    schedule(delay);
  }

  function wake() {
    window.clearTimeout(timer);
    if (!available()) {
      pending?.abort();
      if (!navigator.onLine && !stopped) onConnection("offline");
      return;
    }
    if (!working) schedule(Math.max(0, 5000 - (Date.now() - lastStarted), nextAllowedAt - Date.now()));
  }

  document.addEventListener("visibilitychange", wake, options);
  window.addEventListener("online", wake, options);
  window.addEventListener("offline", wake, options);
  window.addEventListener("focus", wake, options);
  wake();

  return () => {
    stopped = true;
    listeners.abort();
    window.clearTimeout(timer);
    pending?.abort();
  };
}
