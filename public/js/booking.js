// Agendamento de avaliação em modal: abre por qualquer link/botão com href terminando em "#avaliacao",
// carrega os horários livres, deixa o aluno escolher e envia o pedido.
(() => {
  const modal = document.getElementById('booking-modal');
  const root = modal && modal.querySelector('[data-booking]');
  if (!modal || !root) return;

  const $ = (sel) => root.querySelector(sel);
  const panel = modal.querySelector('.modal-panel');
  const stateEl = $('[data-b-state]');
  const body = $('[data-b-body]');
  const daysEl = $('[data-b-days]');
  const timesStep = $('[data-b-times-step]');
  const timesEl = $('[data-b-times]');
  const form = $('[data-b-form]');
  const done = $('[data-b-done]');
  const summary = $('[data-b-summary]');
  const formError = $('[data-b-error]');

  let days = [];
  let pickedDate = '';
  let pickedTime = '';
  let opener = null;

  const waFallback = () => `<a href="${root.dataset.wa}" target="_blank" rel="noopener">Agendar pelo WhatsApp</a>`;
  const showState = (html) => { stateEl.hidden = false; stateEl.innerHTML = html; body.hidden = true; };
  const dayLabel = (d) => `${d.weekday}, ${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`;

  const choice = (text, sub, pressed, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'b-chip';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(pressed));
    b.innerHTML = sub ? `<small>${sub}</small><strong>${text}</strong>` : `<strong>${text}</strong>`;
    b.addEventListener('click', onClick);
    return b;
  };

  const renderDays = () => {
    daysEl.replaceChildren(...days.map((d) => choice(d.date.slice(8, 10) + '/' + d.date.slice(5, 7), d.weekday, d.date === pickedDate, () => pickDate(d.date))));
  };
  const renderTimes = () => {
    const d = days.find((x) => x.date === pickedDate);
    timesEl.replaceChildren(...(d ? d.times : []).map((t) => choice(t, '', t === pickedTime, () => pickTime(t))));
  };

  const pickDate = (date) => {
    pickedDate = date; pickedTime = '';
    form.hidden = true;
    timesStep.hidden = false;
    renderDays(); renderTimes();
    timesStep.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const pickTime = (time) => {
    pickedTime = time;
    const d = days.find((x) => x.date === pickedDate);
    summary.textContent = `Avaliação em ${dayLabel(d)} às ${time}`;
    form.hidden = false;
    renderTimes();
    form.querySelector('[name="name"]').focus({ preventScroll: true });
    form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const load = async (keepSelection = false) => {
    try {
      const res = await fetch('/api/agenda', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'indisponível');
      days = data.days;
      const sel = $('[data-b-objective]');
      if (sel.options.length === 1) data.objectives.forEach((o) => sel.add(new Option(o, o)));
      if (!days.length) { showState(`No momento não há horários livres. ${waFallback()}`); return; }
      stateEl.hidden = true; body.hidden = false;
      if (!keepSelection || !days.some((d) => d.date === pickedDate)) { pickedDate = ''; pickedTime = ''; timesStep.hidden = true; form.hidden = true; }
      renderDays();
      if (pickedDate) renderTimes();
    } catch (err) {
      showState(`O agendamento online está indisponível agora. ${waFallback()}`);
    }
  };

  // ---------- modal ----------
  const focusables = () => [...panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not(.b-trap), select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);

  const lock = () => {
    const gap = window.innerWidth - document.documentElement.clientWidth; // largura da barra de rolagem
    document.documentElement.classList.add('modal-open');
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  };
  const unlock = () => {
    document.documentElement.classList.remove('modal-open');
    document.body.style.paddingRight = '';
  };

  const resetUi = () => {
    done.hidden = true;
    form.reset();
    form.querySelectorAll('[data-error]').forEach((s) => { s.textContent = ''; });
    pickedDate = ''; pickedTime = '';
    timesStep.hidden = true; form.hidden = true;
    showState('Carregando horários disponíveis…');
  };

  const open = (from) => {
    if (!modal.hidden) return;
    opener = from || document.activeElement;
    resetUi();
    modal.hidden = false;
    lock();
    requestAnimationFrame(() => { modal.classList.add('is-open'); panel.focus({ preventScroll: true }); });
    panel.scrollTop = 0;
    load();
    if (location.hash !== '#avaliacao') history.replaceState(null, '', `${location.pathname}${location.search}#avaliacao`);
  };

  const close = () => {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    const finish = () => { modal.hidden = true; unlock(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish(); else setTimeout(finish, 220);
    if (location.hash === '#avaliacao') history.replaceState(null, '', `${location.pathname}${location.search}`);
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  };

  // Qualquer link para #avaliacao abre o modal (em qualquer página)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (link && /(^|\/)#avaliacao$/.test(link.getAttribute('href'))) {
      e.preventDefault();
      open(link);
      return;
    }
    if (e.target.closest('[data-modal-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { // mantém o foco dentro do modal
      const items = focusables();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  if (location.hash === '#avaliacao') window.addEventListener('load', () => open(null), { once: true });
  window.addEventListener('hashchange', () => { if (location.hash === '#avaliacao') open(null); });

  // ---------- formulário ----------
  const phone = form.querySelector('[name="phone"]');
  phone.addEventListener('input', () => {
    const d = phone.value.replace(/\D/g, '').slice(0, 11);
    phone.value = d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelectorAll('[data-error]').forEach((s) => { s.textContent = ''; });
    const fd = new FormData(form);
    const payload = { date: pickedDate, time: pickedTime, consent: fd.get('consent') === 'on' };
    ['name', 'phone', 'email', 'objective', 'notes', 'website'].forEach((k) => { payload[k] = fd.get(k) || ''; });
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await fetch('/api/agendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.status === 201 || data.ok) {
        form.hidden = true; body.hidden = true; done.hidden = false;
        $('[data-b-when]').textContent = data.when || '';
        $('[data-b-wa]').href = data.whatsapp || root.dataset.wa;
        form.reset();
        panel.scrollTop = 0;
        done.querySelector('[data-b-wa]').focus({ preventScroll: true });
        return;
      }
      if (data.errors) {
        Object.entries(data.errors).forEach(([k, v]) => { const s = form.querySelector(`[data-error="${k}"]`); if (s) s.textContent = v; });
        if (data.errors.date || data.errors.time) formError.textContent = 'Escolha o dia e o horário acima.';
      } else {
        formError.textContent = data.error || 'Não foi possível agendar. Tente de novo.';
        if (data.refresh) { pickedTime = ''; form.hidden = true; await load(true); }
      }
    } catch {
      formError.textContent = 'Sem conexão. Tente de novo ou use o WhatsApp.';
    } finally {
      btn.disabled = false;
    }
  });
})();
