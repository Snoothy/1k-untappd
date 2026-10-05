export type ProgressSource = "fallback" | "scraped" | "untappd";

export interface ProgressSnapshot {
  username: string;
  displayName: string;
  current: number;
  target: number;
  source: ProgressSource;
  updatedAt: string;
}

const numbers = new Intl.NumberFormat("en-US");
const percentages = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});
const dates = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function normalizeProgress(value: unknown): ProgressSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (
    typeof data.current !== "number" ||
    !Number.isSafeInteger(data.current) ||
    data.current < 0
  )
    return null;
  if (
    typeof data.target !== "number" ||
    !Number.isSafeInteger(data.target) ||
    data.target < 1
  )
    return null;
  const username =
    typeof data.username === "string" && data.username.trim()
      ? data.username
      : "Snoothy";
  return {
    username,
    displayName:
      typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName
        : username,
    current: data.current,
    target: data.target,
    source:
      data.source === "scraped" || data.source === "untappd"
        ? data.source
        : "fallback",
    updatedAt:
      typeof data.updatedAt === "string" &&
      Number.isFinite(Date.parse(data.updatedAt))
        ? data.updatedAt
        : "",
  };
}

export function isConfirmed(snapshot: ProgressSnapshot): boolean {
  return snapshot.source !== "fallback";
}

export function canAcceptProgress(
  current: ProgressSnapshot,
  next: ProgressSnapshot,
): boolean {
  // A failed scrape must not replace a confirmed count with placeholder data.
  if (isConfirmed(current) && !isConfirmed(next)) return false;
  // Placeholder timestamps must not prevent recovery to a real count.
  if (!isConfirmed(current) && isConfirmed(next)) return true;
  if (
    current.updatedAt &&
    next.updatedAt &&
    Date.parse(next.updatedAt) < Date.parse(current.updatedAt)
  )
    return false;
  return true;
}

export function progressView(
  snapshot: ProgressSnapshot,
  count = snapshot.current,
) {
  const percentage = Math.min(100, (count / snapshot.target) * 100);
  return {
    current: numbers.format(count),
    target: numbers.format(snapshot.target),
    percentage,
    percentLabel: `${percentages.format(percentage)}% COMPLETE`,
    remaining: Math.max(0, snapshot.target - count),
    remainingLabel:
      count >= snapshot.target
        ? "LEGEND UNLOCKED"
        : `${numbers.format(snapshot.target - count)} TO GO`,
    complete: count >= snapshot.target,
    progressValue: Math.min(count, snapshot.target),
    description: `${numbers.format(count)} of ${numbers.format(snapshot.target)} unique beers`,
    sourceLabel: isConfirmed(snapshot) ? "UNTAPPD SNAPSHOT" : "DEMO DATA",
    updatedLabel: snapshot.updatedAt
      ? `Updated ${dates.format(new Date(snapshot.updatedAt))} UTC`
      : "Update time unavailable",
  };
}

export function previewCount(target: number, elapsed: number): number {
  const remaining = elapsed < 2.5 ? 3 : elapsed < 5 ? 2 : elapsed < 8.5 ? 1 : 0;
  return Math.max(0, target - remaining);
}
