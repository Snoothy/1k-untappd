type ProgressBarProps = {
  current: number;
  target: number;
};

export default function ProgressBar({ current, target }: ProgressBarProps) {
  const percentage = Math.min(100, Math.round((current / target) * 100));

  return (
    <section class="progress-card" aria-labelledby="progress-title">
      <div class="progress-copy">
        <p class="eyebrow">Road to 1k</p>
        <h1 id="progress-title">{current.toLocaleString()} / {target.toLocaleString()} unique beers</h1>
        <p class="lede">
          A tiny Astro + Preact site tracking the journey to 1,000 Untappd check-ins.
        </p>
      </div>

      <div class="progress-meta" aria-label={`${percentage}% complete`}>
        <span>{percentage}% complete</span>
        <span>{(target - current).toLocaleString()} to go</span>
      </div>

      <div class="bar-shell" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={current}>
        <div class="bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </section>
  );
}
