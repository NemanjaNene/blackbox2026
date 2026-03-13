export function initStickerPeel(container, {
  imageSrc,
  rotate = 0,
  peelBackHoverPct = 30,
  peelBackActivePct = 40,
  width = 200,
  shadowIntensity = 0.5,
  lightingIntensity = 0.1,
  initialPosition = { x: 0, y: 0 },
  peelDirection = 0
} = {}) {
  if (!container) return;

  const uid = 'sp-' + Math.random().toString(36).slice(2, 8);
  const defaultPadding = 10;

  container.classList.add('draggable');
  container.style.setProperty('--sticker-rotate', rotate + 'deg');
  container.style.setProperty('--sticker-p', defaultPadding + 'px');
  container.style.setProperty('--sticker-peelback-hover', peelBackHoverPct + '%');
  container.style.setProperty('--sticker-peelback-active', peelBackActivePct + '%');
  container.style.setProperty('--sticker-width', width + 'px');
  container.style.setProperty('--sticker-shadow-opacity', shadowIntensity);
  container.style.setProperty('--sticker-lighting-constant', lightingIntensity);
  container.style.setProperty('--peel-direction', peelDirection + 'deg');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.innerHTML = `
    <defs>
      <filter id="pointLight-${uid}">
        <feGaussianBlur stdDeviation="1" result="blur"/>
        <feSpecularLighting result="spec" in="blur" specularExponent="100" specularConstant="${lightingIntensity}" lightingColor="white">
          <fePointLight id="pl-${uid}" x="100" y="100" z="300"/>
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceGraphic" result="lit"/>
        <feComposite in="lit" in2="SourceAlpha" operator="in"/>
      </filter>
      <filter id="pointLightFlipped-${uid}">
        <feGaussianBlur stdDeviation="10" result="blur"/>
        <feSpecularLighting result="spec" in="blur" specularExponent="100" specularConstant="${lightingIntensity * 7}" lightingColor="white">
          <fePointLight id="plf-${uid}" x="100" y="100" z="300"/>
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceGraphic" result="lit"/>
        <feComposite in="lit" in2="SourceAlpha" operator="in"/>
      </filter>
      <filter id="dropShadow-${uid}">
        <feDropShadow dx="2" dy="4" stdDeviation="${3 * shadowIntensity}" floodColor="black" floodOpacity="${shadowIntensity}"/>
      </filter>
      <filter id="expandAndFill-${uid}">
        <feOffset dx="0" dy="0" in="SourceAlpha" result="shape"/>
        <feFlood floodColor="rgb(179,179,179)" result="flood"/>
        <feComposite operator="in" in="flood" in2="shape"/>
      </filter>
    </defs>`;
  container.appendChild(svg);

  const stickerContainer = document.createElement('div');
  stickerContainer.className = 'sticker-container';

  stickerContainer.innerHTML = `
    <div class="sticker-main" style="filter:url(#dropShadow-${uid})">
      <div class="sticker-lighting" style="filter:url(#pointLight-${uid})">
        <img src="${imageSrc}" alt="BlackBox Logo" class="sticker-image" draggable="false" oncontextmenu="return false">
      </div>
    </div>
    <div class="flap">
      <div class="flap-lighting" style="filter:url(#pointLightFlipped-${uid})">
        <img src="${imageSrc}" alt="" class="flap-image" draggable="false" oncontextmenu="return false" style="filter:url(#expandAndFill-${uid})">
      </div>
    </div>`;

  container.appendChild(stickerContainer);

  if (initialPosition && typeof initialPosition === 'object') {
    gsap.set(container, { x: initialPosition.x, y: initialPosition.y });
  }

  const pointLight = svg.querySelector(`#pl-${uid}`);
  const pointLightFlipped = svg.querySelector(`#plf-${uid}`);

  stickerContainer.addEventListener('mousemove', (e) => {
    const rect = stickerContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (pointLight) {
      pointLight.setAttribute('x', x);
      pointLight.setAttribute('y', y);
    }
    if (pointLightFlipped) {
      const normalizedAngle = Math.abs(peelDirection % 360);
      if (normalizedAngle !== 180) {
        pointLightFlipped.setAttribute('x', x);
        pointLightFlipped.setAttribute('y', rect.height - y);
      }
    }
  });

  stickerContainer.addEventListener('touchstart', () => stickerContainer.classList.add('touch-active'));
  stickerContainer.addEventListener('touchend', () => stickerContainer.classList.remove('touch-active'));
  stickerContainer.addEventListener('touchcancel', () => stickerContainer.classList.remove('touch-active'));

  if (typeof Draggable !== 'undefined') {
    const dragger = Draggable.create(container, {
      type: 'x,y',
      bounds: container.parentNode,
      inertia: false,
      onDrag() {
        const rot = gsap.utils.clamp(-24, 24, this.deltaX * 0.4);
        gsap.to(container, { rotation: rot, duration: 0.15, ease: 'power1.out' });
      },
      onDragEnd() {
        gsap.to(container, { rotation: 0, duration: 0.8, ease: 'power2.out' });
      }
    })[0];

    window.addEventListener('resize', () => dragger?.update());
  }
}
