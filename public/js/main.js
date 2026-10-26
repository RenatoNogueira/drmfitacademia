document.documentElement.classList.add('js');

// Menu mobile
const toggle = document.getElementById('nav-toggle');
const nav = document.getElementById('main-nav');
// Com o menu aberto a página fica travada (funciona também no iOS, onde overflow:hidden não basta)
let lockedY = 0;
const lockScroll = () => {
  lockedY = window.scrollY;
  document.documentElement.classList.add('menu-open');
  Object.assign(document.body.style, { position: 'fixed', top: `-${lockedY}px`, left: '0', right: '0', width: '100%' });
};
const unlockScroll = () => {
  document.documentElement.classList.remove('menu-open');
  Object.assign(document.body.style, { position: '', top: '', left: '', right: '', width: '' });
  window.scrollTo(0, lockedY);
};
const isMenuOpen = () => !!nav && nav.classList.contains('open');
const setMenu = (open) => {
  if (!nav || !toggle || open === isMenuOpen()) return;
  nav.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  if (open) { lockScroll(); nav.querySelector('a')?.focus({ preventScroll: true }); } else { unlockScroll(); }
};
const closeMenu = () => setMenu(false);
if (toggle && nav) {
  toggle.addEventListener('click', () => setMenu(!isMenuOpen()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMenuOpen()) { closeMenu(); toggle.focus(); } });
  window.matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });
  // Cliques em qualquer link do menu (inclusive de outras páginas) fecham o painel
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
}

// Rolagem suave com aceleração/desaceleração (easeInOutCubic)
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HEADER_OFFSET = 62; // altura do menu já recolhido
let scrollRaf = 0;
const animateScrollTo = (targetY, duration = 1000) => {
  cancelAnimationFrame(scrollRaf);
  const startY = window.scrollY;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  const endY = Math.max(0, Math.min(targetY, maxY));
  if (prefersReduced || Math.abs(endY - startY) < 2) { window.scrollTo(0, endY); return; }
  const dur = Math.min(1400, Math.max(600, Math.abs(endY - startY) * 0.5, duration * 0.6));
  const t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    window.scrollTo(0, startY + (endY - startY) * ease(p));
    if (p < 1) scrollRaf = requestAnimationFrame(step);
  };
  scrollRaf = requestAnimationFrame(step);
};
const sectionTop = (el) => (el.id === 'inicio' ? 0 : el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET + 1);
const isHome = location.pathname === '/';

document.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').split('#')[1];
    const target = id && document.getElementById(id);
    if (!target || !isHome) return; // em outras páginas, vai para a home e rola lá
    e.preventDefault();
    closeMenu();
    animateScrollTo(sectionTop(target));
    history.pushState(null, '', `/#${id}`);
  });
});

// Ao chegar de outra página com #secao, começa no topo e desliza até a seção
if (isHome && location.hash.length > 1) {
  const target = document.getElementById(location.hash.slice(1));
  if (target) {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    window.addEventListener('load', () => setTimeout(() => animateScrollTo(sectionTop(target)), 250), { once: true });
  }
}

// Destaque do item de menu da seção visível
const spyLinks = [...document.querySelectorAll('[data-spy]')];
const spySections = spyLinks.map((l) => document.getElementById(l.dataset.spy)).filter(Boolean);
if (isHome && spySections.length) {
  const updateSpy = () => {
    const mid = window.scrollY + window.innerHeight * 0.35;
    let current = spySections[0].id;
    spySections.forEach((s) => { if (s.offsetTop <= mid) current = s.id; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = spySections[spySections.length - 1].id;
    spyLinks.forEach((l) => l.classList.toggle('active', l.dataset.spy === current));
  };
  window.addEventListener('scroll', updateSpy, { passive: true });
  updateSpy();
}

// Formulário de contato sem recarregar a página
const form = document.querySelector('[data-ajax-form]');
if (form) {
  const statusBox = form.querySelector('.form-status');
  const showStatus = (cls, msg) => { statusBox.innerHTML = `<div class="alert ${cls}">${msg}</div>`; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    form.querySelectorAll('[data-error]').forEach((s) => { s.textContent = ''; });
    btn.disabled = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'fetch' },
        body: new URLSearchParams(new FormData(form))
      });
      const data = await res.json();
      if (data.ok) {
        form.reset();
        showStatus('alert-ok', 'Mensagem enviada! Entraremos em contato em breve.');
      } else {
        Object.entries(data.errors || {}).forEach(([k, v]) => {
          const slot = form.querySelector(`[data-error="${k}"]`);
          if (slot) slot.textContent = v;
        });
        showStatus('alert-error', 'Revise os campos destacados.');
      }
    } catch {
      showStatus('alert-error', 'Não foi possível enviar agora. Tente pelo WhatsApp.');
    } finally {
      btn.disabled = false;
    }
  });
}

// Header sólido ao rolar + botão "topo"
const header = document.querySelector('.site-header');
const toTop = document.getElementById('to-top');
const onScroll = () => {
  const y = window.scrollY;
  if (header) header.classList.toggle('scrolled', y > 40);
  if (toTop) toTop.classList.toggle('show', y > 600);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
if (toTop) toTop.addEventListener('click', () => animateScrollTo(0));

// Animação de entrada ao rolar
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Elementos que animam automaticamente, mesmo sem a classe .reveal no HTML
document.querySelectorAll('.section-head, .stat, .promo .container, .cta-inner, .g-item, .class-card, .footer-grid > div, .contact-info, .contact-form, .table-wrap, .hours, .faq')
  .forEach((el) => el.classList.add('reveal'));
document.querySelectorAll('.g-item').forEach((el) => el.classList.remove('reveal'));

// Escalonamento: filhos de uma mesma grade entram um após o outro
document.querySelectorAll('.grid, .carousel, .gallery, .stats-grid, .hours-row, .footer-grid').forEach((parent) => {
  [...parent.children].forEach((child, i) => { child.style.transitionDelay = `${Math.min(i, 5) * 0.09}s`; });
});

const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const el = e.target;
        el.classList.add('visible');
        io.unobserve(el);
        // Depois da entrada, devolve a transição normal (para o hover não ficar lento)
        setTimeout(() => { el.style.transitionDelay = ''; el.classList.add('done'); }, 1500);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('visible'));
}

// Galeria: cada foto é "pintada" com uma pincelada quando entra na tela (inclusive ao rolar a galeria para o lado)
const brushItems = document.querySelectorAll('.g-item');
brushItems.forEach((el) => el.classList.add('brush'));
if ('IntersectionObserver' in window && !reduceMotion) {
  const bo = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      bo.unobserve(el);
      el.classList.add('painted');
      setTimeout(() => el.classList.add('done'), 1800);
    });
  }, { threshold: 0.35 });
  brushItems.forEach((el) => bo.observe(el));
} else {
  brushItems.forEach((el) => el.classList.add('painted', 'done'));
}

// O botão flutuante de WhatsApp some enquanto a área de contato (que já tem WhatsApp) está na tela
const waFloat = document.querySelector('.wa-float');
const waZones = document.querySelectorAll('#contato, .cta-band');
if (waFloat && waZones.length && 'IntersectionObserver' in window) {
  const visible = new Set();
  const wo = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
    waFloat.classList.toggle('wa-hidden', visible.size > 0);
  }, { threshold: 0.05 });
  waZones.forEach((z) => wo.observe(z));
}

// Contadores: começam quando aparecem na tela
const runCounter = (el) => {
  const target = Number(el.dataset.count);
  if (reduceMotion) { el.textContent = target.toLocaleString('pt-BR'); return; }
  const start = performance.now();
  const duration = 1600;
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('pt-BR');
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const counters = document.querySelectorAll('[data-count]');
if ('IntersectionObserver' in window) {
  const co = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { runCounter(e.target); co.unobserve(e.target); } });
  }, { threshold: 0.6 });
  counters.forEach((el) => co.observe(el));
} else {
  counters.forEach(runCounter);
}

// Barra de progresso de rolagem e leve parallax no hero
const progress = document.getElementById('scroll-progress');
const heroImg = document.querySelector('.hero-bg img, .hero-bg video');
const heroText = document.querySelector('.hero-text');
let ticking = false;
const onFrame = () => {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  if (!reduceMotion && y < window.innerHeight * 1.2) {
    if (heroImg) heroImg.style.transform = `translateY(${y * 0.12}px) scale(1.06)`;
    if (heroText) {
      heroText.style.transform = `translateY(${y * -0.08}px)`;
      heroText.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.9)));
    }
  }
  ticking = false;
};
window.addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onFrame); }
}, { passive: true });
onFrame();

// Carrosséis (aulas)
document.querySelectorAll('[data-carousel]').forEach((track) => {
  const root = track.closest('section');
  const prev = root.querySelector('[data-carousel-prev]');
  const next = root.querySelector('[data-carousel-next]');
  const gap = () => parseFloat(getComputedStyle(track).columnGap) || 16;
  const step = () => (track.querySelector(':scope > *')?.getBoundingClientRect().width || 300) + gap();
  prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

  // Desativa o botão quando chega ao começo/fim
  const updateButtons = () => {
    const max = track.scrollWidth - track.clientWidth;
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max - 2;
  };
  track.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('resize', updateButtons);
  updateButtons();

  // Arrastar com o mouse
  let down = false, startX = 0, startLeft = 0, moved = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) { moved = true; track.classList.add('dragging'); }
    if (moved) track.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => { down = false; track.classList.remove('dragging'); });
  track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
});

// Lightbox para vídeo (botão play) e fotos da galeria
const lightbox = document.getElementById('lightbox');
const lightboxBody = document.getElementById('lightbox-body');
const closeLightbox = () => {
  lightbox.hidden = true;
  lightboxBody.replaceChildren();
};
const openLightbox = (node) => {
  lightboxBody.replaceChildren(node);
  lightbox.hidden = false;
};
if (lightbox) {
  document.querySelectorAll('[data-video]').forEach((btn) => btn.addEventListener('click', () => {
    const v = document.createElement('video');
    v.src = btn.dataset.video;
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    openLightbox(v);
  }));
  document.querySelectorAll('[data-image]').forEach((btn) => btn.addEventListener('click', () => {
    const i = document.createElement('img');
    i.src = btn.dataset.image;
    i.alt = '';
    openLightbox(i);
  }));
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox(); });
}

// Máscara de telefone
const tel = document.querySelector('input[name="telefone"]');
if (tel) {
  tel.addEventListener('input', () => {
    const d = tel.value.replace(/\D/g, '').slice(0, 11);
    tel.value = d.length > 10
      ? d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
      : d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  });
}

// Hero: leve parallax que acompanha o mouse (só em telas com mouse e sem "reduzir movimento")
(() => {
  const hero = document.querySelector('.hero');
  if (!hero || reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - 0.5;
    ty = (e.clientY - r.top) / r.height - 0.5;
  });
  hero.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
  const loop = () => {
    if (window.scrollY < window.innerHeight * 1.2) {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      hero.style.setProperty('--mx', cx.toFixed(3));
      hero.style.setProperty('--my', cy.toFixed(3));
    }
    requestAnimationFrame(loop);
  };
  loop();
})();
