export function initTextType(container, {
  texts = [],
  typingSpeed = 75,
  deletingSpeed = 50,
  pauseDuration = 1500,
  initialDelay = 0,
  loop = true,
  showCursor = true,
  cursorCharacter = '_',
  cursorBlinkDuration = 0.5
} = {}) {
  if (!container || !texts.length) return;

  const contentEl = document.createElement('span');
  contentEl.className = 'text-type__content';
  container.appendChild(contentEl);

  if (showCursor) {
    const cursorEl = document.createElement('span');
    cursorEl.className = 'text-type__cursor';
    cursorEl.textContent = cursorCharacter;
    container.appendChild(cursorEl);
    gsap.to(cursorEl, { opacity: 0, duration: cursorBlinkDuration, repeat: -1, yoyo: true, ease: 'power2.inOut' });
  }

  let textIndex = 0;
  let charIndex = 0;
  let deleting = false;
  let displayed = '';

  const type = () => {
    const current = texts[textIndex];

    if (!deleting) {
      if (charIndex < current.length) {
        displayed += current[charIndex];
        contentEl.textContent = displayed;
        charIndex++;
        setTimeout(type, typingSpeed);
      } else {
        if (!loop && textIndex === texts.length - 1) return;
        setTimeout(() => { deleting = true; type(); }, pauseDuration);
      }
    } else {
      if (displayed.length > 0) {
        displayed = displayed.slice(0, -1);
        contentEl.textContent = displayed;
        setTimeout(type, deletingSpeed);
      } else {
        deleting = false;
        textIndex = (textIndex + 1) % texts.length;
        charIndex = 0;
        setTimeout(type, typingSpeed);
      }
    }
  };

  setTimeout(type, initialDelay);
}
