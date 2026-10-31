// Regras do pagamento por PIX nos planos: configuração pronta?, dados do QR Code e validação de comprovantes.
const crypto = require('crypto');
const pix = require('./pix');
const store = require('./store');

const STATUS = {
  aguardando_pagamento: 'Aguardando pagamento',
  em_analise: 'Comprovante em análise',
  confirmado: 'Pagamento confirmado',
  recusado: 'Comprovante recusado'
};

// A configuração está completa para vender? (store pronto + chave válida ou imagem própria)
const isReady = (site, { storeReady, hasImage }) => {
  const c = site.pix;
  if (!storeReady || !c || !c.enabled) return false;
  if (c.qrMode === 'image') return Boolean(hasImage);
  return !pix.buildPayload({ keyType: c.keyType, key: c.key, receiverName: c.receiverName, city: c.city, amountCents: 100 }).error;
};

// O banco responde e a tabela de assinaturas existe? (confere a cada 60 s; falhas não derrubam o site)
let health = { at: 0, ok: true };
const dbOk = async () => {
  if (!store.ready) return false;
  if (Date.now() - health.at < 60000) return health.ok;
  try { await store.countPendingPayments(); health = { at: Date.now(), ok: true }; } catch { health = { at: Date.now(), ok: false }; }
  return health.ok;
};
const resetHealth = () => { health.at = 0; };

// O que falta para o pagamento funcionar (para mostrar no painel). Lista vazia = pronto.
const problems = async (site, { storeReady, hasImage }) => {
  const c = site.pix || {};
  const out = [];
  if (!c.enabled) out.push({ text: 'O pagamento por PIX está desativado.', link: '/admin/conteudo?g=pagamento', cta: 'Ativar em Conteúdo → Pagamento (PIX)' });
  if (!storeReady) out.push({ text: 'O banco de dados (Supabase) não está configurado neste ambiente.', link: null });
  else if (!(await dbOk())) out.push({ text: 'A tabela de assinaturas ainda não existe no Supabase.', link: null, cta: 'Rode o supabase/schema.sql atualizado no SQL Editor' });
  if (c.qrMode === 'image') { if (!hasImage) out.push({ text: 'Falta enviar a imagem do seu QR Code.', link: '/admin/imagens', cta: 'Enviar em Imagens → Pagamento' }); }
  else {
    const r = pix.buildPayload({ keyType: c.keyType, key: c.key, receiverName: c.receiverName, city: c.city, amountCents: 100 });
    if (r.error) out.push({ text: r.error, link: '/admin/conteudo?g=pagamento', cta: 'Corrigir em Conteúdo → Pagamento (PIX)' });
  }
  return out;
};

// Dados que o modal mostra para pagar: QR (SVG ou imagem), "copia e cola", valor e recebedor
const pixInfo = async (site, { amountCents, imageUrl }) => {
  const c = site.pix;
  const amount = c.includeAmount && amountCents ? amountCents : null;
  const base = { receiver: pix.clean(c.receiverName, 25), city: pix.clean(c.city, 15), amountLabel: amountCents ? pix.fmtBRL(amountCents) : '' };
  if (c.qrMode === 'image') return { ...base, mode: 'image', imageUrl, copyPaste: c.copyPaste || '' };
  const r = pix.buildPayload({ keyType: c.keyType, key: c.key, receiverName: c.receiverName, city: c.city, amountCents: amount });
  if (r.error) throw new Error(r.error);
  return { ...base, mode: 'generated', svg: await pix.qrSvg(r.payload), copyPaste: r.payload };
};

// Protocolo legível (sem letras que se confundem): DRM-7K3QF2
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newProtocol = () => `DRM-${Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('')}`;
const newToken = () => crypto.randomBytes(24).toString('hex');
const tokenOk = (given, stored) => {
  if (typeof given !== 'string' || !stored) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(stored).digest();
  return crypto.timingSafeEqual(a, b);
};

// Confere o tipo real do comprovante pelos primeiros bytes (não confia no nome nem no Content-Type)
const sniffReceipt = (buf) => {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', type: 'image/png' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  if (buf.length > 8 && buf.toString('ascii', 0, 5) === '%PDF-') return { ext: 'pdf', type: 'application/pdf' };
  return null;
};

module.exports = { STATUS, dbOk, resetHealth, problems, isReady, pixInfo, newProtocol, newToken, tokenOk, sniffReceipt };
