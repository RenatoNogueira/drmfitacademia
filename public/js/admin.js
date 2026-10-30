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
  if (body instanceof FormData) opts.body = body;
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
const shrink = async (file) => {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem (JPG, PNG ou WebP).');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { return file; }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) { bmp.close?.(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
};

const busy = (el, on) => { el.classList.toggle('is-busy', on); el.querySelectorAll('button, input, select').forEach((c) => { c.disabled = on; }); };

// ---- agendamentos ----
document.querySelectorAll('[data-status]').forEach((sel) => {
  let last = sel.value;
  sel.addEventListener('change', async () => {
    const row = sel.closest('tr');
    try {
      await api('POST', `/admin/api/agendamentos/${row.dataset.id}/status`, { status: sel.value });
      sel.className = `a-status s-${sel.value}`;
      last = sel.value;
      toast('Status atualizado.');
    } catch (err) { sel.value = last; toast(err.message, true); }
  });
});
document.querySelectorAll('[data-delete-booking]').forEach((btn) => btn.addEventListener('click', async () => {
  const row = btn.closest('tr');
  if (!confirm('Excluir este agendamento? Os dados do aluno serão apagados.')) return;
  try { await api('DELETE', `/admin/api/agendamentos/${row.dataset.id}`); row.remove(); toast('Agendamento excluído.'); } catch (err) { toast(err.message, true); }
}));

// ---- imagens dos espaços ----
document.querySelectorAll('.a-media[data-key]').forEach((card) => {
  const key = card.dataset.key;
  card.querySelector('[data-upload]')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    busy(card, true);
    try {
      const small = await shrink(file);
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
