// Login do painel admin: senha única (ADMIN_PASSWORD) + cookie assinado (HMAC).
const crypto = require('crypto');

const COOKIE = 'drm_admin';
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 horas

const enabled = () => Boolean(process.env.ADMIN_PASSWORD);
const secret = () => process.env.SESSION_SECRET || crypto.createHash('sha256').update(`drmfit:${process.env.ADMIN_PASSWORD || ''}`).digest('hex');
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const checkPassword = (input) => enabled() && safeEqual(input, process.env.ADMIN_PASSWORD);

const makeToken = () => {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (token) => {
  if (!enabled() || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
};

const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } }; // cookie com % inválido não pode derrubar a requisição
const parseCookies = (header = '') => Object.fromEntries(
  header.split(';').map((c) => c.trim().split('=')).filter((p) => p.length >= 2).map(([k, ...v]) => [k, safeDecode(v.join('='))])
);

const isAuthed = (req) => verifyToken(parseCookies(req.headers.cookie)[COOKIE]);

const setSession = (req, res) => {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE, makeToken(), { httpOnly: true, sameSite: 'strict', secure, maxAge: MAX_AGE_MS, path: '/' });
};
const clearSession = (res) => res.clearCookie(COOKIE, { path: '/' });

// Proteção contra falsificação de requisições: só aceita POST/DELETE vindos do próprio site
const sameOrigin = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const site = req.get('sec-fetch-site');
  if (site && !['same-origin', 'none'].includes(site)) return res.status(403).json({ error: 'Origem não permitida.' });
  const origin = req.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origem não permitida.' }); } catch { return res.status(403).json({ error: 'Origem inválida.' }); }
  }
  next();
};

const requireAuth = (req, res, next) => {
  if (isAuthed(req)) return next();
  if (req.path.startsWith('/api/') || req.get('x-requested-with') === 'fetch') return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  return res.redirect('/admin/login');
};

// Limite simples de tentativas por IP (em memória, por instância)
const attempts = new Map();
const tooMany = (ip) => {
  const a = attempts.get(ip);
  return Boolean(a && a.count >= 5 && Date.now() - a.first < 15 * 60 * 1000);
};
const registerFail = (ip) => {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.first > 15 * 60 * 1000) attempts.set(ip, { count: 1, first: Date.now() });
  else a.count += 1;
};
const clearFails = (ip) => attempts.delete(ip);

module.exports = { enabled, checkPassword, setSession, clearSession, isAuthed, requireAuth, sameOrigin, tooMany, registerFail, clearFails };
