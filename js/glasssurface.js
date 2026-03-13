export function createGlassSurface(container, {
  width = 300,
  height = 200,
  borderRadius = 50,
  borderWidth = 0.07,
  brightness = 50,
  opacity = 0.93,
  blur = 11,
  displace = 0,
  backgroundOpacity = 0,
  saturation = 1,
  distortionScale = -180,
  redOffset = 0,
  greenOffset = 10,
  blueOffset = 20,
  xChannel = 'R',
  yChannel = 'G',
  mixBlendMode = 'difference'
} = {}) {
  const uid = 'gs' + Math.random().toString(36).slice(2, 8);
  const filterId = `glass-filter-${uid}`;
  const redGradId = `red-grad-${uid}`;
  const blueGradId = `blue-grad-${uid}`;

  container.style.width = typeof width === 'number' ? width + 'px' : width;
  container.style.height = typeof height === 'number' ? height + 'px' : height;
  container.style.borderRadius = borderRadius + 'px';
  container.style.setProperty('--glass-frost', backgroundOpacity);
  container.style.setProperty('--glass-saturation', saturation);
  container.style.setProperty('--filter-id', `url(#${filterId})`);
  container.classList.add('glass-surface', 'glass-surface--svg');

  const contentDiv = document.createElement('div');
  contentDiv.className = 'glass-surface__content';
  while (container.firstChild) contentDiv.appendChild(container.firstChild);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'glass-surface__filter');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.innerHTML = `<defs>
    <filter id="${filterId}" color-interpolation-filters="sRGB" x="0%" y="0%" width="100%" height="100%">
      <feImage id="${uid}-feimg" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap id="${uid}-red" in="SourceGraphic" in2="map" result="dispRed"/>
      <feColorMatrix in="dispRed" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="red"/>
      <feDisplacementMap id="${uid}-green" in="SourceGraphic" in2="map" result="dispGreen"/>
      <feColorMatrix in="dispGreen" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="green"/>
      <feDisplacementMap id="${uid}-blue" in="SourceGraphic" in2="map" result="dispBlue"/>
      <feColorMatrix in="dispBlue" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="blue"/>
      <feBlend in="red" in2="green" mode="screen" result="rg"/>
      <feBlend in="rg" in2="blue" mode="screen" result="output"/>
      <feGaussianBlur id="${uid}-blur" in="output" stdDeviation="0.7"/>
    </filter>
  </defs>`;

  container.appendChild(svg);
  container.appendChild(contentDiv);

  const feImg = svg.querySelector(`#${uid}-feimg`);
  const redCh = svg.querySelector(`#${uid}-red`);
  const greenCh = svg.querySelector(`#${uid}-green`);
  const blueCh = svg.querySelector(`#${uid}-blue`);
  const blurEl = svg.querySelector(`#${uid}-blur`);

  const generateDisplacementMap = () => {
    const rect = container.getBoundingClientRect();
    const w = rect.width || 400;
    const h = rect.height || 200;
    const edgeSize = Math.min(w, h) * (borderWidth * 0.5);

    const svgContent = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="red"/>
        </linearGradient>
        <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="blue"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${w}" height="${h}" fill="black"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="${borderRadius}" fill="url(#${redGradId})"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode:${mixBlendMode}"/>
      <rect x="${edgeSize}" y="${edgeSize}" width="${w - edgeSize * 2}" height="${h - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)"/>
    </svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
  };

  const update = () => {
    if (feImg) feImg.setAttribute('href', generateDisplacementMap());
    [{el:redCh,off:redOffset},{el:greenCh,off:greenOffset},{el:blueCh,off:blueOffset}].forEach(({el,off}) => {
      if (el) {
        el.setAttribute('scale', (distortionScale + off).toString());
        el.setAttribute('xChannelSelector', xChannel);
        el.setAttribute('yChannelSelector', yChannel);
      }
    });
    if (blurEl) blurEl.setAttribute('stdDeviation', displace.toString());
  };

  update();
  setTimeout(update, 100);

  const ro = new ResizeObserver(() => setTimeout(update, 0));
  ro.observe(container);
}
