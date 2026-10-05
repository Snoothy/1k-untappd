import {
  isConfirmed,
  normalizeProgress,
  previewCount,
  progressView,
  type ProgressSnapshot,
} from "../lib/progress";
import {
  createSupernovaRenderer,
  INCREMENT_IMPACT,
  INCREMENT_DURATION,
  type CounterIncrement,
} from "./supernova-renderer";
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
    increment: null as CounterIncrement | null,
    impactPoint: null as [number, number] | null,
    dirty: true,
  };
  let pendingIncrement: { value: number; committed: boolean } | null = null;
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
    if (state.paused && pendingIncrement) {
      cancelIncrement();
      applyLiveCount(progress.current);
    }
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
  function cancelIncrement() {
    pendingIncrement = null;
    state.increment = null;
  }
  function applyLiveCount(value: number) {
    const previous = state.count;
    setCount(value);
    if (value > previous && isConfirmed(progress)) {
      const crossedGoal = previous < progress.target && value >= progress.target;
      if (crossedGoal) state.finale = state.paused || !renderer ? 11 : 8.5;
      announcement.textContent = `${progressView(progress, value).description}.${crossedGoal ? " Legend unlocked." : ""}`;
    }
  }
  function startIncrement(value: number) {
    state.increment = { age: 0, angle: -0.55 + state.time * 0.072 };
    pendingIncrement = { value, committed: false };
    invalidate();
  }
  function finale() {
    cancelIncrement();
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
            // The preview's existing beats use the same flight and impact as live data.
            const beat = [8.5, 5, 2.5].find(at => state.finale! >= at - INCREMENT_IMPACT);
            const age = beat === undefined ? INCREMENT_DURATION : state.finale - beat + INCREMENT_IMPACT;
            state.increment = age < INCREMENT_DURATION && beat !== undefined
              ? { age, angle: -0.55 + (state.time - age) * 0.072 }
              : null;
          }
        }
        if (!state.preview && state.increment) {
          state.increment.age += accumulator;
          if (pendingIncrement && !pendingIncrement.committed && state.increment.age >= INCREMENT_IMPACT) {
            // Data, pulse and explosion are committed together on this animation frame.
            pendingIncrement.committed = true;
            applyLiveCount(pendingIncrement.value);
          }
          if (state.increment.age >= INCREMENT_DURATION) {
            cancelIncrement();
            if (progress.current > state.count) startIncrement(progress.current);
          }
        }
      }
      renderer?.draw(state);
      const hit =
        state.finale !== null && state.finale >= 8.5
          ? Math.exp(-(state.finale - 8.5) * 0.85)
          : 0;
      core.style.transform = `scale(${(1 + hit * 0.035).toFixed(4)})`;
      const age = state.increment?.age;
      const impactAge = age === undefined ? -1 : age - INCREMENT_IMPACT;
      const pulse = impactAge >= 0
        ? Math.exp(-impactAge * 3.2) * (0.84 + 0.16 * Math.cos(impactAge * 18)) : 0;
      const anticipation = age !== undefined && impactAge < 0
        ? Math.max(0, (age - 1.65) / (INCREMENT_IMPACT - 1.65)) : 0;
      count.style.setProperty("--sn-count-scale", (1 + pulse * 0.145 - anticipation * 0.025).toFixed(4));
      count.style.setProperty("--sn-count-heat", (1 + pulse * 0.85 + anticipation * 0.1).toFixed(3));
      count.style.setProperty("--sn-count-glow", `${22 + pulse * 42}px`);
      if (age === undefined) delete root.dataset.incrementPhase;
      else root.dataset.incrementPhase = age < 0.94 ? "outbound" : impactAge < 0 ? "return" : "impact";
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
      const previous = progress;
      progress = next;
      if (!state.preview) {
        if (!isConfirmed(previous) || !isConfirmed(next) || next.current < previous.current ||
          state.paused || reduced.matches || !renderer) {
          cancelIncrement();
          applyLiveCount(next.current);
        } else if (next.current > state.count) {
          if (!state.increment) startIncrement(next.current);
          // Coalesce a newer snapshot during flight; never count invented intermediate beers.
          else if (pendingIncrement && !pendingIncrement.committed) pendingIncrement.value = next.current;
          setCount(state.count);
        } else {
          setCount(state.count);
        }
      }
    },
    onConnection(next) {
      connection = next;
      // Status updates must not reveal the pending number before the star hits.
      if (!state.preview) setCount(state.count);
    },
  });
  const observer = new ResizeObserver(() => {
    const rect = stage.getBoundingClientRect();
    const number = count.getBoundingClientRect();
    state.impactPoint = [number.left - rect.left + number.width / 2, number.top - rect.top + number.height / 2];
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
