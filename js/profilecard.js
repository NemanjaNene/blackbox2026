const ANIM = {
  INITIAL_DURATION: 1200,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
  ENTER_MS: 180,
  DEFAULT_TAU: 0.14,
  INITIAL_TAU: 0.6
};

const clamp = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const round = (v, p = 3) => parseFloat(v.toFixed(p));
const adjust = (v, fMin, fMax, tMin, tMax) => round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));

function createTiltEngine(shellEl, wrapEl) {
  let rafId = null, running = false, lastTs = 0;
  let cx = 0, cy = 0, tx = 0, ty = 0, initialUntil = 0;

  function setVars(x, y) {
    if (!shellEl || !wrapEl) return;
    const w = shellEl.clientWidth || 1;
    const h = shellEl.clientHeight || 1;
    const px = clamp((100 / w) * x);
    const py = clamp((100 / h) * y);
    const cxp = px - 50, cyp = py - 50;

    const props = {
      '--pointer-x': `${px}%`,
      '--pointer-y': `${py}%`,
      '--background-x': `${adjust(px, 0, 100, 35, 65)}%`,
      '--background-y': `${adjust(py, 0, 100, 35, 65)}%`,
      '--pointer-from-center': `${clamp(Math.hypot(py - 50, px - 50) / 50, 0, 1)}`,
      '--pointer-from-top': `${py / 100}`,
      '--pointer-from-left': `${px / 100}`,
      '--rotate-x': `${round(-(cxp / 5))}deg`,
      '--rotate-y': `${round(cyp / 4)}deg`
    };
    for (const [k, v] of Object.entries(props)) wrapEl.style.setProperty(k, v);
  }

  function step(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    const tau = ts < initialUntil ? ANIM.INITIAL_TAU : ANIM.DEFAULT_TAU;
    const k = 1 - Math.exp(-dt / tau);
    cx += (tx - cx) * k;
    cy += (ty - cy) * k;
    setVars(cx, cy);
    if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05 || document.hasFocus()) {
      rafId = requestAnimationFrame(step);
    } else { running = false; lastTs = 0; }
  }

  function start() { if (running) return; running = true; lastTs = 0; rafId = requestAnimationFrame(step); }

  return {
    setImmediate(x, y) { cx = x; cy = y; setVars(cx, cy); },
    setTarget(x, y) { tx = x; ty = y; start(); },
    toCenter() { if (shellEl) this.setTarget(shellEl.clientWidth / 2, shellEl.clientHeight / 2); },
    beginInitial(ms) { initialUntil = performance.now() + ms; start(); },
    getCurrent() { return { x: cx, y: cy, tx, ty }; },
    cancel() { if (rafId) cancelAnimationFrame(rafId); rafId = null; running = false; lastTs = 0; }
  };
}

export function initProfileCard(container, {
  avatarUrl = '',
  iconUrl = '',
  grainUrl = '',
  innerGradient = 'linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)',
  behindGlowEnabled = true,
  behindGlowColor = 'rgba(125, 190, 255, 0.67)',
  behindGlowSize = '50%',
  enableTilt = true,
  name = '',
  title = '',
  handle = '',
  status = 'Online',
  contactText = 'Contact',
  showUserInfo = false,
  onContactClick = null,
  miniAvatarUrl = ''
} = {}) {
  if (!container) return;

  container.style.setProperty('--icon', iconUrl ? `url(${iconUrl})` : 'none');
  container.style.setProperty('--grain', grainUrl ? `url(${grainUrl})` : 'none');
  container.style.setProperty('--inner-gradient', innerGradient);
  container.style.setProperty('--behind-glow-color', behindGlowColor);
  container.style.setProperty('--behind-glow-size', behindGlowSize);

  let html = '';
  if (behindGlowEnabled) html += '<div class="pc-behind"></div>';
  html += `<div class="pc-card-shell"><section class="pc-card"><div class="pc-inside">
    <div class="pc-shine"></div><div class="pc-glare"></div>
    <div class="pc-content pc-avatar-content">
      <img class="avatar" src="${avatarUrl}" alt="${name} avatar" loading="lazy">
      ${showUserInfo ? `<div class="pc-user-info"><div class="pc-user-details">
        <div class="pc-mini-avatar"><img src="${miniAvatarUrl || avatarUrl}" alt="${name} mini" loading="lazy"></div>
        <div class="pc-user-text"><div class="pc-handle">@${handle}</div><div class="pc-status">${status}</div></div>
      </div><button class="pc-contact-btn" type="button">${contactText}</button></div>` : ''}
    </div>
    <div class="pc-content"><div class="pc-details"><h3>${name}</h3><p>${title}</p></div></div>
  </div></section></div>`;
  container.innerHTML = html;

  if (showUserInfo && onContactClick) {
    const btn = container.querySelector('.pc-contact-btn');
    if (btn) btn.addEventListener('click', onContactClick);
  }

  const shell = container.querySelector('.pc-card-shell');
  if (!enableTilt || !shell) return;

  const engine = createTiltEngine(shell, container);
  let enterTimer = null, leaveRaf = null;

  const offsets = (e) => { const r = shell.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  shell.addEventListener('pointerenter', (e) => {
    shell.classList.add('active', 'entering');
    if (enterTimer) clearTimeout(enterTimer);
    enterTimer = setTimeout(() => shell.classList.remove('entering'), ANIM.ENTER_MS);
    const { x, y } = offsets(e);
    engine.setTarget(x, y);
  });

  shell.addEventListener('pointermove', (e) => {
    const { x, y } = offsets(e);
    engine.setTarget(x, y);
  });

  shell.addEventListener('pointerleave', () => {
    engine.toCenter();
    const check = () => {
      const { x, y, tx, ty } = engine.getCurrent();
      if (Math.hypot(tx - x, ty - y) < 0.6) { shell.classList.remove('active'); leaveRaf = null; }
      else leaveRaf = requestAnimationFrame(check);
    };
    if (leaveRaf) cancelAnimationFrame(leaveRaf);
    leaveRaf = requestAnimationFrame(check);
  });

  const ix = (shell.clientWidth || 0) - ANIM.INITIAL_X_OFFSET;
  const iy = ANIM.INITIAL_Y_OFFSET;
  engine.setImmediate(ix, iy);
  engine.toCenter();
  engine.beginInitial(ANIM.INITIAL_DURATION);

  return () => engine.cancel();
}
