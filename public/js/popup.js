// Popup da página inicial (conteúdo e imagem vêm do painel)
(() => {
  const modal = document.getElementById('site-popup');
  if (!modal) return;
  const panel = modal.querySelector('.modal-panel');
  const key = `drm_popup_${modal.dataset.version}`;
  const freq = modal.dataset.frequency;
  const force = new URLSearchParams(location.search).get('popup') === '1'; // teste pelo painel
  let opener = null;
  let closing = false;

  const store = (kind) => { try { return window[kind]; } catch { return null; } };
  const seenRecently = () => {
    if (force || freq === 'visit') return false;
    if (freq === 'session') return store('sessionStorage')?.getItem(key) === '1';
    const at = Number(store('localStorage')?.getItem(key));
    const span = freq === 'week' ? 7 * 864e5 : 864e5;
    return Boolean(at) && Date.now() - at < span;
  };
  const remember = () => {
    if (force) return;
    if (freq === 'session') store('sessionStorage')?.setItem(key, '1');
    else if (freq !== 'visit') store('localStorage')?.setItem(key, String(Date.now()));
  };

  const focusables = () => [...panel.querySelectorAll('a[href], button:not([disabled])')].filter((el) => el.offsetParent !== null);

  const open = () => {
    if (!modal.hidden) return;
    opener = document.activeElement;
    modal.hidden = false;
    window.pageLock?.lock();
    remember();
    requestAnimationFrame(() => { modal.classList.add('is-open'); panel.focus({ preventScroll: true }); });
  };

  const close = () => {
    if (modal.hidden || closing) return;
    closing = true;
    modal.classList.remove('is-open');
    const finish = () => { modal.hidden = true; closing = false; window.pageLock?.unlock(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish(); else setTimeout(finish, 220);
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  };

  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-popup-close]')) { close(); return; }
    const link = e.target.closest('[data-popup-link]');
    if (link && !link.target) close(); // links internos (/#planos) fecham o popup e rolam a página
  });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const items = focusables();
      if (!items.length) { e.preventDefault(); panel.focus(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  if (seenRecently()) return;
  // Abre depois do atraso; se o menu, o agendamento ou outra janela estiver aberta, espera fechar
  const delay = Math.max(0, Number(modal.dataset.delay) || 0) * 1000;
  setTimeout(() => {
    let tries = 0;
    const attempt = () => {
      if (window.pageLock?.locked && tries++ < 60) { setTimeout(attempt, 1000); return; }
      if (!window.pageLock?.locked) open();
    };
    attempt();
  }, delay);
})();
