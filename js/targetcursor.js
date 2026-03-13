export function initTargetCursor({
  targetSelector = '.cursor-target',
  spinDuration = 2,
  hideDefaultCursor = true,
  hoverDuration = 0.2,
  parallaxOn = true
} = {}) {
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  const ua = (navigator.userAgent || navigator.vendor || window.opera).toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  if ((hasTouchScreen && isSmallScreen) || isMobileUA) return;

  const BORDER_W = 3;
  const CORNER_SZ = 12;

  const wrapper = document.createElement('div');
  wrapper.className = 'target-cursor-wrapper';
  wrapper.innerHTML = `
    <div class="target-cursor-dot"></div>
    <div class="target-cursor-corner corner-tl"></div>
    <div class="target-cursor-corner corner-tr"></div>
    <div class="target-cursor-corner corner-br"></div>
    <div class="target-cursor-corner corner-bl"></div>`;
  document.body.appendChild(wrapper);

  const dot = wrapper.querySelector('.target-cursor-dot');
  const corners = Array.from(wrapper.querySelectorAll('.target-cursor-corner'));

  const originalCursor = document.body.style.cursor;
  if (hideDefaultCursor) document.body.style.cursor = 'none';

  gsap.set(wrapper, { xPercent: -50, yPercent: -50, x: window.innerWidth / 2, y: window.innerHeight / 2 });

  let spinTl = gsap.timeline({ repeat: -1 })
    .to(wrapper, { rotation: '+=360', duration: spinDuration, ease: 'none' });

  let activeTarget = null;
  let currentLeaveHandler = null;
  let resumeTimeout = null;
  let targetCornerPositions = null;
  let activeStrength = { current: 0 };
  let tickerAdded = false;

  const tickerFn = () => {
    if (!targetCornerPositions || activeStrength.current === 0) return;
    const cx = gsap.getProperty(wrapper, 'x');
    const cy = gsap.getProperty(wrapper, 'y');
    corners.forEach((corner, i) => {
      const curX = gsap.getProperty(corner, 'x');
      const curY = gsap.getProperty(corner, 'y');
      const tx = targetCornerPositions[i].x - cx;
      const ty = targetCornerPositions[i].y - cy;
      const fx = curX + (tx - curX) * activeStrength.current;
      const fy = curY + (ty - curY) * activeStrength.current;
      const dur = activeStrength.current >= 0.99 ? (parallaxOn ? 0.2 : 0) : 0.05;
      gsap.to(corner, { x: fx, y: fy, duration: dur, ease: dur === 0 ? 'none' : 'power1.out', overwrite: 'auto' });
    });
  };

  const cleanupTarget = (target) => {
    if (currentLeaveHandler) target.removeEventListener('mouseleave', currentLeaveHandler);
    currentLeaveHandler = null;
  };

  const resetCorners = () => {
    const positions = [
      { x: -CORNER_SZ * 1.5, y: -CORNER_SZ * 1.5 },
      { x: CORNER_SZ * 0.5, y: -CORNER_SZ * 1.5 },
      { x: CORNER_SZ * 0.5, y: CORNER_SZ * 0.5 },
      { x: -CORNER_SZ * 1.5, y: CORNER_SZ * 0.5 }
    ];
    gsap.killTweensOf(corners);
    corners.forEach((corner, i) => {
      gsap.to(corner, { x: positions[i].x, y: positions[i].y, duration: 0.3, ease: 'power3.out' });
    });
  };

  const resumeSpin = () => {
    resumeTimeout = setTimeout(() => {
      if (!activeTarget && wrapper && spinTl) {
        const rot = gsap.getProperty(wrapper, 'rotation') % 360;
        spinTl.kill();
        spinTl = gsap.timeline({ repeat: -1 }).to(wrapper, { rotation: '+=360', duration: spinDuration, ease: 'none' });
        gsap.to(wrapper, {
          rotation: rot + 360,
          duration: spinDuration * (1 - rot / 360),
          ease: 'none',
          onComplete: () => spinTl?.restart()
        });
      }
      resumeTimeout = null;
    }, 50);
  };

  window.addEventListener('mousemove', (e) => {
    gsap.to(wrapper, { x: e.clientX, y: e.clientY, duration: 0.1, ease: 'power3.out' });
  });

  window.addEventListener('mousedown', () => {
    gsap.to(dot, { scale: 0.7, duration: 0.3 });
    gsap.to(wrapper, { scale: 0.9, duration: 0.2 });
  });

  window.addEventListener('mouseup', () => {
    gsap.to(dot, { scale: 1, duration: 0.3 });
    gsap.to(wrapper, { scale: 1, duration: 0.2 });
  });

  window.addEventListener('scroll', () => {
    if (!activeTarget) return;
    const mx = gsap.getProperty(wrapper, 'x');
    const my = gsap.getProperty(wrapper, 'y');
    const el = document.elementFromPoint(mx, my);
    const still = el && (el === activeTarget || el.closest(targetSelector) === activeTarget);
    if (!still && currentLeaveHandler) currentLeaveHandler();
  }, { passive: true });

  window.addEventListener('mouseover', (e) => {
    let target = e.target;
    let found = null;
    while (target && target !== document.body) {
      if (target.matches(targetSelector)) { found = target; break; }
      target = target.parentElement;
    }
    if (!found) return;
    if (activeTarget === found) return;
    if (activeTarget) cleanupTarget(activeTarget);
    if (resumeTimeout) { clearTimeout(resumeTimeout); resumeTimeout = null; }

    activeTarget = found;
    gsap.killTweensOf(corners);
    gsap.killTweensOf(wrapper, 'rotation');
    spinTl?.pause();
    gsap.set(wrapper, { rotation: 0 });

    const rect = found.getBoundingClientRect();
    const cx = gsap.getProperty(wrapper, 'x');
    const cy = gsap.getProperty(wrapper, 'y');

    targetCornerPositions = [
      { x: rect.left - BORDER_W, y: rect.top - BORDER_W },
      { x: rect.right + BORDER_W - CORNER_SZ, y: rect.top - BORDER_W },
      { x: rect.right + BORDER_W - CORNER_SZ, y: rect.bottom + BORDER_W - CORNER_SZ },
      { x: rect.left - BORDER_W, y: rect.bottom + BORDER_W - CORNER_SZ }
    ];

    if (!tickerAdded) { gsap.ticker.add(tickerFn); tickerAdded = true; }
    gsap.to(activeStrength, { current: 1, duration: hoverDuration, ease: 'power2.out' });

    corners.forEach((corner, i) => {
      gsap.to(corner, {
        x: targetCornerPositions[i].x - cx,
        y: targetCornerPositions[i].y - cy,
        duration: 0.2,
        ease: 'power2.out'
      });
    });

    const leaveHandler = () => {
      if (tickerAdded) { gsap.ticker.remove(tickerFn); tickerAdded = false; }
      targetCornerPositions = null;
      gsap.set(activeStrength, { current: 0, overwrite: true });
      activeTarget = null;
      resetCorners();
      resumeSpin();
      cleanupTarget(found);
    };

    currentLeaveHandler = leaveHandler;
    found.addEventListener('mouseleave', leaveHandler);
  }, { passive: true });
}
