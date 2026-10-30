// Tela de horários: chips por dia, gerador, copiar para outros dias e datas bloqueadas.
(() => {
  const form = document.getElementById('h-form');
  const dataEl = document.getElementById('h-data');
  if (!form || !dataEl) return;

  const data = JSON.parse(dataEl.textContent);
  const slots = {};
  for (let d = 0; d < 7; d++) slots[d] = [...(data.slots[d] || [])];
  let blocked = [...(data.blocked || [])];
  let dirty = false;

  const NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const period = (t) => (toMin(t) < 12 * 60 ? 'manha' : toMin(t) < 18 * 60 ? 'tarde' : 'noite');
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const say = (opts) => (window.notify ? window.notify(opts) : null);
  const markDirty = () => { dirty = true; document.getElementById('h-dirty').hidden = false; };

  const addTimes = (day, times) => {
    const set = new Set(slots[day]);
    let added = 0;
    times.forEach((t) => { if (TIME_RE.test(t) && !set.has(t)) { set.add(t); added += 1; } });
    slots[day] = [...set].sort();
    return added;
  };

  // ---------- desenho ----------
  const renderDay = (card) => {
    const d = Number(card.dataset.day);
    const chips = card.querySelector('[data-chips]');
    chips.replaceChildren(...slots[d].map((t) => {
      const c = el('span', `h-chip p-${period(t)}`);
      c.append(el('b', '', t));
      const x = el('button', 'h-chip-x'); x.type = 'button'; x.textContent = '×';
      x.setAttribute('aria-label', `Remover ${t} de ${NAMES[d]}`);
      x.addEventListener('click', () => { slots[d] = slots[d].filter((v) => v !== t); renderAll(); markDirty(); });
      c.append(x);
      return c;
    }));
    card.querySelector('[data-empty]').hidden = slots[d].length > 0;
    card.classList.toggle('is-closed', slots[d].length === 0);
    const n = slots[d].length;
    card.querySelector('[data-count]').textContent = n ? `${n} ${n === 1 ? 'horário' : 'horários'}` : 'fechado';
    card.querySelector('[data-slots-input]').value = slots[d].join(',');
  };

  const fmtDate = (iso) => {
    const [y, m, dd] = iso.split('-');
    const wd = NAMES[new Date(`${iso}T12:00:00Z`).getUTCDay()].slice(0, 3);
    return `${wd}, ${dd}/${m}/${y}`;
  };

  const renderBlocked = () => {
    const box = document.getElementById('h-block-chips');
    box.replaceChildren(...blocked.map((iso) => {
      const c = el('span', 'h-chip p-block');
      c.append(el('b', '', fmtDate(iso)));
      const x = el('button', 'h-chip-x'); x.type = 'button'; x.textContent = '×';
      x.setAttribute('aria-label', `Liberar a data ${fmtDate(iso)}`);
      x.addEventListener('click', () => { blocked = blocked.filter((v) => v !== iso); renderAll(); markDirty(); });
      c.append(x);
      return c;
    }));
    document.getElementById('h-block-empty').hidden = blocked.length > 0;
    document.getElementById('h-blocked-input').value = blocked.join(',');
  };

  const renderAll = () => {
    form.querySelectorAll('.h-day').forEach(renderDay);
    renderBlocked();
    const total = Object.values(slots).reduce((s, a) => s + a.length, 0);
    document.getElementById('h-total').textContent = String(total);
    document.getElementById('h-days').textContent = String(Object.values(slots).filter((a) => a.length).length);
    document.getElementById('h-blocked').textContent = String(blocked.length);
  };

  // ---------- ações de cada dia ----------
  form.querySelectorAll('.h-day').forEach((card) => {
    const d = Number(card.dataset.day);
    const tools = card.querySelector('[data-tools]');
    const toggle = card.querySelector('[data-toggle-tools]');

    toggle.addEventListener('click', () => {
      tools.hidden = !tools.hidden;
      toggle.setAttribute('aria-expanded', String(!tools.hidden));
    });

    const addOne = () => {
      const input = card.querySelector('[data-new-time]');
      const v = input.value;
      if (!TIME_RE.test(v)) { say({ type: 'error', title: 'Escolha um horário válido' }); input.focus(); return; }
      if (!addTimes(d, [v])) { say({ type: 'info', title: `${v} já está em ${NAMES[d]}` }); return; }
      renderAll(); markDirty();
      // sugere o próximo horário (1h depois) para agilizar a digitação em sequência
      const next = toMin(v) + 60;
      if (next < 24 * 60) input.value = toTime(next);
    };
    card.querySelector('[data-add-time]').addEventListener('click', addOne);
    card.querySelector('[data-new-time]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addOne(); } });

    card.querySelector('[data-generate]').addEventListener('click', () => {
      const from = card.querySelector('[data-gen-from]').value;
      const to = card.querySelector('[data-gen-to]').value;
      const step = Number(card.querySelector('[data-gen-step]').value);
      if (!TIME_RE.test(from) || !TIME_RE.test(to) || toMin(to) < toMin(from)) { say({ type: 'error', title: 'Confira os horários', text: 'O último horário precisa ser igual ou depois do primeiro.' }); return; }
      const list = [];
      for (let m = toMin(from); m <= toMin(to); m += step) list.push(toTime(m));
      if (list.length > 40) { say({ type: 'error', title: 'Muitos horários de uma vez', text: 'Gere no máximo 40 por vez.' }); return; }
      const added = addTimes(d, list);
      renderAll(); markDirty();
      say({ type: 'success', title: `${added} ${added === 1 ? 'horário adicionado' : 'horários adicionados'} em ${NAMES[d]}`, text: added < list.length ? `${list.length - added} já existiam.` : '' });
    });

    const targets = () => [...card.querySelectorAll('[data-copy-target]')];
    card.querySelectorAll('[data-copy-preset]').forEach((b) => b.addEventListener('click', () => {
      const weekdays = ['1', '2', '3', '4', '5'];
      targets().forEach((t) => { t.checked = b.dataset.copyPreset === 'all' ? true : weekdays.includes(t.value); });
    }));
    card.querySelector('[data-copy]').addEventListener('click', async () => {
      const chosen = targets().filter((t) => t.checked).map((t) => Number(t.value));
      if (!slots[d].length) { say({ type: 'info', title: `${NAMES[d]} não tem horários para copiar` }); return; }
      if (!chosen.length) { say({ type: 'info', title: 'Marque os dias que vão receber os horários' }); return; }
      const overwrite = chosen.filter((c) => slots[c].length);
      if (overwrite.length && window.ask) {
        const yes = await window.ask({
          tone: 'warn', title: 'Substituir os horários desses dias?',
          text: overwrite.map((c) => NAMES[c]).join(', '),
          details: [`Os horários atuais desses dias serão trocados pelos de ${NAMES[d]}.`, 'Nada vale no site até você clicar em "Salvar horários".'],
          confirmText: 'Substituir', cancelText: 'Cancelar'
        });
        if (!yes) return;
      }
      chosen.forEach((c) => { slots[c] = [...slots[d]]; });
      renderAll(); markDirty();
      say({ type: 'success', title: `Horários de ${NAMES[d]} copiados`, text: `Para: ${chosen.map((c) => NAMES[c]).join(', ')}.` });
    });

    card.querySelector('[data-clear]').addEventListener('click', async () => {
      if (!slots[d].length) return;
      const old = [...slots[d]];
      const yes = window.ask ? await window.ask({
        tone: 'danger', title: `Limpar os horários de ${NAMES[d]}?`, text: `${old.length} ${old.length === 1 ? 'horário será removido' : 'horários serão removidos'}`,
        details: [`${NAMES[d]} ficará sem atendimento no agendamento do site.`, 'Só vale depois de clicar em "Salvar horários".'],
        confirmText: 'Limpar o dia', cancelText: 'Manter'
      }) : true;
      if (!yes) return;
      slots[d] = [];
      renderAll(); markDirty();
      say({
        type: 'danger', title: `${NAMES[d]} ficou sem horários`, text: 'Ainda não foi salvo.', duration: 9000,
        action: { label: 'Desfazer', onClick: () => { slots[d] = old; renderAll(); markDirty(); } }
      });
    });
  });

  // ---------- datas bloqueadas ----------
  const blockDate = document.getElementById('h-block-date');
  const todayIso = new Date().toISOString().slice(0, 10);
  blockDate.min = todayIso;
  const addBlocked = () => {
    const v = blockDate.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { say({ type: 'error', title: 'Escolha uma data' }); blockDate.focus(); return; }
    if (blocked.includes(v)) { say({ type: 'info', title: `${fmtDate(v)} já está bloqueada` }); return; }
    blocked = [...blocked, v].sort();
    blockDate.value = '';
    renderAll(); markDirty();
    say({ type: 'warn', title: 'Data bloqueada', text: `${fmtDate(v)}: ninguém poderá agendar nesse dia.` });
  };
  document.getElementById('h-block-add').addEventListener('click', addBlocked);
  blockDate.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addBlocked(); } });

  // ---------- regras numéricas ----------
  form.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const input = document.getElementById(b.dataset.for);
    const v = (parseInt(input.value, 10) || 0) + Number(b.dataset.step);
    input.value = Math.min(Number(input.max), Math.max(Number(input.min), v));
    markDirty();
  }));
  form.querySelectorAll('input[type="number"]').forEach((i) => i.addEventListener('input', markDirty));

  // ---------- salvar / sair ----------
  form.addEventListener('submit', () => { dirty = false; });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  renderAll();
})();
