import {
  isConfirmed,
  normalizeProgress,
  previewCount,
  progressView,
  type ProgressSnapshot,
} from "../lib/progress";
import { createSupernovaRenderer } from "./supernova-renderer";
import { startProgressPolling, type ConnectionState } from "../lib/live-progress";

export function mountSupernova(root: HTMLElement): void {
  if (root.dataset.mounted === "true") return;
  const initial = normalizeProgress({
    username: root.dataset.username,
    displayName: root.dataset.displayName,
    current: Number(root.dataset.current),
    target: Number(root.dataset.target),
    source: root.dataset.source,
    updatedAt: root.dataset.updatedAt,
  });
  if (!initial) return;
  let progress: ProgressSnapshot = initial;
  root.dataset.mounted = "true";
  function required<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Supernova element missing: ${selector}`);
    return element;
  }
  const stage = required(".sn-stage"),
    core = required(".sn-core");
  const canvas = required<HTMLCanvasElement>("canvas");
  const count = required(".sn-count"),
    track = required(".sn-track"),
    fill = required(".sn-fill");
  const source = required(".sn-demo"),
    updated = required<HTMLTimeElement>(".sn-updated");
  const announcement = required(".sn-announcement"),
    status = required(".sn-status");
  const renderer = createSupernovaRenderer(canvas);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const listeners = new AbortController(),
    options = { signal: listeners.signal };
  const state = {
    time: 6,
    paused: reduced.matches,
    finale:
      isConfirmed(progress) &&
      progress.current >= progress.target &&
      !reduced.matches
        ? 8.5
        : (null as number | null),
    preview: false,
    count: progress.current,
    flare: null as number | null,
    dirty: true,
  };
  let frameId = 0,
    last = performance.now(),
    accumulator = 0,
    disposed = false;
  let connection: ConnectionState = "snapshot";
  function schedule() {
    if (!disposed && renderer && !frameId && !document.hidden)
      frameId = requestAnimationFrame(frame);
  }
  function invalidate() {
    state.dirty = true;
    schedule();
  }
  function setCount(value: number) {
    state.count = value;
    const view = progressView(progress, value);
    count.textContent = view.current;
    count.setAttribute("aria-label", view.description);
    fill.style.width = `${view.percentage}%`;
    track.setAttribute("aria-valuemax", String(progress.target));
    track.setAttribute("aria-valuenow", String(view.progressValue));
    track.setAttribute("aria-valuetext", view.description);
    required(".sn-complete").textContent = view.percentLabel;
    required(".sn-remaining").textContent = view.remainingLabel;
    required(".sn-eyebrow").textContent = view.complete
      ? "A LEGEND IS BORN."
      : value === progress.target - 1
        ? "ONE. MORE. STORY."
        : "THE JOURNEY SO FAR";
    required(".sn-unit").textContent = view.complete
      ? `${view.target} UNIQUE BEERS REACHED`
      : `OF ${view.target} UNIQUE BEERS`;
    required(".sn-title-first").textContent = view.complete
      ? "LEGEND."
      : "THE ROAD";
    required(".sn-title-last").textContent = view.complete
      ? "UNLOCKED."
      : "TO LEGEND.";
    required(".sn-poem").textContent =
      `${progress.target === 1000 ? "A thousand beers." : `${view.target} unique beers.`}\n${view.complete ? "An unforgettable journey." : "A story worth telling."}`;
    required(".sn-target-label").textContent = `ROAD TO ${view.target}`;
    required(".sn-name").textContent = progress.displayName;
    required(".sn-seal").textContent = progress.displayName
      .slice(0, 1)
      .toUpperCase();
    const profile = required<HTMLAnchorElement>(".sn-brand");
    profile.href = `https://untappd.com/user/${encodeURIComponent(progress.username)}`;
    profile.setAttribute(
      "aria-label",
      `Open ${progress.displayName} on Untappd`,
    );
    source.textContent = state.preview ? "FINALE PREVIEW"
      : !isConfirmed(progress) ? view.sourceLabel
      : connection === "live" ? "LIVE UPDATES"
      : connection === "offline" ? "OFFLINE · LAST UPDATE"
      : connection === "retrying" ? "RECONNECTING"
      : view.sourceLabel;
    updated.textContent = state.preview
      ? "Simulation · press Space to return"
      : view.updatedLabel;
    updated.dateTime = state.preview ? "" : progress.updatedAt;
    root.classList.toggle("sn-completed", view.complete);
    invalidate();
  }
  function syncPause() {
    root.classList.toggle("sn-paused", state.paused);
    last = performance.now();
    accumulator = 0;
    invalidate();
  }
  function pause() {
    state.paused = !state.paused;
    syncPause();
  }
  function flare() {
    if (!renderer || (state.flare !== null && state.flare < 1.5)) return;
    state.flare = state.paused ? 1.6 : 0;
    announcement.textContent = "Solar flare.";
    invalidate();
  }
  function finale() {
    if (state.preview) {
      state.preview = false;
      state.finale = null;
      state.flare = null;
      setCount(progress.current);
      announcement.textContent = `Returned to progress: ${progressView(progress).description}.`;
    } else {
      state.preview = true;
      state.finale = state.paused || !renderer ? 11 : 0;
      setCount(previewCount(progress.target, state.finale));
      announcement.textContent =
        state.paused || !renderer
          ? `Finale preview: ${progressView(progress, progress.target).description}.`
          : "Finale preview. The final three beers.";
    }
    invalidate();
  }
  async function fullscreen() {
    status.textContent = "";
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else {
        await root.requestFullscreen();
        root.focus({ preventScroll: true });
      }
    } catch {
      status.textContent =
        "Full screen is unavailable here. Use your browser’s full-screen command instead.";
    }
  }
  function frame(now: number) {
    frameId = 0;
    if (disposed || !root.isConnected) {
      dispose();
      return;
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += dt;
    if (!document.hidden && (accumulator >= 1 / 40 || state.dirty)) {
      if (!state.paused) {
        state.time += accumulator;
        if (state.flare !== null) {
          state.flare += accumulator;
          if (state.flare > 8) state.flare = null;
        }
        if (state.finale !== null) {
          state.finale += accumulator;
          // The show never overwrites real counts, including counts beyond the goal.
          if (state.preview) {
            const next = previewCount(progress.target, state.finale);
            if (next !== state.count) {
              setCount(next);
              if (next >= progress.target)
                announcement.textContent = `${progressView(progress, next).current} unique beers. Legend unlocked.`;
            }
          }
        }
      }
      renderer?.draw(state);
      const hit =
        state.finale !== null && state.finale >= 8.5
          ? Math.exp(-(state.finale - 8.5) * 0.85)
          : 0;
      core.style.transform = `scale(${(1 + hit * 0.035).toFixed(4)})`;
      state.dirty = false;
      accumulator = 0;
    }
    if (!state.paused || state.dirty) schedule();
  }
  const stopPolling = startProgressPolling({
    liveUrl: root.dataset.liveProgressUrl!,
    snapshotUrl: root.dataset.progressUrl!,
    getCurrent: () => progress,
    onProgress(next) {
      const crossedGoal = progress.current < progress.target &&
        next.current >= next.target && isConfirmed(next);
      progress = next;
      if (!state.preview) {
        setCount(next.current);
        if (crossedGoal) {
          state.finale = state.paused ? 11 : 8.5;
          announcement.textContent = `${progressView(next).current} unique beers. Legend unlocked.`;
          invalidate();
        }
      }
    },
    onConnection(next) {
      connection = next;
      if (!state.preview) setCount(progress.current);
    },
  });
  const observer = new ResizeObserver(() => {
    const rect = stage.getBoundingClientRect();
    renderer?.resize(rect.width, rect.height);
    invalidate();
  });
  observer.observe(stage);
  reduced.addEventListener(
    "change",
    () => {
      state.paused = reduced.matches;
      syncPause();
    },
    options,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input,textarea,select,[contenteditable="true"],button,a',
        ) &&
        document.fullscreenElement !== root
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "f") {
        event.preventDefault();
        void fullscreen();
      } else if (key === "p" && renderer) {
        event.preventDefault();
        pause();
      } else if (key === "s" && renderer) {
        event.preventDefault();
        flare();
      } else if (event.code === "Space") {
        event.preventDefault();
        finale();
      }
    },
    options,
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
        accumulator = 0;
      } else {
        last = performance.now();
        invalidate();
      }
    },
    options,
  );
  document.addEventListener("astro:before-swap", dispose, options);
  window.addEventListener(
    "pagehide",
    (event) => {
      if (!event.persisted) dispose();
    },
    options,
  );
  function dispose() {
    if (disposed) return;
    disposed = true;
    listeners.abort();
    observer.disconnect();
    cancelAnimationFrame(frameId);
    stopPolling();
    delete root.dataset.mounted;
  }
  setCount(progress.current);
  syncPause();
}
