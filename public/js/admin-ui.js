// Alertas personalizados do painel: janela de confirmação (ask) e avisos (notify), no lugar de confirm()/alert().
(() => {
  const SVG = {
    danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20zM12 10v5M12 18v.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  // ---------- avisos (aparecem em pilha no canto) ----------
  let stack;
  const getStack = () => {
    if (!stack) { stack = el('div', 'a-toasts'); stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
    return stack;
  };

  // type: success | info | warn | error | danger ; action: { label, onClick }
  const notify = ({ type = 'success', title, text = '', action = null, duration = 5600 } = {}) => {
    const box = el('div', `a-toast2 t-${type}`);
    box.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const icon = el('span', 'a-toast2-icon'); icon.innerHTML = SVG[type === 'danger' ? 'danger' : type] || SVG.info;
    const body = el('div', 'a-toast2-body');
    body.append(el('strong', '', title));
    if (text) body.append(el('span', '', text));
    if (action) {
      const b = el('button', 'a-toast2-action', action.label);
      b.type = 'button';
      b.addEventListener('click', () => { close(); action.onClick?.(); });
      body.append(b);
    }
    const x = el('button', 'a-toast2-x'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar aviso'); x.innerHTML = SVG.close;
    const bar = el('i', 'a-toast2-bar'); bar.style.animationDuration = `${duration}ms`;
    box.append(icon, body, x, bar);
    getStack().appendChild(box);
    requestAnimationFrame(() => box.classList.add('in'));

    let timer;
    const close = () => { clearTimeout(timer); box.classList.remove('in'); setTimeout(() => box.remove(), 250); };
    const arm = () => { timer = setTimeout(close, duration); };
    x.addEventListener('click', close);
    box.addEventListener('mouseenter', () => { clearTimeout(timer); box.classList.add('paused'); });
    box.addEventListener('mouseleave', () => { box.classList.remove('paused'); arm(); });
    arm();
    return close;
  };

  // Compatível com o uso antigo: toast('mensagem', ehErro)
  const toast = (msg, bad = false) => notify({ type: bad ? 'error' : 'success', title: msg });

  // Guarda um aviso para mostrar depois que a página recarregar (ex.: "Agendamento excluído")
  const flash = (opts) => { try { sessionStorage.setItem('a-flash', JSON.stringify(opts)); } catch { /* sem sessionStorage */ } };
  const showFlash = () => {
    try {
      const raw = sessionStorage.getItem('a-flash');
      if (!raw) return;
      sessionStorage.removeItem('a-flash');
      notify(JSON.parse(raw));
    } catch { /* ignora */ }
  };

  // ---------- janela de confirmação ----------
  // ask({ title, text, details: [...], image, tone: 'danger'|'warn'|'info', confirmText, cancelText }) -> Promise<boolean>
  const ask = ({ title, text = '', details = [], image = '', tone = 'danger', confirmText = 'Confirmar', cancelText = 'Cancelar' } = {}) => new Promise((resolve) => {
    const opener = document.activeElement;
    const root = el('div', 'a-dialog');
    const backdrop = el('div', 'a-dialog-backdrop');
    const panel = el('div', `a-dialog-panel tone-${tone}`);
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-modal', 'true');
    panel.tabIndex = -1;
    const uid = `d${Date.now()}`;
    panel.setAttribute('aria-labelledby', `${uid}-t`);
    panel.setAttribute('aria-describedby', `${uid}-d`);

    const icon = el('div', 'a-dialog-icon'); icon.innerHTML = SVG[tone === 'danger' ? 'danger' : tone] || SVG.info;
    const h = el('h2', '', title); h.id = `${uid}-t`;
    const desc = el('div', 'a-dialog-desc'); desc.id = `${uid}-d`;
    if (text) desc.append(el('p', 'a-dialog-text', text));
    if (image) { const im = el('img', 'a-dialog-img'); im.src = image; im.alt = ''; desc.append(im); }
    if (details.length) { const ul = el('ul', 'a-dialog-list'); details.forEach((d) => ul.append(el('li', '', d))); desc.append(ul); }

    const actions = el('div', 'a-dialog-actions');
    const cancel = el('button', 'a-btn a-btn-ghost', cancelText); cancel.type = 'button';
    const ok = el('button', `a-btn ${tone === 'danger' ? 'a-btn-solid-danger' : ''}`, confirmText); ok.type = 'button';
    actions.append(cancel, ok);
    panel.append(icon, h, desc, actions);
    root.append(backdrop, panel);
    document.body.appendChild(root);
    document.documentElement.classList.add('a-dialog-open');
    requestAnimationFrame(() => root.classList.add('in'));
    // Em ações destrutivas o foco começa no "Cancelar" (evita confirmar sem querer com Enter)
    (tone === 'danger' ? cancel : ok).focus();

    const done = (value) => {
      document.removeEventListener('keydown', onKey, true);
      root.classList.remove('in');
      document.documentElement.classList.remove('a-dialog-open');
      setTimeout(() => root.remove(), 200);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); return; }
      if (e.key === 'Tab') {
        const items = [cancel, ok];
        const i = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    backdrop.addEventListener('click', () => done(false));
    cancel.addEventListener('click', () => done(false));
    ok.addEventListener('click', () => done(true));
  });

  Object.assign(window, { notify, toast, flash, ask });
  const showPageNotice = () => {
    const n = document.querySelector('[data-notify]');
    if (!n) return;
    try { notify(JSON.parse(n.dataset.notify)); } catch { /* ignora */ }
    n.remove();
    if (location.search.includes('ok=1')) history.replaceState(null, '', location.pathname);
  };
  const boot = () => { showFlash(); showPageNotice(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
