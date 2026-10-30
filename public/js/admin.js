// Painel admin: ações dos agendamentos, imagens e galeria.
// Alertas (toast, notify, ask, flash) vêm de admin-ui.js

const api = async (method, url, body) => {
  const opts = { method, headers: { 'X-Requested-With': 'fetch' } };
  if (body instanceof FormData || body instanceof URLSearchParams) opts.body = body;
  else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  let data = {};
  try { data = await res.json(); } catch { /* resposta sem JSON */ }
  if (res.status === 401) { location.href = '/admin/login'; throw new Error('Sessão expirada'); }
  if (!res.ok) throw new Error(data.error || 'Algo deu errado.');
  return data;
};

// Reduz fotos grandes no navegador (a Vercel limita o envio a ~4,5 MB)
const MAX_SIDE = 2000;
const shrink = async (file, maxSide = MAX_SIDE, keepAlpha = false) => {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem (JPG, PNG ou WebP).');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { return file; }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) { bmp.close?.(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  if (!keepAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise((r) => (keepAlpha ? canvas.toBlob(r, 'image/png') : canvas.toBlob(r, 'image/jpeg', 0.86)));
  return blob ? new File([blob], keepAlpha ? 'imagem.png' : 'foto.jpg', { type: keepAlpha ? 'image/png' : 'image/jpeg' }) : file;
};

const busy = (el, on) => { el.classList.toggle('is-busy', on); el.querySelectorAll('button, input, select').forEach((c) => { c.disabled = on; }); };

// ---- agendamentos ----
const bookingList = document.getElementById('b-list');
if (bookingList) {
  // Depois de uma ação, recarrega a lista mantendo a busca e a posição da rolagem
  const reloadKeepingState = () => {
    try { sessionStorage.setItem('b-state', JSON.stringify({ q: document.getElementById('b-search').value, y: window.scrollY })); } catch { /* sem sessionStorage */ }
    location.reload();
  };

  bookingList.addEventListener('click', async (e) => {
    const card = e.target.closest('.b-card');
    if (!card) return;
    const statusBtn = e.target.closest('[data-set-status]');
    const delBtn = e.target.closest('[data-delete-booking]');
    const name = card.querySelector('h3').textContent.trim();
    const dayHead = card.closest('[data-day]').querySelector('.b-day-head');
    const when = `${dayHead.querySelector('strong').textContent} (${dayHead.querySelector('span').textContent}) às ${card.querySelector('.b-time').textContent.trim()}`;
    if (statusBtn) {
      const status = statusBtn.dataset.setStatus;
      if (status === 'cancelado') {
        const yes = await ask({
          tone: 'warn', title: 'Cancelar este agendamento?', text: `${name} — ${when}`,
          details: ['O horário volta a ficar livre para novos agendamentos no site.', 'O aluno não é avisado automaticamente: avise pelo WhatsApp se precisar.'],
          confirmText: 'Sim, cancelar', cancelText: 'Voltar'
        });
        if (!yes) return;
      }
      busy(card, true);
      try {
        await api('POST', `/admin/api/agendamentos/${card.dataset.id}/status`, { status });
        flash(status === 'confirmado'
          ? { type: 'success', title: 'Agendamento confirmado', text: `${name} — ${when}. Avise o aluno pelo WhatsApp.` }
          : status === 'cancelado'
            ? { type: 'warn', title: 'Agendamento cancelado', text: `${name} — ${when}. O horário está livre de novo.` }
            : { type: 'info', title: 'Status atualizado', text: `${name} voltou para "pendente".` });
        reloadKeepingState();
      } catch (err) { notify({ type: 'error', title: 'Não foi possível alterar', text: err.message }); busy(card, false); }
    } else if (delBtn) {
      const yes = await ask({
        tone: 'danger', title: 'Excluir este agendamento?', text: `${name} — ${when}`,
        details: ['Nome, telefone e e-mail do aluno serão apagados.', 'Esta ação não pode ser desfeita.', 'Se só quer liberar o horário, use "Cancelar".'],
        confirmText: 'Excluir definitivamente', cancelText: 'Manter'
      });
      if (!yes) return;
      busy(card, true);
      try {
        await api('DELETE', `/admin/api/agendamentos/${card.dataset.id}`);
        card.classList.add('is-leaving');
        flash({ type: 'danger', title: 'Agendamento excluído', text: `${name} — ${when}. Os dados foram apagados.` });
        setTimeout(reloadKeepingState, 300);
      } catch (err) { notify({ type: 'error', title: 'Não foi possível excluir', text: err.message }); busy(card, false); }
    }
  });

  // Busca instantânea (nome, telefone, e-mail, objetivo)
  const search = document.getElementById('b-search');
  const noResult = document.getElementById('b-noresult');
  const applySearch = () => {
    const q = search.value.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    let shown = 0;
    bookingList.querySelectorAll('[data-day]').forEach((day) => {
      let any = false;
      day.querySelectorAll('.b-card').forEach((c) => {
        const hay = c.dataset.search;
        const ok = !q || hay.includes(q) || (digits.length >= 3 && hay.includes(digits));
        c.hidden = !ok;
        if (ok) { any = true; shown += 1; }
      });
      day.hidden = !any;
    });
    noResult.hidden = shown > 0;
  };
  search.addEventListener('input', applySearch);

  try {
    const saved = JSON.parse(sessionStorage.getItem('b-state') || 'null');
    sessionStorage.removeItem('b-state');
    if (saved) { search.value = saved.q || ''; applySearch(); window.scrollTo(0, saved.y || 0); }
  } catch { /* ignora */ }
}

// Altura do cabeçalho fixo (para barras que ficam coladas logo abaixo dele)
const adminHeader = document.querySelector('.a-header');
const setHeaderH = () => document.documentElement.style.setProperty('--a-header-h', `${adminHeader ? adminHeader.offsetHeight : 0}px`);
setHeaderH();
window.addEventListener('resize', setHeaderH);

// Menu do painel: no celular rola para o item atual
document.querySelector('.a-nav a.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });

// ---- imagens dos espaços ----
document.querySelectorAll('.a-media[data-key]').forEach((card) => {
  const key = card.dataset.key;
  card.querySelector('[data-upload]')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    busy(card, true);
    try {
      const small = await shrink(file, key === 'logo' ? 1200 : MAX_SIDE, key === 'logo'); // logo mantém a transparência (PNG)
      const fd = new FormData();
      fd.append('file', small);
      await api('POST', `/admin/api/media/${key}`, fd);
      toast('Foto atualizada.');
      setTimeout(() => location.reload(), 500);
    } catch (err) { toast(err.message, true); busy(card, false); }
  });
  card.querySelector('[data-remove-media]')?.addEventListener('click', async () => {
    const label = card.querySelector('h3').textContent.trim();
    const custom = Boolean(card.querySelector('.a-badge:not(.a-badge-off)'));
    const yes = await ask({
      tone: 'danger', title: 'Remover esta foto?', text: label,
      image: card.querySelector('.a-thumb img')?.src || '',
      details: [
        'O espaço fica sem foto no site e o layout se ajusta.',
        custom ? 'A foto que você enviou será apagada do armazenamento.' : 'A foto padrão do site deixa de aparecer neste espaço.',
        'Para trazer de volta, use "Restaurar padrão" ou envie uma foto nova.'
      ],
      confirmText: 'Remover foto', cancelText: 'Manter'
    });
    if (!yes) return;
    busy(card, true);
    try {
      await api('POST', `/admin/api/media/${key}/remover`);
      flash({ type: 'danger', title: 'Foto removida', text: `${label}: o espaço ficou sem foto no site.` });
      location.reload();
    } catch (err) { notify({ type: 'error', title: 'Não foi possível remover', text: err.message }); busy(card, false); }
  });
  card.querySelector('[data-restore-media]')?.addEventListener('click', async () => {
    const label = card.querySelector('h3').textContent.trim();
    busy(card, true);
    try {
      await api('POST', `/admin/api/media/${key}/restaurar`);
      flash({ type: 'success', title: 'Foto restaurada', text: `${label}: a foto padrão voltou ao site.` });
      location.reload();
    } catch (err) { notify({ type: 'error', title: 'Não foi possível restaurar', text: err.message }); busy(card, false); }
  });
  card.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const label = card.querySelector('h3').textContent.trim();
    const yes = await ask({
      tone: 'warn', title: 'Voltar para a foto padrão?', text: label,
      image: card.querySelector('.a-thumb img')?.src || '',
      details: ['A foto que você enviou será removida do site e do armazenamento.', 'A foto original do site volta a aparecer no lugar.'],
      confirmText: 'Remover minha foto', cancelText: 'Manter'
    });
    if (!yes) return;
    busy(card, true);
    try {
      await api('DELETE', `/admin/api/media/${key}`);
      flash({ type: 'danger', title: 'Foto removida', text: `${label}: voltou a foto padrão do site.` });
      location.reload();
    } catch (err) { notify({ type: 'error', title: 'Não foi possível remover', text: err.message }); busy(card, false); }
  });
});

// ---- mensagens do contato ----
const adjustDot = (delta) => {
  const dot = document.querySelector('.a-nav .a-dot');
  if (!dot) return;
  const n = Math.max(0, Number(dot.textContent) + delta);
  dot.textContent = n;
  dot.hidden = n === 0;
};
document.querySelectorAll('.a-msg[data-id]').forEach((box) => {
  const id = box.dataset.id;
  const toggleBtn = box.querySelector('[data-toggle-read]');
  const paint = (read) => {
    box.dataset.read = read ? '1' : '0';
    box.classList.toggle('unread', !read);
    box.querySelector('.a-badge-new')?.remove();
    if (toggleBtn) toggleBtn.textContent = read ? 'Marcar como não lida' : 'Marcar como lida';
  };
  const setRead = async (read) => {
    await api('POST', `/admin/api/mensagens/${id}/lida`, { read });
    paint(read);
    adjustDot(read ? -1 : 1);
  };
  // Abrir a mensagem já a marca como lida
  box.addEventListener('toggle', () => {
    if (box.open && box.dataset.read === '0') setRead(true).catch((err) => toast(err.message, true));
  });
  toggleBtn?.addEventListener('click', async () => {
    try { await setRead(box.dataset.read === '0'); } catch (err) { toast(err.message, true); }
  });
  box.querySelector('[data-delete-message]')?.addEventListener('click', async () => {
    const who = box.querySelector('summary strong').childNodes[0].textContent.trim();
    const yes = await ask({
      tone: 'danger', title: 'Excluir esta mensagem?', text: `Mensagem de ${who}`,
      details: ['O texto e os dados de contato serão apagados.', 'Esta ação não pode ser desfeita.', 'Se quer só tirar de "Novas", use "Marcar como lida".'],
      confirmText: 'Excluir definitivamente', cancelText: 'Manter'
    });
    if (!yes) return;
    try {
      const wasUnread = box.dataset.read === '0';
      await api('DELETE', `/admin/api/mensagens/${id}`);
      if (wasUnread) adjustDot(-1);
      box.remove();
      notify({ type: 'danger', title: 'Mensagem excluída', text: `A mensagem de ${who} foi apagada.` });
    } catch (err) { notify({ type: 'error', title: 'Não foi possível excluir', text: err.message }); }
  });
});

// ---- depoimentos ----
const AVATAR_SIDE = 800;
document.querySelectorAll('[data-photo-input]').forEach((input) => {
  input.addEventListener('change', () => {
    const label = input.closest('form')?.querySelector('[data-photo-name]');
    if (label) label.textContent = input.files[0] ? input.files[0].name : 'nenhuma foto';
  });
});
const sendTestimonial = async (form, url) => {
  const fd = new FormData(form);
  const file = form.querySelector('[data-photo-input]')?.files[0];
  if (file) fd.set('photo', await shrink(file, AVATAR_SIDE));
  else fd.delete('photo');
  fd.set('visible', form.querySelector('[name="visible"]').checked ? 'on' : '');
  return api('POST', url, fd);
};
document.querySelector('[data-testimonial-new]')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  busy(form, true);
  try { await sendTestimonial(form, '/admin/api/depoimentos'); toast('Depoimento adicionado.'); setTimeout(() => location.reload(), 500); } catch (err) { toast(err.message, true); busy(form, false); }
});
document.querySelector('[data-testimonial-import]')?.addEventListener('click', async () => {
  try { await api('POST', '/admin/api/depoimentos/importar'); location.reload(); } catch (err) { toast(err.message, true); }
});
document.querySelectorAll('form[data-testimonial][data-id]').forEach((form) => {
  const id = form.dataset.id;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    busy(form, true);
    try { await sendTestimonial(form, `/admin/api/depoimentos/${id}`); toast('Depoimento salvo.'); setTimeout(() => location.reload(), 500); } catch (err) { toast(err.message, true); busy(form, false); }
  });
  form.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', async () => {
    try { await api('POST', `/admin/api/depoimentos/${id}/mover`, { dir: b.dataset.move }); location.reload(); } catch (err) { toast(err.message, true); }
  }));
  form.querySelector('[data-delete-testimonial]')?.addEventListener('click', async () => {
    const who = form.querySelector('[name="name"]').value || form.querySelector('.a-t-head strong').textContent;
    const yes = await ask({
      tone: 'danger', title: 'Excluir este depoimento?', text: who,
      image: form.querySelector('.a-avatar img')?.src || '',
      details: ['O depoimento sai do site agora mesmo.', 'A foto do aluno, se houver, também será apagada.', 'Para só tirar do ar, use "Mostrar no site" desmarcado.'],
      confirmText: 'Excluir depoimento', cancelText: 'Manter'
    });
    if (!yes) return;
    try {
      await api('DELETE', `/admin/api/depoimentos/${id}`);
      flash({ type: 'danger', title: 'Depoimento excluído', text: `${who} não aparece mais no site.` });
      location.reload();
    } catch (err) { notify({ type: 'error', title: 'Não foi possível excluir', text: err.message }); }
  });
});

// ---- máscaras de telefone (campos com data-mask) ----
const maskers = {
  phone: (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`.replace(/-$/, '');
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  },
  // WhatsApp: mostra (98) 98141-9822; o servidor guarda com o 55 na frente
  whatsapp: (v) => {
    let d = v.replace(/\D/g, '');
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    return maskers.phone(d);
  }
};
document.querySelectorAll('input[data-mask]').forEach((input) => {
  const fn = maskers[input.dataset.mask];
  if (!fn) return;
  const apply = () => { const next = fn(input.value); if (next !== input.value) input.value = next; };
  input.addEventListener('input', apply);
  apply();
});

// ---- conteúdo do site ----
const contentForm = document.querySelector('[data-content-form]');
if (contentForm) {
  let dirty = false;
  const removedLabels = []; // nomes dos itens excluídos nesta edição (aparecem no aviso ao salvar)
  const markDirty = () => { dirty = true; };
  contentForm.addEventListener('input', markDirty);
  contentForm.addEventListener('change', markDirty);
  // Reordena os índices dos itens conforme a ordem na tela (o servidor lê pelo número do índice)
  const renumber = () => {
    contentForm.querySelectorAll('[data-list]').forEach((list) => {
      list.querySelectorAll('[data-row]').forEach((row, i) => {
        row.querySelectorAll('[name]').forEach((el) => { el.name = el.name.replace(/\[[^\]]*\]/, `[${i}]`); });
      });
    });
  };
  const updateMoveButtons = (list) => {
    const rows = [...list.querySelectorAll('[data-row]')];
    rows.forEach((row, i) => {
      const up = row.querySelector('[data-row-move="up"]');
      const down = row.querySelector('[data-row-move="down"]');
      if (up) up.disabled = i === 0;
      if (down) down.disabled = i === rows.length - 1;
    });
    const add = list.querySelector('[data-add-row]');
    if (add) add.hidden = rows.length >= Number(list.dataset.max);
    const note = list.querySelector('[data-empty-note]');
    if (note) note.hidden = rows.length > 0;
    const box = list.querySelector('[data-restore-box]');
    if (box) box.hidden = ![...box.querySelectorAll('[data-restore]')].some((b) => !b.hidden);
  };
  contentForm.querySelectorAll('[data-list]').forEach((list) => {
    let counter = list.querySelectorAll('[data-row]').length + 100;
    updateMoveButtons(list);
    list.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      const rows = list.querySelector('[data-rows]');
      if (t.matches('[data-add-row]')) {
        const html = list.querySelector('[data-row-template]').innerHTML.replaceAll('__i__', String(counter++));
        rows.insertAdjacentHTML('beforeend', html);
        rows.lastElementChild.querySelector('input')?.focus();
      } else if (t.matches('[data-restore]')) {
        const id = t.dataset.restore;
        const tpl = list.querySelector(`[data-restore-template="${id}"]`);
        rows.insertAdjacentHTML('beforeend', tpl.innerHTML.replaceAll('__i__', String(counter++)));
        t.hidden = true;
      } else if (t.matches('[data-remove-row]')) {
        const row = t.closest('[data-row]');
        const label = row.querySelector('[data-row-title]')?.textContent.trim() || 'este item';
        const listName = list.querySelector('legend')?.textContent.trim() || 'a lista';
        const yes = await ask({
          tone: 'danger', title: `Excluir "${label}"?`, text: `Item de ${listName}`,
          details: ['O item some do site assim que você clicar em "Salvar alterações".', 'Até lá dá para desfazer: use o botão "Desfazer" do aviso ou "Voltar".'],
          confirmText: 'Excluir item', cancelText: 'Manter'
        });
        if (!yes) return;
        const rid = row.querySelector('input[name$="[_id]"]')?.value;
        const parent = row.parentElement;
        const next = row.nextElementSibling;
        row.remove();
        removedLabels.push(label);
        markDirty();
        if (rid) { const back = list.querySelector(`[data-restore="${CSS.escape(rid)}"]`); if (back) { back.hidden = false; list.querySelector('[data-restore-box]').hidden = false; } }
        updateMoveButtons(list);
        notify({
          type: 'danger', title: `"${label}" excluído da lista`, text: 'Ainda não saiu do site: clique em "Salvar alterações" para publicar.', duration: 9000,
          action: {
            label: 'Desfazer',
            onClick: () => {
              parent.insertBefore(row, next && parent.contains(next) ? next : null);
              const i = removedLabels.lastIndexOf(label); if (i >= 0) removedLabels.splice(i, 1);
              if (rid) list.querySelector(`[data-restore="${CSS.escape(rid)}"]`)?.setAttribute('hidden', '');
              updateMoveButtons(list);
              notify({ type: 'info', title: `"${label}" voltou para a lista` });
            }
          }
        });
        return;
      } else if (t.matches('[data-row-move]')) {
        const row = t.closest('[data-row]');
        if (t.dataset.rowMove === 'up' && row.previousElementSibling) row.previousElementSibling.before(row);
        if (t.dataset.rowMove === 'down' && row.nextElementSibling) row.nextElementSibling.after(row);
      }
      updateMoveButtons(list);
    });
    // O título do cartão acompanha o campo principal
    list.addEventListener('input', (e) => {
      if (!e.target.matches('[data-title-input]')) return;
      const title = e.target.closest('[data-row]').querySelector('[data-row-title]');
      if (title) title.textContent = e.target.value || 'Novo item';
    });
  });
  // Cor: mostra o código ao escolher
  contentForm.querySelectorAll('input[type="color"]').forEach((c) => c.addEventListener('input', () => { c.nextElementSibling.textContent = c.value; }));

  contentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    renumber();
    const btn = contentForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await api('POST', `/admin/api/conteudo/${contentForm.dataset.group}`, new URLSearchParams(new FormData(contentForm)));
      dirty = false;
      flash(removedLabels.length
        ? { type: 'success', title: 'Alterações publicadas', text: `Excluídos do site: ${removedLabels.join(', ')}. Pode levar até 15 segundos para aparecer.`, duration: 8000 }
        : { type: 'success', title: 'Alterações publicadas', text: 'Já estão no site (pode levar até 15 segundos).' });
      location.reload();
    } catch (err) { notify({ type: 'error', title: 'Não foi possível salvar', text: err.message }); btn.disabled = false; }
  });
  contentForm.querySelector('[data-reset-group]')?.addEventListener('click', async () => {
    const title = contentForm.querySelector('.a-content-head h2').textContent.trim();
    const yes = await ask({
      tone: 'warn', title: 'Restaurar os textos padrão?', text: `Seção: ${title}`,
      details: ['Tudo o que você editou nesta seção volta ao original.', 'Itens excluídos voltam para a lista.', 'Esta ação já vale no site, sem precisar salvar.'],
      confirmText: 'Restaurar padrão', cancelText: 'Manter minhas edições'
    });
    if (!yes) return;
    try {
      await api('DELETE', `/admin/api/conteudo/${contentForm.dataset.group}`);
      dirty = false;
      flash({ type: 'info', title: 'Textos restaurados', text: `A seção "${title}" voltou ao padrão.` });
      location.reload();
    } catch (err) { notify({ type: 'error', title: 'Não foi possível restaurar', text: err.message }); }
  });
  // Avisa antes de sair da página com alterações ainda não salvas
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
}

// ---- galeria ----
const galleryInput = document.querySelector('[data-gallery-upload]');
galleryInput?.addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  let done = 0;
  try {
    for (const f of files) {
      toast(`Enviando ${done + 1} de ${files.length}…`);
      const fd = new FormData();
      fd.append('files', await shrink(f));
      await api('POST', '/admin/api/galeria', fd); // uma foto por envio (limite de tamanho da Vercel)
      done += 1;
    }
    toast('Fotos adicionadas.');
    setTimeout(() => location.reload(), 500);
  } catch (err) {
    toast(err.message, true);
    if (done) setTimeout(() => location.reload(), 1500);
  }
});
document.querySelector('[data-gallery-import]')?.addEventListener('click', async () => {
  try { await api('POST', '/admin/api/galeria/importar'); location.reload(); } catch (err) { toast(err.message, true); }
});
document.querySelectorAll('.a-gallery .a-media').forEach((card) => {
  const id = card.dataset.id;
  card.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', async () => {
    try { await api('POST', `/admin/api/galeria/${id}/mover`, { dir: b.dataset.move }); location.reload(); } catch (err) { toast(err.message, true); }
  }));
  card.querySelector('[data-delete-photo]')?.addEventListener('click', async () => {
    const n = card.querySelector('.a-badge')?.textContent.trim();
    const yes = await ask({
      tone: 'danger', title: 'Excluir esta foto da galeria?', text: n ? `Foto ${n}` : '',
      image: card.querySelector('.a-thumb img')?.src || '',
      details: ['A foto sai da galeria do site agora mesmo.', 'O arquivo enviado também é apagado.'],
      confirmText: 'Excluir foto', cancelText: 'Manter'
    });
    if (!yes) return;
    try {
      await api('DELETE', `/admin/api/galeria/${id}`);
      flash({ type: 'danger', title: 'Foto excluída', text: 'A foto saiu da galeria.' });
      location.reload();
    } catch (err) { notify({ type: 'error', title: 'Não foi possível excluir', text: err.message }); }
  });
});
