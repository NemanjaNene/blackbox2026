export function initPixelTransition(container, {
  gridSize = 7,
  pixelColor = '#ffffff',
  animationStepDuration = 0.3,
  once = false,
  aspectRatio = '100%'
} = {}) {
  if (!container) return;

  const isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;

  container.classList.add('pixelated-image-card');
  container.setAttribute('tabindex', '0');

  const spacer = document.createElement('div');
  spacer.style.paddingTop = aspectRatio;

  const defaultLayer = container.querySelector('.pt-default');
  const activeLayer = container.querySelector('.pt-active');

  if (defaultLayer) defaultLayer.classList.add('pixelated-image-card__default');
  if (activeLayer) {
    activeLayer.classList.add('pixelated-image-card__active');
    activeLayer.style.display = 'none';
  }

  const pixelGrid = document.createElement('div');
  pixelGrid.className = 'pixelated-image-card__pixels';

  container.prepend(spacer);
  container.appendChild(pixelGrid);

  const cellSize = 100 / gridSize;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const pixel = document.createElement('div');
      pixel.className = 'pixelated-image-card__pixel';
      pixel.style.backgroundColor = pixelColor;
      pixel.style.width = cellSize + '%';
      pixel.style.height = cellSize + '%';
      pixel.style.left = (col * cellSize) + '%';
      pixel.style.top = (row * cellSize) + '%';
      pixelGrid.appendChild(pixel);
    }
  }

  let isActive = false;
  let delayedCall = null;

  function animatePixels(activate) {
    isActive = activate;
    const pixels = pixelGrid.querySelectorAll('.pixelated-image-card__pixel');
    if (!pixels.length) return;

    gsap.killTweensOf(pixels);
    if (delayedCall) delayedCall.kill();

    gsap.set(pixels, { display: 'none' });

    const stagger = animationStepDuration / pixels.length;

    gsap.to(pixels, {
      display: 'block',
      duration: 0,
      stagger: { each: stagger, from: 'random' }
    });

    delayedCall = gsap.delayedCall(animationStepDuration, () => {
      if (activeLayer) {
        activeLayer.style.display = activate ? 'block' : 'none';
        activeLayer.style.pointerEvents = activate ? 'none' : '';
      }
    });

    gsap.to(pixels, {
      display: 'none',
      duration: 0,
      delay: animationStepDuration,
      stagger: { each: stagger, from: 'random' }
    });
  }

  function handleEnter() { if (!isActive) animatePixels(true); }
  function handleLeave() { if (isActive && !once) animatePixels(false); }
  function handleClick() {
    if (!isActive) animatePixels(true);
    else if (!once) animatePixels(false);
  }

  if (!isTouchDevice) {
    container.addEventListener('mouseenter', handleEnter);
    container.addEventListener('mouseleave', handleLeave);
    container.addEventListener('focus', handleEnter);
    container.addEventListener('blur', handleLeave);
  } else {
    container.addEventListener('click', handleClick);
  }
}
