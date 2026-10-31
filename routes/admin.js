// Painel administrativo: agendamentos, horários, imagens e galeria.
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const auth = require('../lib/auth');
const store = require('../lib/store');
const media = require('../lib/media');
const content = require('../lib/content');
const agendaLib = require('../lib/agenda');
const { slots, slotKeys } = require('../lib/slots');
const siteContent = require('../lib/siteContent');
const { fmtPhone } = require('../lib/format');
const pix = require('../lib/pix');
const pay = require('../lib/payments');
const schema = require('../lib/siteSchema');
const { getAgenda } = require('./api');

const router = express.Router();
router.use(express.urlencoded({ extended: true, limit: '200kb', parameterLimit: 3000 }));
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


// Traduz erros do banco em dicas para quem administra (esta tela só aparece depois do login)
const explain = (err) => {
  const msg = String(err?.message || err);
  const code = String(err?.code || '');
  let hint = 'Veja os logs da função na Vercel (Deployments → Functions/Logs) para mais detalhes.';
  if (code === 'PGRST205' || code === '42P01' || /could not find the table|does not exist|schema cache/i.test(msg)) {
    hint = 'As tabelas ainda não existem neste projeto Supabase. Rode o arquivo supabase/schema.sql no SQL Editor (do mesmo projeto da SUPABASE_URL).';
  } else if (/invalid api key|jwt|unauthori[sz]ed|permission denied|apikey/i.test(msg) || code === '42501' || code === 'PGRST301') {
    hint = 'O Supabase recusou a chave. Confira se SUPABASE_SECRET_KEY é a chave SECRETA (sb_secret_...), copiada inteira, do mesmo projeto da SUPABASE_URL.';
  } else if (/fetch failed|enotfound|invalid url|econnrefused/i.test(msg)) {
    hint = 'Não foi possível falar com o Supabase. Confira se SUPABASE_URL está certa (https://SEU-PROJETO.supabase.co, sem barra no final).';
  } else if (/bucket not found/i.test(msg)) {
    hint = 'O bucket de imagens não existe. Rode o supabase/schema.sql ou crie um bucket público chamado "media" em Storage.';
  }
  return `${hint} (Detalhe técnico: ${msg.slice(0, 200)})`;
};

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
  console.error('admin:', err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Erro no servidor. Tente de novo.' });
  res.status(500).render('admin/setup', { title: 'Erro | Admin DRMFIT', problem: explain(err) });
});

// Contador de mensagens novas para o menu (se a tabela ainda não existir, mostra 0)
router.use(async (req, res, next) => {
  res.locals.unreadMessages = 0;
  res.locals.pendingPayments = 0;
  if (!req.path.startsWith('/api/')) {
    try { res.locals.unreadMessages = await store.countUnreadMessages(); } catch { /* sem tabela ainda */ }
    try { res.locals.pendingPayments = await store.countPendingPayments(); } catch { /* sem tabela ainda */ }
  }
  next();
});

// ---------- agendamentos ----------
const STATUSES = ['pendente', 'confirmado', 'cancelado'];
const waLink = (phone, text) => {
  const d = String(phone).replace(/\D/g, '');
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}?text=${encodeURIComponent(text)}`;
};

const brDate = (d) => d.split('-').reverse().join('/');

router.get('/agendamentos', wrap(async (req, res) => {
  const all = await store.listBookings();
  const now = agendaLib.nowInTz();
  const today = now.date;
  const tomorrow = agendaLib.addDays(today, 1);
  const in7 = agendaLib.addDays(today, 7);
  const active = (b) => b.status !== 'cancelado';
  const FILTERS = ['hoje', 'proximos', 'pendentes', 'passados', 'todos'];
  const filter = FILTERS.includes(req.query.f) ? req.query.f : 'proximos';

  const stats = {
    hoje: all.filter((b) => b.date === today && active(b)).length,
    semana: all.filter((b) => b.date >= today && b.date <= in7 && active(b)).length,
    pendentes: all.filter((b) => b.status === 'pendente' && b.date >= today).length,
    total: all.filter(active).length
  };
  const counts = {
    hoje: stats.hoje,
    proximos: all.filter((b) => b.date >= today && active(b)).length,
    pendentes: all.filter((b) => b.status === 'pendente').length,
    passados: all.filter((b) => b.date < today).length,
    todos: all.length
  };

  let list = all; // já vem ordenado por data e hora
  if (filter === 'hoje') list = all.filter((b) => b.date === today && active(b));
  if (filter === 'proximos') list = all.filter((b) => b.date >= today && active(b));
  if (filter === 'pendentes') list = all.filter((b) => b.status === 'pendente');
  if (filter === 'passados') list = all.filter((b) => b.date < today).reverse();

  const rows = list.map((b) => {
    const time = String(b.time).slice(0, 5);
    const first = String(b.name).split(' ')[0];
    const digits = String(b.phone).replace(/\D/g, '');
    return {
      ...b,
      time,
      phoneFmt: fmtPhone(b.phone),
      tel: `tel:+${digits.length <= 11 ? `55${digits}` : digits}`,
      isNew: Date.now() - new Date(b.created_at).getTime() < 24 * 60 * 60 * 1000,
      past: b.date < today,
      search: `${b.name} ${digits} ${b.email || ''} ${b.objective || ''}`.toLowerCase(),
      wa: waLink(b.phone, `Olá, ${first}! Aqui é da ${res.locals.site.brand.name}. Sua avaliação física está marcada para ${brDate(b.date)} às ${time}. Podemos confirmar?`)
    };
  });

  // Agrupa por dia ("Hoje", "Amanhã", "Quarta"...)
  const groups = [];
  rows.forEach((r) => {
    let g = groups[groups.length - 1];
    if (!g || g.date !== r.date) {
      g = { date: r.date, label: r.date === today ? 'Hoje' : r.date === tomorrow ? 'Amanhã' : agendaLib.WEEKDAYS[agendaLib.weekdayOf(r.date)], sub: brDate(r.date), items: [] };
      groups.push(g);
    }
    g.items.push(r);
  });

  res.render('admin/bookings', { title: 'Agendamentos | Admin DRMFIT', groups, total: rows.length, filter, counts, stats, today: brDate(today) });
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

// ---------- mensagens do formulário de contato ----------
const fmtDateTime = (iso) => new Intl.DateTimeFormat('pt-BR', { timeZone: agendaLib.TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

router.get('/mensagens', wrap(async (req, res) => {
  const all = await store.listMessages();
  const filter = req.query.f === 'todas' ? 'todas' : 'novas';
  const counts = { novas: all.filter((m) => !m.read).length, todas: all.length };
  const list = filter === 'novas' ? all.filter((m) => !m.read) : all;
  const rows = list.map((m) => {
    const first = String(m.name).split(' ')[0];
    return {
      ...m,
      when: fmtDateTime(m.created_at),
      phoneFmt: fmtPhone(m.phone),
      wa: waLink(m.phone, `Olá, ${first}! Aqui é da DRMFIT. Recebemos sua mensagem pelo site e estamos retornando.`),
      mail: `mailto:${m.email}?subject=${encodeURIComponent('Sua mensagem para a DRMFIT')}`
    };
  });
  res.render('admin/messages', { title: 'Mensagens | Admin DRMFIT', rows, filter, counts });
}));

router.post('/api/mensagens/:id/lida', wrap(async (req, res) => {
  const ok = await store.setMessageRead(req.params.id, req.body?.read !== false);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Mensagem não encontrada.' });
}));

router.delete('/api/mensagens/:id', wrap(async (req, res) => {
  const ok = await store.deleteMessage(req.params.id);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Mensagem não encontrada.' });
}));

// ---------- pagamentos por PIX (assinaturas de planos) ----------
const PAY_FILTERS = ['analise', 'aguardando', 'confirmados', 'recusados', 'todos'];

router.get('/pagamentos', wrap(async (req, res) => {
  const all = await store.listSubscriptions();
  const filter = PAY_FILTERS.includes(req.query.f) ? req.query.f : 'analise';
  const by = (st) => all.filter((s) => s.status === st);
  const counts = { analise: by('em_analise').length, aguardando: by('aguardando_pagamento').length, confirmados: by('confirmado').length, recusados: by('recusado').length, todos: all.length };
  const received = by('confirmado').reduce((sum, s) => sum + (s.amount_cents || 0), 0);
  const list = filter === 'todos' ? all : all.filter((s) => s.status === ({ analise: 'em_analise', aguardando: 'aguardando_pagamento', confirmados: 'confirmado', recusados: 'recusado' })[filter]);
  const site = res.locals.site;
  const rows = list.map((s) => ({
    ...s,
    amountLabel: s.amount_cents ? pix.fmtBRL(s.amount_cents) : 'valor livre',
    statusLabel: pay.STATUS[s.status] || s.status,
    phoneFmt: fmtPhone(s.phone),
    createdLabel: fmtDateTime(s.created_at),
    receiptLabel: s.receipt_at ? fmtDateTime(s.receipt_at) : '',
    isPdf: s.receipt_type === 'application/pdf',
    wa: waLink(s.phone, s.status === 'confirmado'
      ? `Olá, ${String(s.name).split(' ')[0]}! Aqui é da ${site.brand.name}. Seu pagamento do plano ${s.plan} (protocolo ${s.protocol}) foi confirmado. Bem-vindo(a)! Vamos combinar o início?`
      : s.status === 'recusado'
        ? `Olá, ${String(s.name).split(' ')[0]}! Aqui é da ${site.brand.name}. Não conseguimos confirmar o comprovante do plano ${s.plan} (protocolo ${s.protocol})${s.reject_reason ? `: ${s.reject_reason}` : ''}. Pode enviar novamente?`
        : `Olá, ${String(s.name).split(' ')[0]}! Aqui é da ${site.brand.name}. Recebemos seu pedido do plano ${s.plan} (protocolo ${s.protocol}).`)
  }));
  const payProblems = await pay.problems(site, { storeReady: store.ready, hasImage: Boolean((await media.helpers()).img('pix-qr')) });
  res.render('admin/payments', { title: 'Pagamentos | Admin DRMFIT', rows, filter, counts, received: pix.fmtBRL(received), site, payProblems });
}));

router.post('/api/pagamentos/:id/confirmar', wrap(async (req, res) => {
  const s = await store.updateSubscription(req.params.id, { status: 'confirmado', reject_reason: null, decided_at: new Date().toISOString() });
  res.status(s ? 200 : 404).json(s ? { ok: true } : { error: 'Pagamento não encontrado.' });
}));

router.post('/api/pagamentos/:id/recusar', wrap(async (req, res) => {
  const reason = agendaLib.cleanText(req.body?.reason, 200);
  if (reason.length < 3) return res.status(400).json({ error: 'Explique o motivo para o aluno (mín. 3 letras).' });
  const s = await store.updateSubscription(req.params.id, { status: 'recusado', reject_reason: reason, decided_at: new Date().toISOString() });
  res.status(s ? 200 : 404).json(s ? { ok: true } : { error: 'Pagamento não encontrado.' });
}));

router.post('/api/pagamentos/:id/reabrir', wrap(async (req, res) => {
  const cur = await store.getSubscription(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Pagamento não encontrado.' });
  await store.updateSubscription(cur.id, { status: cur.receipt_path ? 'em_analise' : 'aguardando_pagamento', decided_at: null });
  res.json({ ok: true });
}));

router.delete('/api/pagamentos/:id', wrap(async (req, res) => {
  const out = await store.deleteSubscription(req.params.id);
  if (!out) return res.status(404).json({ error: 'Pagamento não encontrado.' });
  if (out.receipt_path) await store.removePrivate(out.receipt_path);
  res.json({ ok: true });
}));

// Comprovante: só com login de administrador; o tipo vem do conteúdo conferido no envio
router.get('/comprovantes/:id', wrap(async (req, res) => {
  const s = await store.getSubscription(req.params.id);
  const type = s && s.receipt_type;
  if (!s || !s.receipt_path || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(type)) return res.status(404).send('Comprovante não encontrado.');
  const buf = await store.readPrivate(s.receipt_path);
  if (!buf) return res.status(404).send('Arquivo não encontrado.');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[type];
  res.set({
    'Content-Type': type,
    'Content-Disposition': `inline; filename="comprovante-${s.protocol}.${ext}"`,
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    'Cache-Control': 'private, no-store'
  });
  res.send(buf);
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

// Imagens "removidas": o espaço fica sem foto no site (a lista fica em settings.media_hidden)
const getHidden = async () => {
  const v = await store.getSetting('media_hidden');
  return new Set(Array.isArray(v) ? v : []);
};
const saveHidden = async (set) => { await store.setSetting('media_hidden', [...set]); media.invalidate(); };

router.get('/imagens', wrap(async (req, res) => {
  const map = await store.getMedia();
  const hidden = await getHidden();
  const items = slots.map((s) => ({
    ...s,
    custom: Boolean(map[s.key]),
    removed: hidden.has(s.key),
    current: hidden.has(s.key) ? null : (map[s.key]?.url || media.findLocal(s.key, media.IMG_EXT) || s.fallback || null)
  }));
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
    const hidden = await getHidden();
    if (hidden.delete(req.params.key)) await saveHidden(hidden); // enviar uma foto nova "devolve" o espaço
    media.invalidate();
    res.json({ ok: true, url: saved.url });
  } catch (err) { if (!fail(res, err)) throw err; }
}));

router.delete('/api/media/:key', wrap(async (req, res) => {
  if (!slotKeys.has(req.params.key)) return res.status(404).json({ error: 'Espaço de imagem desconhecido.' });
  const old = await store.deleteMedia(req.params.key);
  if (old) await store.removeFile(old);
  const hidden = await getHidden();
  if (hidden.delete(req.params.key)) await saveHidden(hidden);
  media.invalidate();
  res.json({ ok: true, fallback: media.findLocal(req.params.key, media.IMG_EXT) });
}));

// Remover: apaga a foto enviada (se houver) e deixa o espaço sem imagem no site
router.post('/api/media/:key/remover', wrap(async (req, res) => {
  if (!slotKeys.has(req.params.key)) return res.status(404).json({ error: 'Espaço de imagem desconhecido.' });
  const old = await store.deleteMedia(req.params.key);
  if (old) await store.removeFile(old);
  const hidden = await getHidden();
  hidden.add(req.params.key);
  await saveHidden(hidden);
  res.json({ ok: true, deletedFile: Boolean(old) });
}));

// Restaurar: o espaço volta a mostrar a foto padrão do site
router.post('/api/media/:key/restaurar', wrap(async (req, res) => {
  if (!slotKeys.has(req.params.key)) return res.status(404).json({ error: 'Espaço de imagem desconhecido.' });
  const hidden = await getHidden();
  hidden.delete(req.params.key);
  await saveHidden(hidden);
  res.json({ ok: true });
}));

// ---------- depoimentos ("Alunos que transformaram a rotina") ----------
const parseId = (v) => (/^\d+$/.test(v) ? Number(v) : v);

// Lê e valida os campos do formulário (multipart)
const readTestimonial = (body) => {
  const data = {
    name: agendaLib.cleanText(body.name, 60),
    result: agendaLib.cleanText(body.result, 30) || null,
    quote: String(body.quote || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 400),
    visible: body.visible === 'on' || body.visible === 'true' || body.visible === '1'
  };
  const errors = {};
  if (data.name.length < 2) errors.name = 'Informe o nome do aluno.';
  if (data.quote.length < 10) errors.quote = 'Escreva o depoimento (mínimo 10 letras).';
  return { data, errors };
};

router.get('/depoimentos', wrap(async (req, res) => {
  const items = await store.listTestimonials();
  res.render('admin/testimonials', { title: 'Depoimentos | Admin DRMFIT', items, defaults: require('../lib/content').defaults() });
}));

router.post('/api/depoimentos', uploadErrors(upload.single('photo')), wrap(async (req, res) => {
  const { data, errors } = readTestimonial(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0], errors });
  try {
    if (req.file) { const saved = await storeImage('depoimentos', req.file); data.photo_url = saved.url; data.photo_path = saved.path; }
    const item = await store.createTestimonial(data);
    content.invalidate();
    res.status(201).json({ ok: true, id: item.id });
  } catch (err) { if (!fail(res, err)) throw err; }
}));

router.post('/api/depoimentos/importar', wrap(async (req, res) => {
  if ((await store.listTestimonials()).length) return res.status(409).json({ error: 'Já existem depoimentos cadastrados.' });
  for (const t of content.defaults()) await store.createTestimonial({ name: t.name, result: t.result, quote: t.quote, visible: true });
  content.invalidate();
  res.json({ ok: true });
}));

router.post('/api/depoimentos/:id', uploadErrors(upload.single('photo')), wrap(async (req, res) => {
  const { data, errors } = readTestimonial(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0], errors });
  try {
    if (req.file) { const saved = await storeImage('depoimentos', req.file); data.photo_url = saved.url; data.photo_path = saved.path; }
    else if (req.body.remove_photo === '1') { data.photo_url = null; data.photo_path = null; }
    const out = await store.updateTestimonial(parseId(req.params.id), data);
    if (!out) return res.status(404).json({ error: 'Depoimento não encontrado.' });
    if (out.oldPath) await store.removeFile(out.oldPath);
    content.invalidate();
    res.json({ ok: true, photo_url: data.photo_url });
  } catch (err) { if (!fail(res, err)) throw err; }
}));

router.post('/api/depoimentos/:id/mover', wrap(async (req, res) => {
  await store.moveTestimonial(parseId(req.params.id), req.body?.dir === 'up' ? 'up' : 'down');
  content.invalidate();
  res.json({ ok: true });
}));

router.delete('/api/depoimentos/:id', wrap(async (req, res) => {
  const out = await store.deleteTestimonial(parseId(req.params.id));
  if (!out) return res.status(404).json({ error: 'Depoimento não encontrado.' });
  if (out.path) await store.removeFile(out.path);
  content.invalidate();
  res.json({ ok: true });
}));

// ---------- conteúdo do site (textos, contato, cores...) ----------
router.get('/conteudo', wrap(async (req, res) => {
  const group = schema.byId[req.query.g] || schema.groups[0];
  const current = await siteContent.get();
  const overrides = await siteContent.getOverrides();
  const edited = new Set(schema.groups.filter((g) => schema.flat(g).some((f) => f.path in overrides)).map((g) => g.id));
  let pixPreview = null;
  let payProblems = null;
  if (group.id === 'pagamento' || group.id === 'planos') {
    pay.resetHealth();
    payProblems = await pay.problems(current, { storeReady: store.ready, hasImage: Boolean((await media.helpers()).img('pix-qr')) });
  }
  if (group.id === 'pagamento') {
    const c = current.pix;
    const amountCents = pix.parseAmountCents(current.plans[0]?.price);
    pixPreview = { enabled: c.enabled, mode: c.qrMode, plan: current.plans[0]?.name || '' };
    try {
      if (c.qrMode === 'image') {
        const imageUrl = (await media.helpers()).img('pix-qr');
        if (!imageUrl) pixPreview.error = 'Nenhuma imagem de QR Code enviada ainda. Envie em Imagens → Pagamento.';
        else Object.assign(pixPreview, { imageUrl, copyPaste: c.copyPaste });
      } else {
        const info = await pay.pixInfo(current, { amountCents, imageUrl: null });
        Object.assign(pixPreview, { svg: info.svg, copyPaste: info.copyPaste, amountLabel: info.amountLabel, receiver: info.receiver, city: info.city });
      }
    } catch (err) { pixPreview.error = err.message; }
  }
  res.render('admin/content', { title: 'Conteúdo | Admin DRMFIT', groups: schema.groups, group, current, S: schema, edited, pixPreview, payProblems });
}));

router.post('/api/conteudo/:group', wrap(async (req, res) => {
  const group = schema.byId[req.params.group];
  if (!group) return res.status(404).json({ error: 'Grupo desconhecido.' });
  const { values, error } = schema.parseGroup(group, req.body || {});
  if (error) return res.status(400).json({ error });
  const overrides = await siteContent.getOverrides();
  Object.assign(overrides, values);
  await siteContent.saveOverrides(overrides);
  res.json({ ok: true });
}));

router.delete('/api/conteudo/:group', wrap(async (req, res) => {
  const group = schema.byId[req.params.group];
  if (!group) return res.status(404).json({ error: 'Grupo desconhecido.' });
  const overrides = await siteContent.getOverrides();
  schema.flat(group).forEach((f) => { delete overrides[f.path]; });
  await siteContent.saveOverrides(overrides);
  res.json({ ok: true });
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

// Qualquer erro não tratado no painel (inclusive ao montar a página) mostra o motivo, em vez de uma página em branco
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) return next(err); // JSON quebrado, corpo grande: erro do pedido, não do painel
  console.error('admin (erro):', err);
  if (res.headersSent) return;
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Erro no servidor. Tente de novo.' });
  res.status(500).render('admin/setup', { title: 'Erro | Admin DRMFIT', problem: explain(err) }, (e, html) => {
    if (e) return res.status(500).type('text').send(`Erro no painel: ${err.message}`);
    res.send(html);
  });
});

module.exports = router;
