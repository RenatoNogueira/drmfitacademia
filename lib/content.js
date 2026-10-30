// Conteúdo editável pelo painel (depoimentos). Se não houver nada cadastrado — ou o banco falhar —
// o site usa os depoimentos padrão de data/site.js, então a página nunca fica vazia nem quebra.
const store = require('./store');
const site = require('../data/site');

const TTL = 15000;
let cache = { at: 0, items: null };
let pending = null;

const defaults = () => site.testimonials.map((t) => ({ name: t.name, quote: t.text, result: t.result, photo_url: null }));

const refresh = async () => {
  try {
    if (!store.ready) {
      cache = { at: Date.now(), items: defaults() };
    } else {
      const rows = await store.listTestimonials();
      // Banco vazio = usa os padrões; se há depoimentos e todos estão ocultos, a seção some de propósito
      cache = { at: Date.now(), items: rows.length ? rows.filter((r) => r.visible).sort((a, b) => a.position - b.position) : defaults() };
    }
  } catch (err) {
    console.error('Falha ao ler depoimentos:', err.message);
    cache = { at: Date.now(), items: cache.items || defaults() };
  }
  return cache.items;
};

const testimonials = async () => {
  if (cache.items && Date.now() - cache.at < TTL) return cache.items;
  pending = pending || refresh().finally(() => { pending = null; });
  return pending;
};

const invalidate = () => { cache.at = 0; };

module.exports = { testimonials, invalidate, defaults };
