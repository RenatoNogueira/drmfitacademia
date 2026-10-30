// Resolve imagens do site: o que foi enviado no painel admin tem prioridade;
// se não houver, usa os arquivos padrão de public/media. Falhas do banco nunca derrubam o site.
const fs = require('fs');
const path = require('path');
const store = require('./store');

const MEDIA_DIR = path.join(__dirname, '..', 'public', 'media');
const IMG_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
const VIDEO_EXT = ['mp4', 'webm'];
const TTL = 15000;

const findLocal = (name, exts) => {
  const ext = exts.find((e) => fs.existsSync(path.join(MEDIA_DIR, `${name}.${e}`)));
  return ext ? `/media/${name}.${ext}` : null;
};

const localGallery = () => {
  const dir = path.join(MEDIA_DIR, 'galeria');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => IMG_EXT.includes(f.split('.').pop().toLowerCase()))
    .sort()
    .map((f) => `/media/galeria/${f}`);
};

let cache = { at: 0, media: {}, gallery: [], hidden: new Set() };
let pending = null;

const refresh = async () => {
  if (!store.ready) return cache;
  try {
    const [media, gallery, hidden] = await Promise.all([store.getMedia(), store.listGallery(), store.getSetting('media_hidden')]);
    cache = { at: Date.now(), media, gallery, hidden: new Set(Array.isArray(hidden) ? hidden : []) };
  } catch (err) {
    console.error('Falha ao ler imagens do painel:', err.message);
    cache = { ...cache, at: Date.now() }; // mantém o último valor e tenta de novo depois
  }
  return cache;
};

const load = async () => {
  if (Date.now() - cache.at < TTL) return cache;
  pending = pending || refresh().finally(() => { pending = null; });
  return pending;
};

const invalidate = () => { cache.at = 0; };

// Cria as funções usadas nas views
const helpers = async () => {
  const { media, gallery, hidden } = await load();
  const versioned = (row) => (row.updated_at ? `${row.url}${row.url.includes('?') ? '&' : '?'}v=${new Date(row.updated_at).getTime()}` : row.url);
  return {
    img: (name) => (hidden.has(name) ? null : media[name] ? versioned(media[name]) : findLocal(name, IMG_EXT)),
    mediaHidden: (name) => hidden.has(name),
    video: (name) => findLocal(name, VIDEO_EXT),
    galleryImages: () => (gallery.length ? gallery.map((g) => g.url) : localGallery())
  };
};

module.exports = { helpers, invalidate, localGallery, findLocal, IMG_EXT };
