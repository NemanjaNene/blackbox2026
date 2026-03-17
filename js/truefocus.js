export function initTrueFocus(container, {
  sentence = '',
  manualMode = false,
  blurAmount = 5,
  borderColor = '#60a5fa',
  glowColor = 'rgba(96, 165, 250, 0.6)',
  animationDuration = 0.5,
  pauseBetweenAnimations = 1
} = {}) {
  if (!container) return;

  const words = sentence.split(' ');
  let currentIndex = 0;
  let interval = null;

  container.classList.add('focus-container');
  container.innerHTML = '';

  const wordEls = words.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'focus-word';
    span.textContent = word;
    span.style.filter = i === 0 ? 'blur(0px)' : `blur(${blurAmount}px)`;
    span.style.transition = `filter ${animationDuration}s ease`;
    span.style.setProperty('--border-color', borderColor);
    span.style.setProperty('--glow-color', glowColor);

    if (manualMode) {
      span.addEventListener('mouseenter', () => setActive(i));
    }

    container.appendChild(span);
    return span;
  });

  const frame = document.createElement('div');
  frame.className = 'focus-frame';
  frame.style.setProperty('--border-color', borderColor);
  frame.style.setProperty('--glow-color', glowColor);
  frame.style.transition = `left ${animationDuration}s ease, top ${animationDuration}s ease, width ${animationDuration}s ease, height ${animationDuration}s ease, opacity ${animationDuration}s ease`;
  frame.innerHTML = '<span class="corner top-left"></span><span class="corner top-right"></span><span class="corner bottom-left"></span><span class="corner bottom-right"></span>';
  container.appendChild(frame);

  function updateFrame(idx) {
    const el = wordEls[idx];
    if (!el) return;
    const pRect = container.getBoundingClientRect();
    const wRect = el.getBoundingClientRect();
    frame.style.left = (wRect.left - pRect.left) + 'px';
    frame.style.top = (wRect.top - pRect.top) + 'px';
    frame.style.width = wRect.width + 'px';
    frame.style.height = wRect.height + 'px';
    frame.style.opacity = '1';
  }

  function setActive(idx) {
    currentIndex = idx;
    wordEls.forEach((el, i) => {
      el.style.filter = i === idx ? 'blur(0px)' : `blur(${blurAmount}px)`;
    });
    updateFrame(idx);
  }

  setActive(0);
  requestAnimationFrame(() => updateFrame(0));

  if (!manualMode) {
    interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % words.length;
      setActive(currentIndex);
    }, (animationDuration + pauseBetweenAnimations) * 1000);
  }

  const ro = new ResizeObserver(() => updateFrame(currentIndex));
  ro.observe(container);

  return () => {
    if (interval) clearInterval(interval);
    ro.disconnect();
  };
}
