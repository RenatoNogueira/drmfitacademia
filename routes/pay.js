// API pública do pagamento por PIX: criar pedido (gera o QR), enviar comprovante e consultar o andamento.
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const store = require('../lib/store');
const siteContent = require('../lib/siteContent');
const media = require('../lib/media');
const pix = require('../lib/pix');
const pay = require('../lib/payments');
const { cleanText } = require('../lib/agenda');

const router = express.Router();
router.use(express.json({ limit: '20kb' }));
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } });

// Limite de pedidos por IP (em memória)
const hits = new Map();
const limited = (kind, ip, max) => {
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
};

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
  console.error('pagamento:', err.message);
  res.status(500).json({ error: 'Não foi possível concluir agora. Tente de novo ou fale conosco pelo WhatsApp.' });
});

// Pagamento disponível? (ativado, banco configurado e QR/chave válidos)
const context = async () => {
  const site = await siteContent.get();
  const helpers = await media.helpers();
  const imageUrl = helpers.img('pix-qr');
  const ready = pay.isReady(site, { storeReady: store.ready, hasImage: Boolean(imageUrl) });
  return { site, imageUrl, ready };
};

const present = async (ctx, sub) => ({
  id: sub.id,
  protocol: sub.protocol,
  plan: sub.plan,
  status: sub.status,
  statusLabel: pay.STATUS[sub.status] || sub.status,
  rejectReason: sub.reject_reason || null,
  hasReceipt: Boolean(sub.receipt_path),
  pix: await pay.pixInfo(ctx.site, { amountCents: sub.amount_cents, imageUrl: ctx.imageUrl })
});

const unavailable = (res) => res.status(503).json({ error: 'O pagamento online está indisponível no momento. Fale conosco pelo WhatsApp.' });

// 1) Aluno escolhe o plano e informa os dados -> gera o pedido e o QR Code
router.post('/assinaturas', wrap(async (req, res) => {
  const ctx = await context();
  if (!ctx.ready) return unavailable(res);
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // campo-isca para robôs
  if (limited('create', req.ip, 10)) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });

  const plan = ctx.site.plans.find((p) => p.name === cleanText(b.plan, 40));
  const errors = {};
  if (!plan) errors.plan = 'Plano não encontrado. Atualize a página.';
  const name = cleanText(b.name, 80);
  const phone = String(b.phone || '').replace(/\D/g, '');
  const email = cleanText(b.email, 120);
  if (name.length < 3) errors.name = 'Informe seu nome completo.';
  if (phone.length < 10 || phone.length > 13) errors.phone = 'Informe um WhatsApp com DDD.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'E-mail inválido.';
  if (!(b.consent === true || b.consent === 'true' || b.consent === 'on')) errors.consent = 'É preciso aceitar o uso dos dados para continuar.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  let sub = null;
  for (let i = 0; i < 4 && !sub; i++) {
    try {
      sub = await store.createSubscription({
        protocol: pay.newProtocol(), plan: plan.name, amount_cents: pix.parseAmountCents(plan.price),
        name, phone, email: email || null, upload_token: pay.newToken()
      });
    } catch (err) { if (err.code !== 'PROTOCOL_TAKEN' && err.code !== 'SLOT_TAKEN') throw err; }
  }
  if (!sub) throw new Error('Não foi possível gerar o protocolo');
  res.status(201).json({ ok: true, token: sub.upload_token, ...(await present(ctx, sub)) });
}));

// Carrega o pedido do aluno (precisa do token que só ele recebeu)
const loadOwn = async (req, res) => {
  const sub = await store.getSubscription(req.params.id);
  const token = req.get('x-token') || req.query.token || req.body?.token;
  if (!sub || !pay.tokenOk(token, sub.upload_token)) { res.status(404).json({ error: 'Pedido não encontrado.' }); return null; }
  return sub;
};

// 2) Consultar andamento (retomar o pedido ou ver se foi confirmado)
router.get('/assinaturas/:id', wrap(async (req, res) => {
  const ctx = await context();
  if (!store.ready) return unavailable(res);
  const sub = await loadOwn(req, res);
  if (!sub) return;
  res.json({ ok: true, ...(await present({ ...ctx, ready: true }, sub)) });
}));

// 3) Enviar o comprovante (imagem ou PDF)
router.post('/assinaturas/:id/comprovante', (req, res, next) => upload.single('file')(req, res, (err) => {
  if (!err) return next();
  res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo grande demais (máx. 4 MB). Envie uma foto ou PDF menor.' : 'Falha no envio do arquivo.' });
}), wrap(async (req, res) => {
  if (!store.ready) return unavailable(res);
  if (limited('receipt', req.ip, 20)) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
  const sub = await loadOwn(req, res);
  if (!sub) return;
  if (sub.status === 'confirmado') return res.status(409).json({ error: 'Este pagamento já foi confirmado.' });
  if (!req.file) return res.status(400).json({ error: 'Escolha o comprovante (foto ou PDF).' });
  const kind = pay.sniffReceipt(req.file.buffer);
  if (!kind) return res.status(400).json({ error: 'Envie o comprovante como imagem (JPG, PNG, WebP) ou PDF.' });

  const filePath = `${sub.id}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${kind.ext}`;
  await store.uploadPrivate(req.file.buffer, filePath, kind.type);
  const old = sub.receipt_path;
  await store.updateSubscription(sub.id, { receipt_path: filePath, receipt_type: kind.type, receipt_at: new Date().toISOString(), status: 'em_analise', reject_reason: null });
  if (old) await store.removePrivate(old);
  res.json({ ok: true, protocol: sub.protocol, status: 'em_analise' });
}));

module.exports = router;
module.exports.context = context;
