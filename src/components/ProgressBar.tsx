type ProgressBarProps = {
  username: string;
  displayName: string;
  avatarUrl?: string;
  current: number;
  target: number;
  source?: string;
  updatedAt?: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part.at(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ProgressBar({
  username,
  displayName,
  avatarUrl,
  current,
  target,
  source = 'fallback',
  updatedAt,
}: ProgressBarProps) {
  const safeTarget = Math.max(target, 1);
  const percentage = Math.min(100, Math.round((current / safeTarget) * 100));
  const remaining = Math.max(target - current, 0);
  const isLive = source === 'untappd';

  return (
    <section className="progress-card" aria-labelledby="progress-title">
      <header className="profile-header">
        <div className="avatar" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initials(displayName || username)}</span>}
        </div>
        <div>
          <p className="eyebrow">Road to 1k</p>
          <p className="profile-name">{displayName}</p>
          <a className="profile-link" href={`https://untappd.com/user/${username}`}>
            @{username} on Untappd
          </a>
        </div>
      </header>

      <div className="progress-copy">
        <h1 id="progress-title">
          {current.toLocaleString()} / {target.toLocaleString()}
        </h1>
        <p className="lede">
          Tracking the journey to 1,000 unique beers with a static Astro + Preact site.
        </p>
      </div>

      <div className="stat-grid" aria-label="Progress summary">
        <div>
          <span className="stat-value">{percentage}%</span>
          <span className="stat-label">complete</span>
        </div>
        <div>
          <span className="stat-value">{remaining.toLocaleString()}</span>
          <span className="stat-label">to go</span>
        </div>
        <div>
          <span className="stat-value">{isLive ? 'Live' : 'Demo'}</span>
          <span className="stat-label">data source</span>
        </div>
      </div>

      <div className="bar-shell" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={current}>
        <div className="bar-fill" style={{ width: `${percentage}%` }} />
      </div>

      <footer className="card-footer">
        {updatedAt ? <span>Updated {new Date(updatedAt).toLocaleDateString('en-GB')}</span> : <span>Updated automatically</span>}
        <span>{isLive ? 'Powered by Untappd' : 'Using fallback data'}</span>
      </footer>
    </section>
  );
}
