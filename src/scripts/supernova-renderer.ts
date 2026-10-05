export interface SupernovaFrame {
  time: number;
  finale: number | null;
  flare: number | null;
}

export function createSupernovaRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const ctx: CanvasRenderingContext2D = context;
  const TAU = Math.PI * 2;
  const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (a: number, b: number, x: number) => {
    const v = clamp((x - a) / (b - a));
    return v * v * (3 - 2 * v);
  };
  const mod = (x: number, n = 1) => ((x % n) + n) % n;
  let seed = 79811;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const stars = Array.from({ length: 420 }, () => ({
    x: rand(),
    y: rand(),
    r: 0.25 + rand() * 1.25,
    p: rand() * TAU,
    s: rand(),
  }));
  const orbitals = Array.from({ length: 720 }, () => ({
    a: rand() * TAU,
    r: 1.23 + rand() * 1.3,
    p: rand() * TAU,
    v: 0.5 + rand(),
    s: 0.25 + rand() * 1.8,
    band: rand(),
  }));
  const sparks = Array.from({ length: 290 }, () => ({
    a: rand() * TAU,
    z: rand(),
    p: rand() * TAU,
    v: 0.4 + rand() * 1.3,
  }));
  const debris = Array.from({ length: 360 }, () => ({
    a: rand() * TAU,
    v: 0.25 + rand() * 1.6,
    p: rand() * TAU,
    s: 0.25 + rand() * 1.7,
    drag: 0.13 + rand() * 0.18,
  }));
  let w = 0,
    h = 0;
  function resize(
    width: number,
    height: number,
    pixelRatio = window.devicePixelRatio || 1,
  ) {
    if (width <= 0 || height <= 0) return;
    w = width;
    h = height;
    const dpr = Math.min(pixelRatio, 1.5, 2240 / w);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function glow(x: number, y: number, r: number, color: string, alpha = 1) {
    if (r <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  function line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 1,
  ) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function arc(
    cx: number,
    cy: number,
    r: number,
    start: number,
    end: number,
    color: string,
    width = 1,
  ) {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.01, r), start, end);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function lens(x: number, y: number, scale: number, power = 1) {
    glow(x, y, scale * 1.5, "#f99422", 0.35 * power);
    glow(x, y, scale * 0.48, "#ffd46a", 0.83 * power);
    glow(x, y, scale * 0.14, "#fffae7", power);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.018);
    glow(0, 0, scale * 3.8, "#ffdfad", 0.72 * power);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.045, 1);
    glow(0, 0, scale * 0.85, "#fff0cb", 0.34 * power);
    ctx.restore();
  }
  function orbitPoint(a: number, r: number, cx: number, cy: number) {
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r * 0.255;
    const tilt = -0.27;
    return [
      cx + x * Math.cos(tilt) - y * Math.sin(tilt),
      cy + x * Math.sin(tilt) + y * Math.cos(tilt),
    ];
  }
  function ringParticles(
    t: number,
    cx: number,
    cy: number,
    r: number,
    front: boolean,
  ) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const p of orbitals) {
      const a = p.a + t * (0.105 + p.v * 0.035);
      if (Math.sin(a) > 0 !== front) continue;
      const rr = r * (p.r + 0.025 * Math.sin(t * 0.7 + p.p)),
        q = orbitPoint(a, rr, cx, cy),
        back = orbitPoint(a - 0.008 - p.s * 0.002, rr, cx, cy);
      const al =
        (front ? 0.6 : 0.32) * (0.6 + 0.4 * Math.sin(p.p + t * 0.55) ** 2);
      const cool = p.band > 0.91;
      line(
        back[0],
        back[1],
        q[0],
        q[1],
        cool
          ? `rgba(109,224,255,${al * 0.75})`
          : `rgba(255,${176 + p.s * 31},${75 + p.s * 45},${al})`,
        Math.max(0.4, p.s * 0.65),
      );
    }
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      const start = front ? 0 : Math.PI,
        end = front ? Math.PI : TAU,
        rr = r * (1.34 + k * 0.17);
      for (let n = 0; n <= 90; n++) {
        const a = start + ((end - start) * n) / 90;
        const q = orbitPoint(a, rr, cx, cy);
        if (!n) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      }
      ctx.strokeStyle = front ? "#ffc36530" : "#ffd58220";
      ctx.lineWidth = 0.7;
      ctx.stroke();
      const a = t * (0.21 + k * 0.034) + k * 1.19;
      if (Math.sin(a) > 0 === front) {
        const q = orbitPoint(a, rr, cx, cy);
        lens(q[0], q[1], r * (k === 0 ? 0.16 : 0.055), k === 0 ? 0.8 : 0.55);
      }
    }
    ctx.restore();
  }
  function shockwave(
    age: number,
    cx: number,
    cy: number,
    r: number,
    power = 1,
  ) {
    if (age < 0 || age > 8) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const fade = Math.exp(-age * 0.55),
      radius = r * 0.94 + age * w * 0.26;
    const gradient = ctx.createRadialGradient(
      cx,
      cy,
      Math.max(0, radius - r * 0.11),
      cx,
      cy,
      radius + r * 0.1,
    );
    gradient.addColorStop(0, "#ffd27c00");
    gradient.addColorStop(0.46, `rgba(255,185,58,${fade * 0.1 * power})`);
    gradient.addColorStop(0.54, `rgba(255,238,187,${fade * 0.22 * power})`);
    gradient.addColorStop(1, "#ffd27c00");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    arc(
      cx,
      cy,
      radius,
      0,
      TAU,
      `rgba(255,225,159,${fade * 0.75 * power})`,
      1.2,
    );
    glow(cx, cy, w * 0.75, "#ffb23b", fade * 0.11 * power);
    ctx.restore();
  }
  function celebration(age: number, cx: number, cy: number, r: number) {
    if (age < 0 || age > 17) return;
    shockwave(age, cx, cy, r, 1);
    shockwave(age - 0.75, cx, cy, r, 0.7);
    shockwave(age - 1.65, cx, cy, r, 0.4);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const p of debris) {
      const distance = r + (1 - Math.exp(-age * p.drag)) * w * p.v * 0.6;
      const x = cx + Math.cos(p.a) * distance,
        y = cy + Math.sin(p.a) * distance + age * age * 0.55;
      const tail = (3 + age * 5) * Math.exp(-age * 0.045);
      const alpha = clamp(1 - age / 17) * (0.45 + p.s * 0.24);
      line(
        x,
        y,
        x - Math.cos(p.a) * tail,
        y - Math.sin(p.a) * tail,
        `rgba(255,${190 + p.s * 31},${92 + p.s * 59},${alpha})`,
        0.55 + p.s * 0.6,
      );
    }
    for (let k = 0; k < 3; k++) {
      const a = age - 1.1 - k * 1.35;
      if (a < 0 || a > 5) continue;
      const x = w * [0.16, 0.87, 0.39][k],
        y = h * [0.24, 0.24, 0.15][k];
      const spread = Math.pow(a, 0.7) * r * 0.53,
        fade = Math.exp(-a * 0.62);
      for (let j = 0; j < 38; j++) {
        const ang = (j / 38) * TAU + k;
        const xx = x + Math.cos(ang) * spread,
          yy = y + Math.sin(ang) * spread + a * a * 4;
        line(
          xx,
          yy,
          xx - Math.cos(ang) * 9,
          yy - Math.sin(ang) * 9,
          `rgba(255,215,128,${fade * 0.8})`,
          0.7,
        );
      }
      glow(x, y, r * 0.42, "#ffd378", Math.exp(-a * 3) * 0.36);
    }
    ctx.restore();
  }
  function draw(state: SupernovaFrame) {
    if (!w || !h) return;
    const t = state.time,
      small = w < 600,
      cx = w * (small ? 0.5 : 0.695),
      cy = h * (small ? 0.565 : 0.465),
      base = Math.min(w * 0.207, h * 0.333);
    const build =
      state.finale === null
        ? 0
        : smooth(4.5, 8.5, state.finale) * (1 - smooth(8.5, 9, state.finale));
    const hit =
      state.finale !== null && state.finale >= 8.5
        ? Math.exp(-(state.finale - 8.5) * 0.85)
        : 0;
    const wave = 0.5 + 0.5 * Math.sin(t * 0.64),
      rise = smooth(4, 14, t % 20) * (1 - smooth(15, 20, t % 20));
    const energy = 0.9 + wave * 0.17 + rise * 0.25 + hit * 0.7 + build * 0.4;
    const r =
      base * (1 + Math.sin(t * 0.64) * 0.006 - build * 0.11 + hit * 0.065);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05080d";
    ctx.fillRect(0, 0, w, h);
    glow(w * 0.22, h * 0.45, w * 0.54, "#15344a", 0.33);
    glow(cx, cy, r * 2.85, "#963b12", 0.23 * energy);
    glow(w * 0.92, h * 0.35, w * 0.39, "#235574", 0.21);
    for (const p of stars) {
      const alpha = 0.16 + 0.45 * Math.sin(t * 0.3 + p.p) ** 2;
      ctx.fillStyle =
        p.s > 0.8 ? `rgba(144,218,241,${alpha})` : `rgba(255,225,168,${alpha})`;
      ctx.fillRect(p.x * w, p.y * h, p.r, p.r);
    }
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * TAU + t * 0.025,
        rr = r * (1.15 + 0.3 * Math.sin(k * 2.113 + t * 0.15));
      ctx.save();
      ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      ctx.rotate(a + Math.PI / 2);
      ctx.scale(1, 0.23);
      glow(
        0,
        0,
        r * (0.6 + 0.18 * Math.sin(k * 4.27)),
        k % 6 === 0 ? "#69a6b3" : "#dd6b1d",
        0.075 * energy,
      );
      ctx.restore();
    }
    for (let k = 0; k < 65; k++) {
      const a = (k / 65) * TAU + t * 0.018,
        q = 0.5 + 0.5 * Math.sin(k * 31.18),
        end = r * (1.55 + q * 1.1),
        spread = 0.003 + q * 0.022;
      const grad = ctx.createRadialGradient(cx, cy, r * 0.94, cx, cy, end);
      grad.addColorStop(0, `rgba(255,187,64,${(0.1 + q * 0.1) * energy})`);
      grad.addColorStop(0.48, "#d7681810");
      grad.addColorStop(1, "#ffe5a600");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - spread) * r, cy + Math.sin(a - spread) * r);
      ctx.lineTo(
        cx + Math.cos(a - spread) * end,
        cy + Math.sin(a - spread) * end,
      );
      ctx.lineTo(
        cx + Math.cos(a + spread) * end,
        cy + Math.sin(a + spread) * end,
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ringParticles(t, cx, cy, r, false);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = "#ff9b26";
    ctx.shadowBlur = r * 0.085;
    arc(
      cx,
      cy,
      r * 1.022,
      0,
      TAU,
      `rgba(255,162,37,${0.34 * energy})`,
      r * 0.035,
    );
    ctx.shadowBlur = 0;
    for (let layer = 0; layer < 28; layer++) {
      ctx.beginPath();
      for (let i = 0; i <= 280; i++) {
        const a = (i / 280) * TAU;
        const noise =
          Math.sin(a * 6 + t * 0.52 + layer * 0.1) * 0.014 +
          Math.sin(a * 17 - t * 0.7 + layer * 0.25) * 0.008 +
          Math.sin(a * 39 + t * 0.4 + layer * 0.44) * 0.004;
        const rr = r * (0.998 + layer * 0.0027 + noise);
        const x = cx + Math.cos(a) * rr,
          y = cy + Math.sin(a) * rr;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,${181 + layer * 2.2},${68 + layer * 4.5},${(0.09 + 0.09 * Math.sin((layer / 28) * Math.PI)) * energy})`;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    for (let j = 0; j < 38; j++) {
      const a = (j / 38) * TAU + t * 0.065,
        q = 0.5 + 0.5 * Math.sin(j * 15.723 + t * 0.35),
        span = 0.055 + q * 0.12,
        rr = r * (1.016 + q * 0.031),
        lift = r * (0.025 + q * 0.12) * (1 + rise * 0.5 + build * 0.3);
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const v = k / 20,
          aa = a + span * v,
          rad =
            rr +
            Math.sin(v * Math.PI) * lift +
            Math.sin(v * TAU * 2 + t + j) * r * 0.004;
        const x = cx + Math.cos(aa) * rad,
          y = cy + Math.sin(aa) * rad;
        if (!k) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,181,68,${0.35 * energy})`;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,238,184,${(0.23 + q * 0.53) * energy})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
    const core = ctx.createRadialGradient(
      cx - r * 0.15,
      cy - r * 0.2,
      0,
      cx,
      cy,
      r * 0.988,
    );
    core.addColorStop(0, "#070e18");
    core.addColorStop(0.77, "#080d14");
    core.addColorStop(0.96, "#30200e");
    core.addColorStop(1, "#eab45f");
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.985, 0, TAU);
    ctx.fillStyle = core;
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    arc(cx, cy, r * 0.994, 0, TAU, "#fff1cfbb", 1.05);
    arc(cx, cy, r * 1.14, -2.9 + t * 0.06, -1.85 + t * 0.06, "#b9e6ed66", 0.75);
    const sweep = t * 0.21;
    ctx.shadowColor = "#ffaf30";
    ctx.shadowBlur = r * 0.055;
    arc(cx, cy, r * 1.027, sweep, sweep + 0.63, "#ffd879a6", 2);
    ctx.shadowBlur = 0;
    arc(cx, cy, r * 1.027, sweep + 0.08, sweep + 0.6, "#fff9dfa6", 0.85);
    ctx.restore();
    ringParticles(t, cx, cy, r, true);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const hot = -0.55 + t * 0.072,
      hotX = cx + Math.cos(hot) * r * 1.028,
      hotY = cy + Math.sin(hot) * r * 1.028;
    lens(hotX, hotY, r * 0.34, 1);
    const second = hot + Math.PI * 1.14;
    lens(
      cx + Math.cos(second) * r * 1.022,
      cy + Math.sin(second) * r * 1.022,
      r * 0.15,
      0.85,
    );
    for (const p of sparks) {
      const z = mod(p.z + t * (0.022 + p.v * 0.012));
      const direction = p.a + t * 0.012;
      const rr = r * (1.05 + z * z * 2.4);
      const angle = direction + z * 0.26;
      const x = cx + Math.cos(angle) * rr,
        y = cy + Math.sin(angle) * rr;
      const tail = r * (0.008 + z * 0.04) * p.v;
      const alpha = Math.sin(z * Math.PI) * (0.2 + p.v * 0.25);
      line(
        x,
        y,
        x - Math.cos(angle) * tail,
        y - Math.sin(angle) * tail,
        `rgba(255,${181 + p.v * 28},${91 + p.v * 44},${alpha})`,
        0.55 + p.v * 0.4,
      );
    }
    for (let k = 0; k < 4; k++) {
      const phase = mod(t * 0.115 + k * 0.23);
      const angle = -1.2 + k * 1.65 + phase * 0.48;
      const rr = r * (1.04 + phase * 1.2);
      const envelope = Math.sin(phase * Math.PI) ** 6;
      const x = cx + Math.cos(angle) * rr,
        y = cy + Math.sin(angle) * rr;
      if (envelope > 0.02) {
        line(
          x,
          y,
          cx + Math.cos(angle - 0.08) * rr * 0.93,
          cy + Math.sin(angle - 0.08) * rr * 0.93,
          `rgba(255,225,163,${envelope * 0.8})`,
          1.2,
        );
        lens(x, y, r * 0.12, envelope * 0.8);
      }
    }
    if (build > 0) {
      for (let k = 0; k < 70; k++) {
        const a = (k / 70) * TAU + t * 0.02,
          q = mod(k * 0.31 - t * 0.8),
          rr = r * (1.08 + q * 2);
        line(
          cx + Math.cos(a) * rr,
          cy + Math.sin(a) * rr,
          cx + Math.cos(a) * (rr + r * 0.11),
          cy + Math.sin(a) * (rr + r * 0.11),
          `rgba(255,228,164,${build * (1 - q) * 0.6})`,
          0.8,
        );
      }
    }
    ctx.save();
    ctx.translate(cx, h * 0.77);
    ctx.scale(1, 0.018);
    glow(0, 0, w * 0.59, "#efad51", 0.5 + rise * 0.18);
    ctx.restore();
    ctx.restore();
    const ambientPulse = mod(t + 2, 12);
    if (ambientPulse < 3.6 && state.finale === null)
      shockwave(ambientPulse, cx, cy, r, 0.25);
    if (state.flare !== null) shockwave(state.flare, cx, cy, r, 0.8);
    if (state.finale !== null && state.finale >= 8.5)
      celebration(state.finale - 8.5, cx, cy, r);
  }
  return { resize, draw };
}
