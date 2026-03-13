export function initStaggeredMenu({
  position = 'right',
  colors = ['#B19EEF', '#5227FF'],
  menuButtonColor = '#ffffff',
  openMenuButtonColor = '#fff',
  accentColor = '#5227FF',
  changeMenuColorOnOpen = true,
  closeOnClickAway = true,
  onMenuOpen,
  onMenuClose
} = {}) {
  const wrapper = document.querySelector('.staggered-menu-wrapper');
  if (!wrapper) return;

  const panel = wrapper.querySelector('.staggered-menu-panel');
  const preLayersContainer = wrapper.querySelector('.sm-prelayers');
  const toggleBtn = wrapper.querySelector('.sm-toggle');
  const icon = wrapper.querySelector('.sm-icon');
  const plusH = wrapper.querySelector('.sm-icon-line:not(.sm-icon-line-v)');
  const plusV = wrapper.querySelector('.sm-icon-line-v');
  const textInner = wrapper.querySelector('.sm-toggle-textInner');
  const textWrap = wrapper.querySelector('.sm-toggle-textWrap');

  if (!panel || !toggleBtn || !icon || !plusH || !plusV || !textInner) return;

  if (accentColor) wrapper.style.setProperty('--sm-accent', accentColor);
  wrapper.dataset.position = position;

  const preLayers = preLayersContainer ? Array.from(preLayersContainer.querySelectorAll('.sm-prelayer')) : [];
  const offscreen = position === 'left' ? -100 : 100;

  gsap.set([panel, ...preLayers], { xPercent: offscreen });
  gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
  gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
  gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
  gsap.set(textInner, { yPercent: 0 });
  gsap.set(toggleBtn, { color: menuButtonColor });

  let isOpen = false;
  let busy = false;
  let openTl = null;
  let closeTween = null;
  let spinTween = null;
  let textAnim = null;
  let colorTween = null;

  const buildOpen = () => {
    openTl?.kill();
    closeTween?.kill();
    closeTween = null;

    const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
    const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
    const socialTitle = panel.querySelector('.sm-socials-title');
    const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link'));

    if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    preLayers.forEach((el, i) => {
      const start = Number(gsap.getProperty(el, 'xPercent'));
      tl.fromTo(el, { xPercent: start }, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, i * 0.07);
    });

    const lastT = preLayers.length ? (preLayers.length - 1) * 0.07 : 0;
    const panelT = lastT + (preLayers.length ? 0.08 : 0);
    const panelDur = 0.65;
    const panelStart = Number(gsap.getProperty(panel, 'xPercent'));
    tl.fromTo(panel, { xPercent: panelStart }, { xPercent: 0, duration: panelDur, ease: 'power4.out' }, panelT);

    if (itemEls.length) {
      const itemsStart = panelT + panelDur * 0.15;
      tl.to(itemEls, { yPercent: 0, rotate: 0, duration: 1, ease: 'power4.out', stagger: { each: 0.1 } }, itemsStart);
      if (numberEls.length) {
        tl.to(numberEls, { duration: 0.6, ease: 'power2.out', '--sm-num-opacity': 1, stagger: { each: 0.08 } }, itemsStart + 0.1);
      }
    }

    if (socialTitle || socialLinks.length) {
      const socStart = panelT + panelDur * 0.4;
      if (socialTitle) tl.to(socialTitle, { opacity: 1, duration: 0.5, ease: 'power2.out' }, socStart);
      if (socialLinks.length) {
        tl.to(socialLinks, { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', stagger: { each: 0.08 }, onComplete: () => gsap.set(socialLinks, { clearProps: 'opacity' }) }, socStart + 0.04);
      }
    }

    openTl = tl;
    return tl;
  };

  const playOpen = () => {
    if (busy) return;
    busy = true;
    const tl = buildOpen();
    if (tl) {
      tl.eventCallback('onComplete', () => { busy = false; });
      tl.play(0);
    } else { busy = false; }
  };

  const playClose = () => {
    openTl?.kill();
    openTl = null;
    const all = [...preLayers, panel];
    closeTween?.kill();
    closeTween = gsap.to(all, {
      xPercent: offscreen, duration: 0.32, ease: 'power3.in', overwrite: 'auto',
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
        if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
        const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
        if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
        const socialTitle = panel.querySelector('.sm-socials-title');
        const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link'));
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
        busy = false;
      }
    });
  };

  const animateIcon = (opening) => {
    spinTween?.kill();
    spinTween = opening
      ? gsap.to(icon, { rotate: 225, duration: 0.8, ease: 'power4.out', overwrite: 'auto' })
      : gsap.to(icon, { rotate: 0, duration: 0.35, ease: 'power3.inOut', overwrite: 'auto' });
  };

  const animateColor = (opening) => {
    colorTween?.kill();
    if (changeMenuColorOnOpen) {
      colorTween = gsap.to(toggleBtn, { color: opening ? openMenuButtonColor : menuButtonColor, delay: 0.18, duration: 0.3, ease: 'power2.out' });
    } else {
      gsap.set(toggleBtn, { color: menuButtonColor });
    }
  };

  const animateText = (opening) => {
    textAnim?.kill();
    const current = opening ? 'Menu' : 'Close';
    const target = opening ? 'Close' : 'Menu';
    const seq = [current];
    let last = current;
    for (let i = 0; i < 3; i++) { last = last === 'Menu' ? 'Close' : 'Menu'; seq.push(last); }
    if (last !== target) seq.push(target);
    seq.push(target);

    textInner.innerHTML = seq.map(l => `<span class="sm-toggle-line">${l}</span>`).join('');
    gsap.set(textInner, { yPercent: 0 });
    const finalShift = ((seq.length - 1) / seq.length) * 100;
    textAnim = gsap.to(textInner, { yPercent: -finalShift, duration: 0.5 + seq.length * 0.07, ease: 'power4.out' });
  };

  const closeMenu = () => {
    if (!isOpen) return;
    isOpen = false;
    wrapper.removeAttribute('data-open');
    onMenuClose?.();
    playClose();
    animateIcon(false);
    animateColor(false);
    animateText(false);
  };

  const toggleMenu = () => {
    isOpen = !isOpen;
    if (isOpen) {
      wrapper.dataset.open = '';
      onMenuOpen?.();
      playOpen();
    } else {
      wrapper.removeAttribute('data-open');
      onMenuClose?.();
      playClose();
    }
    animateIcon(isOpen);
    animateColor(isOpen);
    animateText(isOpen);
  };

  toggleBtn.addEventListener('click', toggleMenu);

  if (closeOnClickAway) {
    document.addEventListener('mousedown', (e) => {
      if (isOpen && !panel.contains(e.target) && !toggleBtn.contains(e.target)) closeMenu();
    });
  }
}
