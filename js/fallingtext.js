export function initFallingText(container, {
  text = '',
  highlightWords = [],
  highlightClass = 'highlighted',
  trigger = 'scroll',
  backgroundColor = 'transparent',
  wireframes = false,
  gravity = 0.56,
  mouseConstraintStiffness = 0.9,
  fontSize = '2rem'
} = {}) {
  const textEl = container.querySelector('.falling-text-target');
  const canvasEl = container.querySelector('.falling-text-canvas');
  if (!textEl || !canvasEl) return;

  const words = text.split(' ');
  textEl.style.fontSize = fontSize;
  textEl.style.lineHeight = '1.4';
  textEl.innerHTML = words
    .map(word => {
      const isHL = highlightWords.some(hw => word.startsWith(hw));
      return `<span class="word ${isHL ? highlightClass : ''}">${word}</span>`;
    })
    .join(' ');

  let started = false;

  const startEffect = () => {
    if (started) return;
    started = true;

    const { Engine, Render, World, Bodies, Body, Runner, Mouse, MouseConstraint } = Matter;

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;

    const engine = Engine.create();
    engine.world.gravity.y = gravity;

    const render = Render.create({
      element: canvasEl,
      engine,
      options: { width: w, height: h, background: backgroundColor, wireframes }
    });

    const bOpts = { isStatic: true, render: { fillStyle: 'transparent' } };
    const floor = Bodies.rectangle(w / 2, h + 25, w, 50, bOpts);
    const leftWall = Bodies.rectangle(-25, h / 2, 50, h, bOpts);
    const rightWall = Bodies.rectangle(w + 25, h / 2, 50, h, bOpts);
    const ceiling = Bodies.rectangle(w / 2, -25, w, 50, bOpts);

    const wordSpans = textEl.querySelectorAll('.word');
    const wordBodies = [...wordSpans].map(elem => {
      const er = elem.getBoundingClientRect();
      const x = er.left - rect.left + er.width / 2;
      const y = er.top - rect.top + er.height / 2;

      const body = Bodies.rectangle(x, y, er.width, er.height, {
        render: { fillStyle: 'transparent' },
        restitution: 0.8,
        frictionAir: 0.01,
        friction: 0.2
      });

      Body.setVelocity(body, { x: (Math.random() - 0.5) * 5, y: 0 });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
      return { elem, body };
    });

    wordBodies.forEach(({ elem }) => {
      elem.style.position = 'absolute';
      elem.style.transform = 'none';
    });

    const mouse = Mouse.create(container);
    const mc = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: mouseConstraintStiffness, render: { visible: false } }
    });
    render.mouse = mouse;

    World.add(engine.world, [floor, leftWall, rightWall, ceiling, mc, ...wordBodies.map(wb => wb.body)]);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    const update = () => {
      wordBodies.forEach(({ body, elem }) => {
        elem.style.left = `${body.position.x}px`;
        elem.style.top = `${body.position.y}px`;
        elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
      });
      requestAnimationFrame(update);
    };
    update();
  };

  if (trigger === 'auto') {
    startEffect();
  } else if (trigger === 'scroll') {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        startEffect();
        observer.disconnect();
      }
    }, { threshold: 0.6 });
    observer.observe(container);
  } else if (trigger === 'hover') {
    container.addEventListener('mouseenter', startEffect, { once: true });
  } else if (trigger === 'click') {
    container.addEventListener('click', startEffect, { once: true });
  }
}
