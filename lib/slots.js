// Espaços de imagem editáveis no painel admin. A chave é o nome usado nas views (img('hero'), etc.).
const site = require('../data/site');

const slots = [
  { key: 'logo', group: 'Marca', label: 'Logo do site (cabeçalho e rodapé)', hint: 'PNG com fundo transparente, horizontal (ex.: 800×300), letras claras para fundo escuro.', fallback: '/img/logo-transparent.png' },
  { key: 'hero', group: 'Início', label: 'Topo da página (hero)', hint: 'Foto vertical do atleta, ao menos 1200 px de largura.' },
  { key: 'sobre', group: 'Início', label: 'Sobre nós – foto principal', hint: 'Vertical (4:5), ex.: 1200×1500.' },
  { key: 'sobre-2', group: 'Início', label: 'Sobre nós – foto pequena', hint: 'Vertical (4:5). Aparece no canto da foto principal.' },
  { key: 'banner', group: 'Início', label: 'Fundo da faixa de oferta', hint: 'Horizontal, ex.: 1920×700. Fica escurecida.' },
  { key: 'topo-paginas', group: 'Início', label: 'Fundo do topo das páginas internas', hint: 'Opcional. Horizontal.' }
];

site.modalities.forEach((m) => {
  slots.push({ key: `aula-${m.slug}`, group: 'Aulas', label: `Aula – ${m.name}`, hint: 'Horizontal (4:3).' });
});

site.trainers.forEach((t, i) => {
  slots.push({ key: `equipe-${i + 1}`, group: 'Equipe', label: `Equipe – ${t.name}`, hint: 'Vertical (4:5).' });
});

module.exports = {
  slots,
  slotKeys: new Set(slots.map((s) => s.key))
};
