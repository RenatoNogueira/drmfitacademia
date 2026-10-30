// Painel admin: ações dos agendamentos, imagens e galeria.
const toastEl = document.getElementById('toast');
let toastTimer;
const toast = (msg, bad = false) => {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className = `a-toast${bad ? ' bad' : ''}`;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3500);
};

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
    if (statusBtn) {
      const status = statusBtn.dataset.setStatus;
      if (status === 'cancelado' && !confirm(`Cancelar o agendamento de ${card.querySelector('h3').textContent}? O horário volta a ficar livre no site.`)) return;
      busy(card, true);
      try {
        await api('POST', `/admin/api/agendamentos/${card.dataset.id}/status`, { status });
        toast(status === 'confirmado' ? 'Agendamento confirmado.' : status === 'cancelado' ? 'Agendamento cancelado.' : 'Status atualizado.');
        setTimeout(reloadKeepingState, 450);
      } catch (err) { toast(err.message, true); busy(card, false); }
    } else if (delBtn) {
      if (!confirm('Excluir este agendamento? Os dados do aluno serão apagados e isso não pode ser desfeito.')) return;
      busy(card, true);
      try {
        await api('DELETE', `/admin/api/agendamentos/${card.dataset.id}`);
        card.classList.add('is-leaving');
        toast('Agendamento excluído.');
        setTimeout(reloadKeepingState, 350);
      } catch (err) { toast(err.message, true); busy(card, false); }
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
  card.querySelector('[data-reset]')?.addEventListener('click', async () => {
    if (!confirm('Voltar para a foto padrão do site?')) return;
    busy(card, true);
    try { await api('DELETE', `/admin/api/media/${key}`); location.reload(); } catch (err) { toast(err.message, true); busy(card, false); }
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
    if (!confirm('Excluir esta mensagem? Os dados serão apagados.')) return;
    try {
      const wasUnread = box.dataset.read === '0';
      await api('DELETE', `/admin/api/mensagens/${id}`);
      if (wasUnread) adjustDot(-1);
      box.remove();
      toast('Mensagem excluída.');
    } catch (err) { toast(err.message, true); }
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
    if (!confirm('Excluir este depoimento?')) return;
    try { await api('DELETE', `/admin/api/depoimentos/${id}`); location.reload(); } catch (err) { toast(err.message, true); }
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
    list.addEventListener('click', (e) => {
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
        const label = row.querySelector('[data-row-title]')?.textContent || 'este item';
        if (confirm(`Excluir "${label}"? Para desfazer, use "Voltar" ou "Restaurar" antes de sair.`)) {
          const rid = row.querySelector('input[name$="[_id]"]')?.value;
          row.remove();
          if (rid) { const back = list.querySelector(`[data-restore="${CSS.escape(rid)}"]`); if (back) { back.hidden = false; list.querySelector('[data-restore-box]').hidden = false; } }
        }
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
      toast('Alterações salvas. Já estão no site.');
      setTimeout(() => location.reload(), 700);
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  contentForm.querySelector('[data-reset-group]')?.addEventListener('click', async () => {
    if (!confirm('Voltar os textos desta seção para o padrão? As suas edições serão perdidas.')) return;
    try { await api('DELETE', `/admin/api/conteudo/${contentForm.dataset.group}`); location.reload(); } catch (err) { toast(err.message, true); }
  });
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
    if (!confirm('Excluir esta foto da galeria?')) return;
    try { await api('DELETE', `/admin/api/galeria/${id}`); location.reload(); } catch (err) { toast(err.message, true); }
  });
});
