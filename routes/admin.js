// Painel administrativo: agendamentos, horários, imagens e galeria.
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const auth = require('../lib/auth');
const store = require('../lib/store');
const media = require('../lib/media');
const agendaLib = require('../lib/agenda');
const { slots, slotKeys } = require('../lib/slots');
const site = require('../data/site');
const { getAgenda } = require('./api');

const router = express.Router();
router.use(express.urlencoded({ extended: false, limit: '50kb' }));
router.use(express.json({ limit: '20kb' }));
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.locals.adminPath = req.path;
  res.locals.storeName = store.name;
  res.locals.storeProblem = store.problem;
  next();
});
router.use(auth.sameOrigin);

// ---------- login ----------
router.get('/login', (req, res) => {
  if (auth.isAuthed(req)) return res.redirect('/admin/agendamentos');
  res.render('admin/login', { title: 'Entrar | Admin DRMFIT', error: null, disabled: !auth.enabled() });
});

router.post('/login', (req, res) => {
  const render = (error, status = 401) => res.status(status).render('admin/login', { title: 'Entrar | Admin DRMFIT', error, disabled: !auth.enabled() });
  if (!auth.enabled()) return render('O painel está desativado: defina ADMIN_PASSWORD no servidor.', 503);
  if (auth.tooMany(req.ip)) return render('Muitas tentativas. Aguarde 15 minutos.', 429);
  if (!auth.checkPassword(req.body.password || '')) { auth.registerFail(req.ip); return render('Senha incorreta.'); }
  auth.clearFails(req.ip);
  auth.setSession(req, res);
  res.redirect('/admin/agendamentos');
});

router.post('/logout', (req, res) => { auth.clearSession(res); res.redirect('/admin/login'); });

// Tudo abaixo exige login
router.use(auth.requireAuth);
router.get('/', (req, res) => res.redirect('/admin/agendamentos'));

const needStore = (req, res, next) => {
  if (store.ready) return next();
  if (req.path.startsWith('/api/')) return res.status(503).json({ error: store.problem });
  return res.status(503).render('admin/setup', { title: 'Configuração | Admin DRMFIT', problem: store.problem });
};
router.use(needStore);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
  console.error('admin:', err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Erro no servidor. Tente de novo.' });
  res.status(500).render('admin/setup', { title: 'Erro | Admin DRMFIT', problem: 'Ocorreu um erro ao acessar os dados. Veja os logs do servidor.' });
});

// ---------- agendamentos ----------
const STATUSES = ['pendente', 'confirmado', 'cancelado'];
const waLink = (phone, text) => {
  const d = String(phone).replace(/\D/g, '');
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}?text=${encodeURIComponent(text)}`;
};

router.get('/agendamentos', wrap(async (req, res) => {
  const all = await store.listBookings();
  const today = agendaLib.nowInTz().date;
  const filter = ['proximos', 'pendentes', 'passados', 'todos'].includes(req.query.f) ? req.query.f : 'proximos';
  const counts = {
    proximos: all.filter((b) => b.date >= today && b.status !== 'cancelado').length,
    pendentes: all.filter((b) => b.status === 'pendente').length,
    passados: all.filter((b) => b.date < today).length,
    todos: all.length
  };
  let list = all;
  if (filter === 'proximos') list = all.filter((b) => b.date >= today && b.status !== 'cancelado');
  if (filter === 'pendentes') list = all.filter((b) => b.status === 'pendente');
  if (filter === 'passados') list = all.filter((b) => b.date < today).reverse();
  const rows = list.map((b) => ({
    ...b,
    time: String(b.time).slice(0, 5),
    dateLabel: `${agendaLib.WEEKDAYS_SHORT[agendaLib.weekdayOf(b.date)]}, ${b.date.split('-').reverse().join('/')}`,
    wa: waLink(b.phone, `Olá, ${b.name}! Aqui é da DRMFIT. Sua avaliação física está marcada para ${b.date.split('-').reverse().join('/')} às ${String(b.time).slice(0, 5)}. Podemos confirmar?`)
  }));
  res.render('admin/bookings', { title: 'Agendamentos | Admin DRMFIT', rows, filter, counts, statuses: STATUSES });
}));

router.post('/api/agendamentos/:id/status', wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  try {
    const ok = await store.updateBookingStatus(req.params.id, status);
    if (!ok) return res.status(404).json({ error: 'Agendamento não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'SLOT_TAKEN') return res.status(409).json({ error: 'Esse horário já foi ocupado por outro aluno.' });
    throw err;
  }
}));

router.delete('/api/agendamentos/:id', wrap(async (req, res) => {
  const ok = await store.deleteBooking(req.params.id);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Agendamento não encontrado.' });
}));

// Exporta CSV (protege contra injeção de fórmulas em planilhas)
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
router.get('/agendamentos.csv', wrap(async (req, res) => {
  const all = await store.listBookings();
  const head = ['Data', 'Horário', 'Nome', 'Telefone', 'E-mail', 'Objetivo', 'Observações', 'Status', 'Criado em'];
  const lines = all.map((b) => [b.date, String(b.time).slice(0, 5), b.name, b.phone, b.email, b.objective, b.notes, b.status, b.created_at].map(csvCell).join(';'));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="agendamentos-drmfit.csv"' });
  res.send(`\ufeff${[head.map(csvCell).join(';'), ...lines].join('\r\n')}`);
}));

// ---------- horários de avaliação ----------
router.get('/horarios', wrap(async (req, res) => {
  const agenda = await getAgenda();
  res.render('admin/schedule', { title: 'Horários | Admin DRMFIT', agenda, weekdays: agendaLib.WEEKDAYS, saved: req.query.ok === '1', error: null });
}));

router.post('/horarios', wrap(async (req, res) => {
  const slotsByDay = {};
  const bad = [];
  for (let d = 0; d < 7; d++) {
    const raw = String(req.body[`slots_${d}`] || '');
    const times = raw.split(/[,;\s]+/).filter(Boolean).map((t) => (/^\d:\d{2}$/.test(t) ? `0${t}` : t));
    times.forEach((t) => { if (!agendaLib.TIME_RE.test(t)) bad.push(`${agendaLib.WEEKDAYS[d]}: "${t}"`); });
    slotsByDay[d] = times;
  }
  const blocked = String(req.body.blocked || '').split(/[,;\s]+/).filter(Boolean);
  blocked.forEach((b) => { if (!agendaLib.isValidDate(b)) bad.push(`Data bloqueada: "${b}"`); });
  const draft = agendaLib.normalizeAgenda({ daysAhead: req.body.daysAhead, minNoticeHours: req.body.minNoticeHours, blocked, slots: slotsByDay });
  if (bad.length) {
    return res.status(400).render('admin/schedule', { title: 'Horários | Admin DRMFIT', agenda: draft, weekdays: agendaLib.WEEKDAYS, saved: false, error: `Formato inválido: ${bad.join('; ')}. Use horários como 08:00 e datas como 2026-12-25.` });
  }
  await store.setSetting('agenda', draft);
  res.redirect('/admin/horarios?ok=1');
}));

// ---------- imagens ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 10 } });
const uploadErrors = (handler) => (req, res, next) => handler(req, res, (err) => {
  if (!err) return next();
  const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo grande demais (máx. 4 MB).' : 'Falha no envio do arquivo.';
  res.status(400).json({ error: msg });
});

// Confere o tipo real do arquivo pelos primeiros bytes (não confia no nome nem no Content-Type)
const sniff = (buf) => {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', type: 'image/png' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
};
const storeImage = async (folder, file) => {
  const kind = sniff(file.buffer);
  if (!kind) { const e = new Error('Envie uma imagem JPG, PNG ou WebP.'); e.status = 400; throw e; }
  return store.uploadFile(file.buffer, `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${kind.ext}`, kind.type);
};
const fail = (res, err) => (err.status ? res.status(err.status).json({ error: err.message }) : null);

router.get('/imagens', wrap(async (req, res) => {
  const map = await store.getMedia();
  const items = slots.map((s) => ({ ...s, custom: Boolean(map[s.key]), current: map[s.key]?.url || media.findLocal(s.key, media.IMG_EXT) }));
  const groups = [...new Set(items.map((i) => i.group))].map((g) => ({ name: g, items: items.filter((i) => i.group === g) }));
  res.render('admin/media', { title: 'Imagens | Admin DRMFIT', groups });
}));

router.post('/api/media/:key', uploadErrors(upload.single('file')), wrap(async (req, res) => {
  if (!slotKeys.has(req.params.key)) return res.status(404).json({ error: 'Espaço de imagem desconhecido.' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const saved = await storeImage(`slots/${req.params.key}`, req.file);
    const old = await store.setMedia(req.params.key, saved.url, saved.path);
    if (old) await store.removeFile(old);
    media.invalidate();
    res.json({ ok: true, url: saved.url });
  } catch (err) { if (!fail(res, err)) throw err; }
}));

router.delete('/api/media/:key', wrap(async (req, res) => {
  if (!slotKeys.has(req.params.key)) return res.status(404).json({ error: 'Espaço de imagem desconhecido.' });
  const old = await store.deleteMedia(req.params.key);
  if (old) await store.removeFile(old);
  media.invalidate();
  res.json({ ok: true, fallback: media.findLocal(req.params.key, media.IMG_EXT) });
}));

// ---------- galeria ----------
router.get('/galeria', wrap(async (req, res) => {
  const items = await store.listGallery();
  res.render('admin/gallery', { title: 'Galeria | Admin DRMFIT', items, defaults: media.localGallery() });
}));

router.post('/api/galeria', uploadErrors(upload.array('files', 10)), wrap(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    for (const f of req.files) {
      const saved = await storeImage('galeria', f);
      await store.addGallery(saved.url, saved.path);
    }
    media.invalidate();
    res.json({ ok: true, count: req.files.length });
  } catch (err) { if (!fail(res, err)) throw err; }
}));

router.post('/api/galeria/importar', wrap(async (req, res) => {
  if ((await store.listGallery()).length) return res.status(409).json({ error: 'A galeria já tem fotos.' });
  for (const url of media.localGallery()) await store.addGallery(url, null);
  media.invalidate();
  res.json({ ok: true });
}));

router.post('/api/galeria/:id/mover', wrap(async (req, res) => {
  const dir = req.body?.dir === 'up' ? 'up' : 'down';
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : req.params.id;
  await store.moveGallery(id, dir);
  media.invalidate();
  res.json({ ok: true });
}));

router.delete('/api/galeria/:id', wrap(async (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : req.params.id;
  const old = await store.deleteGallery(id);
  if (old) await store.removeFile(old);
  media.invalidate();
  res.json({ ok: true });
}));

module.exports = router;
