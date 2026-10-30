// PIX estático: monta o "copia e cola" (BR Code, padrão EMV do Banco Central) e o QR Code.
const QRCode = require('qrcode');

// Texto de campos do BR Code: sem acento, maiúsculo, só letras/números/espaço
const clean = (v, max) => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no fim do código
const crc16 = (str) => {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// Normaliza a chave conforme o tipo escolhido
const KEY_TYPES = { cpf: 'CPF', cnpj: 'CNPJ', phone: 'Celular', email: 'E-mail', random: 'Chave aleatória' };
const normalizeKey = (type, raw) => {
  const v = String(raw ?? '').trim();
  switch (type) {
    case 'cpf': { const d = v.replace(/\D/g, ''); return d.length === 11 ? d : null; }
    case 'cnpj': { const d = v.replace(/\D/g, ''); return d.length === 14 ? d : null; }
    case 'phone': { let d = v.replace(/\D/g, ''); if (d.startsWith('55') && d.length > 11) d = d.slice(2); return d.length === 10 || d.length === 11 ? `+55${d}` : null; }
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 77 ? v.toLowerCase() : null;
    case 'random': return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v.toLowerCase() : null;
    default: return null;
  }
};

// "99", "149,90", "R$ 1.299,00" -> centavos (ou null se não for um valor)
const parseAmountCents = (price) => {
  let s = String(price ?? '').replace(/R\$|\s/gi, '');
  if (!/^[\d.,]+$/.test(s)) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) : null;
};
const fmtBRL = (cents) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Monta o código. Retorna { payload } ou { error }.
const buildPayload = ({ keyType, key, receiverName, city, amountCents = null, txid = '***', description = '' }) => {
  const k = normalizeKey(keyType, key);
  if (!k) return { error: 'A chave PIX não confere com o tipo escolhido.' };
  const name = clean(receiverName, 25);
  const cty = clean(city, 15);
  if (!name) return { error: 'Informe o nome do recebedor.' };
  if (!cty) return { error: 'Informe a cidade do recebedor.' };
  const merchant = field('00', 'br.gov.bcb.pix') + field('01', k) + (description ? field('02', clean(description, 40)) : '');
  const tx = String(txid).replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***';
  let body = field('00', '01') + field('01', '11') + field('26', merchant) + field('52', '0000') + field('53', '986');
  if (amountCents) body += field('54', (amountCents / 100).toFixed(2));
  body += field('58', 'BR') + field('59', name) + field('60', cty) + field('62', field('05', tx)) + '6304';
  return { payload: body + crc16(body) };
};

// QR em SVG (preto no branco: máxima leitura pelos aplicativos de banco)
const qrSvg = (payload) => QRCode.toString(payload, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });

module.exports = { clean, crc16, normalizeKey, parseAmountCents, fmtBRL, buildPayload, qrSvg, KEY_TYPES };
