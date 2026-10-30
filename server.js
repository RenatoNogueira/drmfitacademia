// Variáveis de ambiente do arquivo .env (só localmente; na Vercel elas vêm do painel)
try { process.loadEnvFile(); } catch { /* sem .env: tudo bem */ }

const path = require('path');
const express = require('express');
const siteContent = require('./lib/siteContent');
const media = require('./lib/media');
const content = require('./lib/content');
const store = require('./lib/store');
const { cleanText } = require('./lib/agenda');
const apiRoutes = require('./routes/api');
const payRoutes = require('./routes/pay');
const payLib = require('./lib/payments');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // Vercel fica atrás de proxy: necessário para IP e cookie "secure"
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '200kb', parameterLimit: 3000 })); // extended: o painel envia listas (plans[0][name])

// Versão dos arquivos css/js na URL: evita que o navegador/CDN use uma cópia antiga após cada deploy
const ASSET_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || String(Date.now());

// Variáveis disponíveis em todas as views
app.use(async (req, res, next) => {
  res.locals.site = await siteContent.get(); // textos padrão + edições do painel
  res.locals.assetVersion = ASSET_VERSION;
  res.locals.status = null;
  res.locals.errors = {};
  res.locals.values = {};
  res.locals.devHints = !process.env.VERCEL && process.env.NODE_ENV !== 'production'; // dicas de arquivo só no seu computador
  res.locals.currentPath = req.path;
  res.locals.year = new Date().getFullYear();
  if (req.path.startsWith('/admin') || req.path.startsWith('/api')) return next();
  try {
    Object.assign(res.locals, await media.helpers()); // img(), video(), galleryImages()
    res.locals.testimonials = await content.testimonials();
    // Botão "Assinar" abre o pagamento por PIX só quando está ativado e configurado
    res.locals.payEnabled = payLib.isReady(res.locals.site, { storeReady: store.ready, hasImage: Boolean(res.locals.img('pix-qr')) });
  } catch (err) {
    next(err);
    return;
  }
  next();
});

app.use('/api', apiRoutes);
app.use('/api', payRoutes);
app.use('/admin', adminRoutes);

const page = (view, title) => (req, res) => res.render(view, { title });

app.get('/', (req, res) => res.render('index', { title: res.locals.site.copy.seo.title }));
app.get('/sobre', page('sobre', 'Sobre nós | DRMFIT'));
app.get('/modalidades', page('modalidades', 'Modalidades | DRMFIT'));
app.get('/planos', page('planos', 'Planos e preços | DRMFIT'));
app.get('/horarios', page('horarios', 'Horários das aulas | DRMFIT'));
app.get('/equipe', page('equipe', 'Nossa equipe | DRMFIT'));
app.get('/agendar', (req, res) => res.redirect(302, '/#avaliacao'));

app.get('/contato', (req, res) => {
  res.render('contato', { title: 'Contato | DRMFIT', status: null, errors: {}, values: { plano: req.query.plano || '' } });
});

// Limite de mensagens por IP (em memória, por instância)
const contactHits = new Map();
const contactLimited = (ip) => {
  const now = Date.now();
  const list = (contactHits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  contactHits.set(ip, list);
  return list.length > 5;
};

app.post('/contato', async (req, res) => {
  const wantsJson = req.get('X-Requested-With') === 'fetch';
  const b = req.body || {};
  const values = {
    nome: cleanText(b.nome, 80),
    email: cleanText(b.email, 120),
    telefone: cleanText(b.telefone, 20),
    plano: cleanText(b.plano, 40),
    mensagem: String(b.mensagem || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 2000)
  };
  const respond = (status, view, errors = {}) => (wantsJson
    ? res.status(status).json(view === 'ok' ? { ok: true } : { ok: false, errors, error: errors.form })
    : res.status(status).render('contato', { title: 'Contato | DRMFIT', status: view, errors, values: view === 'ok' ? {} : values }));

  if (b.website) return respond(200, 'ok'); // campo-isca: robôs preenchem, pessoas não veem

  const errors = {};
  if (values.nome.length < 3) errors.nome = 'Informe seu nome completo.';
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = 'Informe um e-mail válido.';
  if (values.telefone.replace(/\D/g, '').length < 10) errors.telefone = 'Informe um telefone com DDD.';
  if (values.mensagem.length < 5) errors.mensagem = 'Escreva uma mensagem.';
  if (Object.keys(errors).length) return respond(400, 'error', errors);

  if (contactLimited(req.ip)) return respond(429, 'error', { form: 'Muitas mensagens em pouco tempo. Tente novamente mais tarde ou use o WhatsApp.' });

  try {
    const data = { name: values.nome, email: values.email, phone: values.telefone.replace(/\D/g, ''), plan: values.plano || null, message: values.mensagem };
    if (store.ready) await store.createMessage(data);
    else console.log('Nova mensagem de contato (sem banco configurado):', data);
  } catch (err) {
    console.error('contato:', err.message);
    return respond(500, 'error', { form: 'Não foi possível enviar agora. Tente pelo WhatsApp.' });
  }
  respond(200, 'ok');
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Não encontrado.' });
  res.status(404).render('404', { title: 'Página não encontrada | DRMFIT' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Erro interno. Tente novamente em instantes.');
});

// Na Vercel o app é importado por api/index.js (função serverless); localmente, sobe o servidor.
if (require.main === module) {
  app.listen(PORT, () => console.log(`DRMFIT rodando em http://localhost:${PORT}`));
}

module.exports = app;
