const fs = require('fs');
const path = require('path');
const express = require('express');
const site = require('./data/site');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));

// Mídia: coloque suas fotos/vídeos em public/media (veja public/media/LEIAME.txt).
// Se o arquivo não existir, a página mostra um espaço reservado.
const MEDIA_DIR = path.join(__dirname, 'public', 'media');
const IMG_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
const VIDEO_EXT = ['mp4', 'webm'];
const findMedia = (name, exts) => {
  const ext = exts.find((e) => fs.existsSync(path.join(MEDIA_DIR, `${name}.${e}`)));
  return ext ? `/media/${name}.${ext}` : null;
};
const listGallery = () => {
  const dir = path.join(MEDIA_DIR, 'galeria');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => IMG_EXT.includes(f.split('.').pop().toLowerCase()))
    .sort()
    .map((f) => `/media/galeria/${f}`);
};

// Versão dos arquivos css/js na URL: evita que o navegador/CDN use uma cópia antiga após cada deploy
const ASSET_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || String(Date.now());

// Variáveis disponíveis em todas as views
app.use((req, res, next) => {
  res.locals.img = (name) => findMedia(name, IMG_EXT);
  res.locals.video = (name) => findMedia(name, VIDEO_EXT);
  res.locals.galleryImages = listGallery;
  res.locals.site = site;
  res.locals.assetVersion = ASSET_VERSION;
  res.locals.status = null;
  res.locals.errors = {};
  res.locals.values = {};
  res.locals.currentPath = req.path;
  res.locals.year = new Date().getFullYear();
  next();
});

const page = (view, title) => (req, res) => res.render(view, { title });

app.get('/', page('index', 'DRMFIT | Academia - Treine forte. Viva melhor.'));
app.get('/sobre', page('sobre', 'Sobre nós | DRMFIT'));
app.get('/modalidades', page('modalidades', 'Modalidades | DRMFIT'));
app.get('/planos', page('planos', 'Planos e preços | DRMFIT'));
app.get('/horarios', page('horarios', 'Horários das aulas | DRMFIT'));
app.get('/equipe', page('equipe', 'Nossa equipe | DRMFIT'));

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
  res.status(404).render('404', { title: 'Página não encontrada | DRMFIT' });
});

// Na Vercel o app é importado por api/index.js (função serverless); localmente, sobe o servidor.
if (require.main === module) {
  app.listen(PORT, () => console.log(`DRMFIT rodando em http://localhost:${PORT}`));
}

module.exports = app;
