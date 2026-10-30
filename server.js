// Variáveis de ambiente do arquivo .env (só localmente; na Vercel elas vêm do painel)
try { process.loadEnvFile(); } catch { /* sem .env: tudo bem */ }

const path = require('path');
const express = require('express');
const site = require('./data/site');
const media = require('./lib/media');
const apiRoutes = require('./routes/api');
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
app.use(express.urlencoded({ extended: false }));

// Versão dos arquivos css/js na URL: evita que o navegador/CDN use uma cópia antiga após cada deploy
const ASSET_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || String(Date.now());

// Variáveis disponíveis em todas as views
app.use(async (req, res, next) => {
  res.locals.site = site;
  res.locals.assetVersion = ASSET_VERSION;
  res.locals.status = null;
  res.locals.errors = {};
  res.locals.values = {};
  res.locals.currentPath = req.path;
  res.locals.year = new Date().getFullYear();
  if (req.path.startsWith('/admin') || req.path.startsWith('/api')) return next();
  try {
    Object.assign(res.locals, await media.helpers()); // img(), video(), galleryImages()
  } catch (err) {
    next(err);
    return;
  }
  next();
});

app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

const page = (view, title) => (req, res) => res.render(view, { title });

app.get('/', page('index', 'DRMFIT | Academia - Treine forte. Viva melhor.'));
app.get('/sobre', page('sobre', 'Sobre nós | DRMFIT'));
app.get('/modalidades', page('modalidades', 'Modalidades | DRMFIT'));
app.get('/planos', page('planos', 'Planos e preços | DRMFIT'));
app.get('/horarios', page('horarios', 'Horários das aulas | DRMFIT'));
app.get('/equipe', page('equipe', 'Nossa equipe | DRMFIT'));
app.get('/agendar', (req, res) => res.redirect(302, '/#avaliacao'));

app.get('/contato', (req, res) => {
  res.render('contato', { title: 'Contato | DRMFIT', status: null, errors: {}, values: { plano: req.query.plano || '' } });
});

app.post('/contato', (req, res) => {
  const { nome = '', email = '', telefone = '', plano = '', mensagem = '' } = req.body;
  const values = { nome, email, telefone, plano, mensagem };
  const errors = {};

  if (nome.trim().length < 3) errors.nome = 'Informe seu nome completo.';
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Informe um e-mail válido.';
  if (telefone.replace(/\D/g, '').length < 10) errors.telefone = 'Informe um telefone com DDD.';
  if (mensagem.trim().length < 5) errors.mensagem = 'Escreva uma mensagem.';

  const wantsJson = req.get('X-Requested-With') === 'fetch';

  if (Object.keys(errors).length) {
    if (wantsJson) return res.status(400).json({ ok: false, errors });
    return res.status(400).render('contato', { title: 'Contato | DRMFIT', status: 'error', errors, values });
  }

  // Aqui você pode integrar envio de e-mail (nodemailer), CRM ou planilha.
  console.log('Novo contato:', values);
  if (wantsJson) return res.json({ ok: true });
  res.render('contato', { title: 'Contato | DRMFIT', status: 'ok', errors: {}, values: {} });
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
