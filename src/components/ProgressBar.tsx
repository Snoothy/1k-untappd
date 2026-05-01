type ProgressBarProps = {
  current: number;
  target: number;
};

export default function ProgressBar({ current, target }: ProgressBarProps) {
  const percentage = Math.min(100, Math.round((current / target) * 100));

  return (
    <section className="progress-card" aria-labelledby="progress-title">
      <div className="progress-copy">
        <p className="eyebrow">Road to 1k</p>
        <h1 id="progress-title">
          {current.toLocaleString()} / {target.toLocaleString()} unique beers
        </h1>
        <p className="lede">
          A tiny Astro + Preact site tracking the journey to 1,000 Untappd check-ins.
        </p>
      </div>

      <div className="progress-meta" aria-label={`${percentage}% complete`}>
        <span>{percentage}% complete</span>
        <span>{(target - current).toLocaleString()} to go</span>
      </div>

      <div
        className="bar-shell"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={current}
      >
        <div className="bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </section>
  );
}
