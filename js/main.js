(function () {
  'use strict';

  // FAQ
  document.querySelectorAll('.faq-q').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const was = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
      if (!was) item.classList.add('open');
    });
  });

  // Workflow items (switch images)
  document.querySelectorAll('.wf-item').forEach(item => {
    item.addEventListener('click', () => {
      const wfSection = item.closest('.wf-grid');
      wfSection.querySelectorAll('.wf-item').forEach(i => i.classList.remove('wf-item--active'));
      item.classList.add('wf-item--active');

      const targetId = item.dataset.wf;
      wfSection.querySelectorAll('.wf-img').forEach(img => {
        img.style.display = img.id === targetId ? 'block' : 'none';
      });
    });
  });

  // Scroll reveal
  const els = document.querySelectorAll('[data-r]');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -50px 0px' });
    els.forEach(el => obs.observe(el));
  } else {
    els.forEach(el => el.classList.add('vis'));
  }

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href === '#') return;
      const t = document.querySelector(href);
      if (t) {
        e.preventDefault();
        t.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
})();
