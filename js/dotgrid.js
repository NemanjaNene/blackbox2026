export function initDotGrid(wrapper, {
  dotSize = 4,
  gap = 18,
  baseColor = '#2a2545',
  activeColor = '#60a5fa',
  proximity = 150,
  speedTrigger = 100,
  shockRadius = 250,
  shockStrength = 5,
  maxSpeed = 5000,
  resistance = 750,
  returnDuration = 1.5
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;';
  wrapper.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let dots = [];
  let rafId = null;
  let W = 0, H = 0;

  const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, lastX: 0, lastY: 0, lastTime: 0 };

  function hexToRgb(hex) {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }

  const baseRgb = hexToRgb(baseColor);
  const activeRgb = hexToRgb(activeColor);
  const proxSq = proximity * proximity;
  const half = dotSize / 2;

  function buildGrid() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = W * dpr;
    canvas.height = H * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cell = dotSize + gap;
    const cols = Math.floor((W + gap) / cell);
    const rows = Math.floor((H + gap) / cell);
    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;
    const startX = (W - gridW) / 2 + half;
    const startY = (H - gridH) / 2 + half;

    dots = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({
          cx: startX + c * cell,
          cy: startY + r * cell,
          xOff: 0,
          yOff: 0,
          busy: false
        });
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const px = pointer.x;
    const py = pointer.y;

    for (let i = 0, len = dots.length; i < len; i++) {
      const d = dots[i];
      const dx = d.cx - px;
      const dy = d.cy - py;
      const dsq = dx * dx + dy * dy;

      if (dsq <= proxSq) {
        const dist = Math.sqrt(dsq);
        const t = 1 - dist / proximity;
        const r = (baseRgb.r + (activeRgb.r - baseRgb.r) * t) | 0;
        const g = (baseRgb.g + (activeRgb.g - baseRgb.g) * t) | 0;
        const b = (baseRgb.b + (activeRgb.b - baseRgb.b) * t) | 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = baseColor;
      }

      ctx.beginPath();
      ctx.arc(d.cx + d.xOff, d.cy + d.yOff, half, 0, 6.2832);
      ctx.fill();
    }

    rafId = requestAnimationFrame(draw);
  }

  function pushDot(dot, pushX, pushY) {
    if (dot.busy) return;
    dot.busy = true;

    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf(dot);
      const damp = resistance / 1000;
      gsap.to(dot, {
        xOff: pushX / damp,
        yOff: pushY / damp,
        duration: 0.25,
        ease: 'power2.out',
        onComplete() {
          gsap.to(dot, {
            xOff: 0, yOff: 0,
            duration: returnDuration,
            ease: 'elastic.out(1,0.75)',
            onComplete() { dot.busy = false; }
          });
        }
      });
    } else {
      dot.busy = false;
    }
  }

  let lastMove = 0;
  function onMove(e) {
    const now = performance.now();
    if (now - lastMove < 30) return;
    lastMove = now;

    const dt = pointer.lastTime ? now - pointer.lastTime : 16;
    const ddx = e.clientX - pointer.lastX;
    const ddy = e.clientY - pointer.lastY;
    let vx = (ddx / dt) * 1000;
    let vy = (ddy / dt) * 1000;
    let speed = Math.hypot(vx, vy);
    if (speed > maxSpeed) {
      const s = maxSpeed / speed;
      vx *= s; vy *= s; speed = maxSpeed;
    }

    pointer.lastTime = now;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.vx = vx;
    pointer.vy = vy;
    pointer.speed = speed;
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    if (speed > speedTrigger) {
      for (const dot of dots) {
        const dist = Math.hypot(dot.cx - pointer.x, dot.cy - pointer.y);
        if (dist < proximity && !dot.busy) {
          pushDot(dot, (dot.cx - pointer.x) + vx * 0.005, (dot.cy - pointer.y) + vy * 0.005);
        }
      }
    }
  }

  function onClick(e) {
    const cx = e.clientX;
    const cy = e.clientY;
    for (const dot of dots) {
      const dist = Math.hypot(dot.cx - cx, dot.cy - cy);
      if (dist < shockRadius && !dot.busy) {
        const falloff = Math.max(0, 1 - dist / shockRadius);
        pushDot(dot, (dot.cx - cx) * shockStrength * falloff, (dot.cy - cy) * shockStrength * falloff);
      }
    }
  }

  buildGrid();
  rafId = requestAnimationFrame(draw);

  window.addEventListener('resize', buildGrid);
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('click', onClick);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', buildGrid);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('click', onClick);
    canvas.remove();
  };
}
