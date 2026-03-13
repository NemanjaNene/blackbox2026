const makeSlot = (i, distX, distY, total) => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i
});

const placeNow = (el, slot, skew) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true
  });

export function initCardSwap(container, {
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  skewAmount = 6,
  easing = 'elastic'
} = {}) {
  const config = easing === 'elastic'
    ? { ease: 'elastic.out(0.6,0.9)', durDrop: 2, durMove: 2, durReturn: 2, promoteOverlap: 0.9, returnDelay: 0.05 }
    : { ease: 'power1.inOut', durDrop: 0.8, durMove: 0.8, durReturn: 0.8, promoteOverlap: 0.45, returnDelay: 0.2 };

  const cards = Array.from(container.querySelectorAll('.card'));
  const total = cards.length;
  if (total < 2) return;

  const order = Array.from({ length: total }, (_, i) => i);
  let currentTl = null;
  let intervalId = null;

  cards.forEach((el, i) => placeNow(el, makeSlot(i, cardDistance, verticalDistance, total), skewAmount));

  const swap = () => {
    if (order.length < 2) return;

    const front = order.shift();
    const elFront = cards[front];
    const tl = gsap.timeline();
    currentTl = tl;

    tl.to(elFront, { y: '+=500', duration: config.durDrop, ease: config.ease });

    tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`);
    order.forEach((idx, i) => {
      const el = cards[idx];
      const slot = makeSlot(i, cardDistance, verticalDistance, total);
      tl.set(el, { zIndex: slot.zIndex }, 'promote');
      tl.to(el, { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease }, `promote+=${i * 0.15}`);
    });

    const backSlot = makeSlot(total - 1, cardDistance, verticalDistance, total);
    tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`);
    tl.call(() => gsap.set(elFront, { zIndex: backSlot.zIndex }), undefined, 'return');
    tl.to(elFront, { x: backSlot.x, y: backSlot.y, z: backSlot.z, duration: config.durReturn, ease: config.ease }, 'return');

    tl.call(() => order.push(front));
  };

  swap();
  intervalId = setInterval(swap, delay);

  if (pauseOnHover) {
    const pause = () => { currentTl?.pause(); clearInterval(intervalId); };
    const resume = () => { currentTl?.play(); intervalId = setInterval(swap, delay); };
    container.addEventListener('mouseenter', pause);
    container.addEventListener('mouseleave', resume);
  }
}
