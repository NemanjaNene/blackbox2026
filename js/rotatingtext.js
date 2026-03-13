export function initRotatingText(container, {
  texts = [],
  rotationInterval = 2000,
  staggerDuration = 0.025,
  staggerFrom = 'last'
} = {}) {
  if (!texts.length) return;

  let currentIndex = 0;
  container.classList.add('text-rotate');

  const splitChars = (text) => {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
      return Array.from(seg.segment(text), s => s.segment);
    }
    return Array.from(text);
  };

  const getDelay = (index, total) => {
    if (staggerFrom === 'first') return index * staggerDuration;
    if (staggerFrom === 'last') return (total - 1 - index) * staggerDuration;
    if (staggerFrom === 'center') return Math.abs(Math.floor(total / 2) - index) * staggerDuration;
    return index * staggerDuration;
  };

  const render = (text) => {
    const words = text.split(' ');
    let charCount = 0;
    words.forEach(w => { charCount += splitChars(w).length; });

    container.innerHTML = '';
    let globalIdx = 0;

    words.forEach((word, wi) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'text-rotate-word';

      const chars = splitChars(word);
      chars.forEach(ch => {
        const el = document.createElement('span');
        el.className = 'text-rotate-element';
        el.textContent = ch;
        el.style.display = 'inline-block';
        el.style.transform = 'translateY(100%)';
        el.style.opacity = '0';

        const delay = getDelay(globalIdx, charCount);
        gsap.to(el, {
          y: 0, opacity: 1,
          duration: 0.5,
          delay: delay,
          ease: 'back.out(1.7)'
        });

        wordSpan.appendChild(el);
        globalIdx++;
      });

      container.appendChild(wordSpan);

      if (wi < words.length - 1) {
        const space = document.createElement('span');
        space.className = 'text-rotate-space';
        space.innerHTML = '&nbsp;';
        container.appendChild(space);
      }
    });
  };

  const animateOut = (callback) => {
    const els = container.querySelectorAll('.text-rotate-element');
    const total = els.length;
    if (!total) { callback(); return; }

    els.forEach((el, i) => {
      const delay = getDelay(i, total);
      gsap.to(el, {
        y: '-120%', opacity: 0,
        duration: 0.4,
        delay: delay,
        ease: 'power2.in',
        onComplete: i === (staggerFrom === 'last' ? 0 : total - 1) ? callback : undefined
      });
    });
  };

  const cycle = () => {
    animateOut(() => {
      currentIndex = (currentIndex + 1) % texts.length;
      render(texts[currentIndex]);
    });
  };

  render(texts[currentIndex]);
  setInterval(cycle, rotationInterval);
}
