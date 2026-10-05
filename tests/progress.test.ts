import test from "node:test";
import assert from "node:assert/strict";
import {
  canAcceptProgress,
  normalizeProgress,
  previewCount,
  progressView,
} from "../src/lib/progress.ts";

const snapshot = normalizeProgress({
  username: "Snoothy",
  current: 987,
  target: 1000,
  source: "scraped",
  updatedAt: "2026-10-05T17:00:00Z",
})!;

test("preserves a real count and distinguishes its source from placeholder data", () => {
  const view = progressView(snapshot);
  assert.equal(view.current, "987");
  assert.equal(view.remaining, 13);
  assert.equal(view.sourceLabel, "UNTAPPD SNAPSHOT");
  assert.equal(view.percentLabel, "98.7% COMPLETE");
  assert.equal(
    progressView({ ...snapshot, source: "fallback" }).sourceLabel,
    "DEMO DATA",
  );
});

test("rejects malformed values without inventing replacement progress", () => {
  for (const data of [
    null,
    {},
    { current: -1, target: 1000 },
    { current: "987", target: 1000 },
    { current: 987, target: 0 },
    { current: Infinity, target: 1000 },
  ]) {
    assert.equal(normalizeProgress(data), null);
  }
});

test("counts beyond the goal stay intact while the progress bar stays valid", () => {
  const view = progressView({ ...snapshot, current: 1043 });
  assert.equal(view.current, "1,043");
  assert.equal(view.progressValue, 1000);
  assert.equal(view.percentage, 100);
  assert.equal(view.remaining, 0);
  assert.equal(view.complete, true);
});

test("does not replace confirmed data with a failed scrape or an older deployment", () => {
  assert.equal(
    canAcceptProgress(snapshot, {
      ...snapshot,
      current: 800,
      source: "fallback",
      updatedAt: "2026-10-05T18:00:00Z",
    }),
    false,
  );
  assert.equal(
    canAcceptProgress(snapshot, {
      ...snapshot,
      updatedAt: "2026-10-04T18:00:00Z",
    }),
    false,
  );
  assert.equal(
    canAcceptProgress(snapshot, {
      ...snapshot,
      current: 988,
      updatedAt: "2026-10-05T18:00:00Z",
    }),
    true,
  );
});

test("preview timing reaches the configured goal without altering the snapshot", () => {
  assert.deepEqual(
    [0, 2.5, 5, 8.5, 20].map((t) => previewCount(1000, t)),
    [997, 998, 999, 1000, 1000],
  );
  assert.equal(previewCount(2, 0), 0);
  assert.equal(previewCount(500, 8.5), 500);
  assert.equal(snapshot.current, 987);
});
