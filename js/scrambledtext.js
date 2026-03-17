export function initScrambledText(container, {
  radius = 100,
  duration = 1.2,
  speed = 0.5,
  scrambleChars = '.:'
} = {}) {
  if (!container) return;

  const p = container.querySelector('p');
  if (!p) return;

  const text = p.textContent;
  p.innerHTML = '';

  const chars = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ') {
      const space = document.createTextNode(' ');
      p.appendChild(space);
      continue;
    }
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch;
    span.dataset.content = ch;
    p.appendChild(span);
    chars.push(span);
  }

  const scrambleChar = () => scrambleChars[Math.floor(Math.random() * scrambleChars.length)];

  function scrambleElement(el, dist) {
    const original = el.dataset.content;
    const totalDuration = duration * (1 - dist / radius) * 1000;
    const steps = Math.max(3, Math.floor(totalDuration / (50 / speed)));
    const stepTime = totalDuration / steps;
    let step = 0;

    if (el._scrambleTimer) clearInterval(el._scrambleTimer);

    el._scrambleTimer = setInterval(() => {
      step++;
      if (step >= steps) {
        el.textContent = original;
        clearInterval(el._scrambleTimer);
        el._scrambleTimer = null;
        return;
      }
      el.textContent = scrambleChar();
    }, stepTime);
  }

  function onMove(e) {
    for (const c of chars) {
      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist < radius && !c._scrambleTimer) {
        scrambleElement(c, dist);
      }
    }
  }

  container.addEventListener('pointermove', onMove);

  return () => {
    container.removeEventListener('pointermove', onMove);
    chars.forEach(c => { if (c._scrambleTimer) clearInterval(c._scrambleTimer); });
  };
}
