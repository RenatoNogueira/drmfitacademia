// Monta o conteúdo do site: valores padrão (data/site.js) + edições feitas no painel (settings.site).
// Se o banco falhar, o site continua com os padrão.
const store = require('./store');
const base = require('../data/site');
const { setPath } = require('./siteSchema');

const TTL = 15000;
let cache = { at: 0, site: null, overrides: {} };
let pending = null;

const build = (overrides) => {
  const { whatsappLink, ...data } = base;
  const site = JSON.parse(JSON.stringify(data)); // cópia: as edições nunca alteram o padrão
  Object.entries(overrides || {}).forEach(([path, value]) => setPath(site, path, value));
  site.whatsappLink = whatsappLink;
  return site;
};

const refresh = async () => {
  let overrides = cache.overrides;
  try {
    if (store.ready) overrides = (await store.getSetting('site')) || {};
    else overrides = {};
  } catch (err) {
    console.error('Falha ao ler o conteúdo editável:', err.message);
  }
  cache = { at: Date.now(), site: build(overrides), overrides };
  return cache.site;
};

const get = async () => {
  if (cache.site && Date.now() - cache.at < TTL) return cache.site;
  pending = pending || refresh().finally(() => { pending = null; });
  return pending;
};

const getOverrides = async () => { await get(); return { ...cache.overrides }; };

const saveOverrides = async (overrides) => {
  await store.setSetting('site', overrides);
  cache = { at: Date.now(), site: build(overrides), overrides };
};

const invalidate = () => { cache.at = 0; };

module.exports = { get, getOverrides, saveOverrides, invalidate };
