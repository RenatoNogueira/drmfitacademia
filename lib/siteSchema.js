// Descreve tudo o que o painel pode editar no site: grupos, campos, tipos e limites.
// Os valores padrão vêm de data/site.js; o que for salvo no painel tem prioridade.
const defaults = require('../data/site');

// ---------- construtores ----------
const text = (path, label, extra = {}) => ({ type: 'text', path, label, max: 120, ...extra });
const area = (path, label, extra = {}) => ({ type: 'textarea', path, label, max: 600, ...extra });
const head = (path, label) => ({ type: 'head', path, label });

// Itens de listas: "key" é a chave dentro do item
const k = (key, label, extra = {}) => ({ type: 'text', key, label, max: 80, ...extra });
const ka = (key, label, extra = {}) => ({ type: 'textarea', key, label, max: 300, ...extra });

const groups = [
  {
    id: 'marca', title: 'Marca e contato', hint: 'Telefone, WhatsApp, endereço e redes sociais usados em todo o site.',
    fields: [
      text('brand.tagline', 'Slogan', { max: 80 }),
      text('brand.phone', 'Telefone exibido (como aparece no site)', { max: 30, mask: 'phone' }),
      { type: 'digits', path: 'brand.whatsappNumber', mask: 'whatsapp', label: 'WhatsApp (com DDD)', hint: 'O +55 é colocado automaticamente. Todos os botões de WhatsApp usam este número.' },
      { type: 'email', path: 'brand.email', label: 'E-mail' },
      text('brand.address', 'Endereço', { max: 160 }),
      text('brand.mapQuery', 'Local do mapa (endereço ou latitude,longitude)', { max: 120 }),
      { type: 'url', path: 'brand.mapsLink', label: 'Link do Google Maps ("Como chegar")' },
      { type: 'url', path: 'brand.instagram', label: 'Link do Instagram' },
      { type: 'url', path: 'brand.facebook', label: 'Link do Facebook' },
      { type: 'url', path: 'brand.youtube', label: 'Link do YouTube' }
    ]
  },
  {
    id: 'tema', title: 'Cores', hint: 'A cor de destaque aparece em botões, títulos em contorno e detalhes. Mantenha uma cor forte e legível sobre fundo escuro.',
    fields: [
      { type: 'color', path: 'theme.accent', label: 'Cor de destaque' },
      { type: 'color', path: 'theme.accentDark', label: 'Cor de destaque (versão mais escura, usada ao passar o mouse)' }
    ]
  },
  {
    id: 'menu', title: 'Menu', hint: 'Nomes dos itens do menu superior.',
    fields: ['home', 'about', 'services', 'classes', 'plans', 'team', 'contact', 'cta'].map((key) => text(`copy.nav.${key}`, { home: 'Início', about: 'Sobre', services: 'Serviços', classes: 'Aulas', plans: 'Planos', team: 'Equipe', contact: 'Contato', cta: 'Botão de destaque (agendamento)' }[key], { max: 30 }))
  },
  {
    id: 'inicio', title: 'Topo da página', hint: 'Primeira tela do site. O título tem 3 linhas; a terceira aparece em contorno.',
    fields: [
      text('copy.hero.eyebrow', 'Etiqueta acima do título', { max: 40 }),
      text('copy.hero.line1', 'Título – linha 1', { max: 30 }),
      text('copy.hero.line2', 'Título – linha 2', { max: 30 }),
      text('copy.hero.line3', 'Título – linha 3 (em contorno)', { max: 30 }),
      area('copy.hero.text', 'Texto de apoio', { max: 260 }),
      text('copy.hero.primary', 'Botão principal', { max: 30 }),
      text('copy.hero.secondary', 'Botão secundário', { max: 30 }),
      { type: 'lines', path: 'copy.hero.marquee', label: 'Texto gigante ao fundo (uma palavra ou frase por linha)', maxItems: 8, hint: 'Aparece rolando atrás do título.' }
    ]
  },
  {
    id: 'sobre', title: 'Sobre nós', hint: 'Texto da seção "Sobre nós" e assinatura.',
    fields: [
      text('copy.about.eyebrow', 'Etiqueta', { max: 40 }),
      text('about.title', 'Título – início', { max: 60 }),
      text('about.highlight', 'Título – palavra em destaque', { max: 30 }),
      { type: 'lines', path: 'about.paragraphs', label: 'Parágrafos (um por linha)', maxItems: 4, lineMax: 500, area: true },
      text('about.signature', 'Nome na assinatura', { max: 60 }),
      text('about.role', 'Cargo na assinatura', { max: 60 })
    ]
  },
  {
    id: 'numeros', title: 'Números', hint: 'Faixa de números logo abaixo do topo.',
    fields: [{
      type: 'list', path: 'stats', label: 'Números', max: 6, itemTitle: 'label',
      fields: [{ type: 'number', key: 'value', label: 'Número' }, k('suffix', 'Sufixo (ex.: +)', { max: 3, optional: true }), k('label', 'Descrição', { max: 40 })]
    }]
  },
  {
    id: 'diferenciais', title: 'Diferenciais', hint: 'Seção "Por que a DRMFIT".',
    fields: [
      head('copy.features', 'Título da seção'),
      { type: 'list', path: 'features', label: 'Diferenciais', max: 9, itemTitle: 'title', itemDefaults: { icon: 'dumbbell' }, fields: [k('title', 'Título', { max: 50 }), ka('text', 'Texto', { max: 200 })] }
    ]
  },
  {
    id: 'servicos', title: 'Serviços', hint: 'Cartões de modalidades. A quantidade e as fotos são fixas.',
    fields: [
      head('copy.services', 'Título da seção'),
      text('copy.services.link', 'Texto do link de cada cartão', { max: 40 }),
      { type: 'list', path: 'modalities', label: 'Modalidades', fixed: true, itemTitle: 'name', fields: [k('name', 'Nome', { max: 40 }), k('level', 'Nível', { max: 30 }), ka('text', 'Descrição', { max: 200 })] }
    ]
  },
  {
    id: 'aulas', title: 'Aulas', hint: 'Carrossel de aulas com dias e horários.',
    fields: [
      head('copy.classes', 'Título da seção'),
      {
        type: 'list', path: 'classes', label: 'Aulas', fixed: true, itemTitle: 'name',
        fields: [k('name', 'Nome', { max: 40 }), { type: 'pairs', key: 'slots', label: 'Dias e horários (um por linha: dias | horário)', hint: 'Ex.: Seg, Qua, Sex | 06:00 e 19:30', max: 4 }]
      }
    ]
  },
  {
    id: 'oferta', title: 'Oferta do mês', hint: 'Faixa de promoção com foto de fundo.',
    fields: [
      text('promo.kicker', 'Etiqueta', { max: 40 }),
      text('promo.before', 'Título – início', { max: 60 }),
      text('promo.highlight', 'Título – palavra em destaque', { max: 30 }),
      text('promo.after', 'Título – fim', { max: 40, optional: true }),
      text('promo.cta', 'Texto do botão', { max: 30 })
    ]
  },
  {
    id: 'planos', title: 'Planos e preços', hint: 'Cartões de planos. Marque "Destaque" no plano mais popular.',
    fields: [
      head('copy.plans', 'Título da seção'),
      area('copy.plans.text', 'Texto abaixo do título', { max: 200, optional: true }),
      text('copy.plans.badge', 'Selo do plano em destaque', { max: 25 }),
      text('copy.plans.button', 'Início do texto do botão (ex.: Assinar)', { max: 20 }),
      {
        type: 'list', path: 'plans', label: 'Planos', max: 5, itemTitle: 'name',
        fields: [k('name', 'Nome', { max: 30 }), k('price', 'Preço (só o número)', { max: 10 }), k('period', 'Período (ex.: /mês)', { max: 15, optional: true }), { type: 'bool', key: 'highlight', label: 'Destaque' }, { type: 'lines', key: 'items', label: 'Benefícios (um por linha)', maxItems: 10 }]
      }
    ]
  },
  {
    id: 'avaliacao', title: 'Agendamento de avaliação', hint: 'Textos da seção de agendamento. Os horários ficam em Horários.',
    fields: [head('copy.booking', 'Título da seção'), area('copy.booking.text', 'Texto abaixo do título', { max: 240 })]
  },
  {
    id: 'equipe', title: 'Equipe', hint: 'Nomes e funções. As fotos são trocadas em Imagens.',
    fields: [
      head('copy.trainers', 'Título da seção'),
      { type: 'list', path: 'trainers', label: 'Profissionais', fixed: true, itemTitle: 'name', fields: [k('name', 'Nome', { max: 50 }), k('role', 'Função', { max: 60 }), k('initials', 'Iniciais (sem foto)', { max: 3 })] }
    ]
  },
  {
    id: 'titulos', title: 'Títulos de outras seções', hint: 'Galeria, depoimentos e contato. Os depoimentos em si ficam na aba Depoimentos.',
    fields: [head('copy.gallery', 'Galeria'), head('copy.testimonials', 'Depoimentos'), head('copy.contact', 'Contato')]
  },
  {
    id: 'faq', title: 'Perguntas frequentes', hint: 'Perguntas e respostas.',
    fields: [
      head('copy.faq', 'Título da seção'),
      { type: 'list', path: 'faqs', label: 'Perguntas', max: 12, itemTitle: 'q', fields: [k('q', 'Pergunta', { max: 140 }), ka('a', 'Resposta', { max: 500 })] }
    ]
  },
  {
    id: 'horarios', title: 'Horários de funcionamento', hint: 'Horários que aparecem no rodapé, no contato e na grade de aulas.',
    fields: [
      head('copy.schedule', 'Título da grade de aulas'),
      { type: 'list', path: 'schedule.hours', label: 'Funcionamento', max: 6, itemTitle: 'label', fields: [k('label', 'Dias', { max: 40 }), k('value', 'Horário', { max: 30 })] },
      { type: 'table', path: 'schedule.rows', label: 'Grade de aulas da semana', cols: 6, hint: 'Uma linha por horário: 06:00 | Seg | Ter | Qua | Qui | Sex | Sáb (use — para vazio). Colunas: Seg, Ter, Qua, Qui, Sex, Sáb.', maxItems: 12 }
    ]
  },
  {
    id: 'rodape', title: 'Rodapé e chamada final', hint: 'Faixa "Pronto para começar?" (páginas internas) e textos do rodapé.',
    fields: [
      text('copy.cta.before', 'Chamada – início', { max: 60 }),
      text('copy.cta.highlight', 'Chamada – palavra em destaque', { max: 30 }),
      text('copy.cta.text', 'Chamada – texto', { max: 160 }),
      text('copy.cta.button', 'Chamada – botão', { max: 30 }),
      area('copy.footer.about', 'Texto do rodapé (abaixo do logo)', { max: 200 }),
      text('copy.footer.copyright', 'Direitos autorais (depois de © ano DRMFIT Academia.)', { max: 80 })
    ]
  },
  {
    id: 'paginas', title: 'Páginas internas', hint: 'Topo das páginas /sobre, /modalidades, /planos, /horarios, /equipe e /contato.',
    fields: [['about', 'Sobre'], ['services', 'Serviços'], ['plans', 'Planos'], ['schedule', 'Horários'], ['team', 'Equipe'], ['contact', 'Contato']].flatMap(([key, label]) => [
      head(`copy.pages.${key}`, `Página ${label}`),
      { type: 'textarea', path: `copy.pages.${key}.text`, label: `Página ${label} – texto`, max: 200 }
    ])
  },
  {
    id: 'seo', title: 'Título e descrição (Google)', hint: 'Aparecem na aba do navegador e nos resultados de busca.',
    fields: [text('copy.seo.title', 'Título da página inicial', { max: 70 }), area('copy.seo.description', 'Descrição para buscadores', { max: 170 })]
  }
];

// ---------- utilitários de caminho ----------
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
const getPath = (obj, path) => path.split('.').reduce((o, p) => (o == null ? undefined : o[p]), obj);
const setPath = (obj, path, value) => {
  const parts = path.split('.');
  if (parts.some((p) => FORBIDDEN.has(p))) return;
  let cur = obj;
  parts.slice(0, -1).forEach((p) => { if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}; cur = cur[p]; });
  cur[parts[parts.length - 1]] = value;
};

// Campos "head" viram quatro campos de texto
const HEAD_KEYS = [['eyebrow', 'Etiqueta', 40, false], ['before', 'Título – início', 80, false], ['highlight', 'Palavra em destaque', 40, false], ['after', 'Título – fim', 60, true]];
const flat = (group) => group.fields.flatMap((f) => (f.type === 'head'
  ? HEAD_KEYS.map(([key, label, max, optional]) => ({ type: 'text', path: `${f.path}.${key}`, label, max, optional }))
  : [f]));
const byId = Object.fromEntries(groups.map((g) => [g.id, g]));

// ---------- limpeza e validação ----------
const one = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const many = (v, max) => String(v ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const toList = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

// Converte o texto enviado pelo formulário no valor guardado. Retorna { value } ou { error }.
const coerce = (f, raw) => {
  const name = f.label || f.key;
  const required = !f.optional;
  switch (f.type) {
    case 'text': {
      const v = one(raw, f.max || 120);
      return required && !v ? { error: `Preencha: ${name}.` } : { value: v };
    }
    case 'textarea': {
      const v = many(raw, f.max || 600);
      return required && !v ? { error: `Preencha: ${name}.` } : { value: v };
    }
    case 'lines': {
      const list = many(raw, 4000).split('\n').map((s) => one(s, f.lineMax || 200)).filter(Boolean).slice(0, f.maxItems || 12);
      return required && !list.length ? { error: `Preencha: ${name}.` } : { value: list };
    }
    case 'pairs': {
      const list = many(raw, 2000).split('\n').map((l) => l.split('|')).map(([a, ...rest]) => [one(a, 60), one(rest.join('|'), 60)]).filter(([a, b]) => a && b).slice(0, f.max || 6);
      return { value: list };
    }
    case 'table': {
      const rows = many(raw, 4000).split('\n').map((l) => l.split('|').map((c) => one(c, 30))).filter((c) => c[0]).slice(0, f.maxItems || 12)
        .map((c) => ({ time: c[0], classes: Array.from({ length: f.cols }, (_, i) => c[i + 1] || '—') }));
      return { value: rows };
    }
    case 'url': {
      const v = one(raw, 300);
      if (!v && f.optional) return { value: '' };
      return /^https?:\/\/[^\s"'<>]+$/i.test(v) ? { value: v } : { error: `${name}: use um link completo começando com https://` };
    }
    case 'digits': {
      let v = String(raw ?? '').replace(/\D/g, '');
      if (v.length === 10 || v.length === 11) v = `55${v}`; // sem DDI: assume Brasil
      return v.length >= 12 && v.length <= 15 ? { value: v } : { error: `${name}: informe o número com DDD (ex.: (98) 99999-9999).` };
    }
    case 'email': {
      const v = one(raw, 120);
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? { value: v } : { error: `${name}: e-mail inválido.` };
    }
    case 'color': {
      const v = one(raw, 7).toLowerCase();
      return /^#[0-9a-f]{6}$/.test(v) ? { value: v } : { error: `${name}: escolha uma cor válida.` };
    }
    case 'bool': return { value: raw === 'on' || raw === 'true' || raw === '1' || raw === true };
    case 'number': {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? { value: Math.min(n, 10000000) } : { error: `${name}: informe um número.` };
    }
    default: return { error: 'Campo desconhecido.' };
  }
};

// Valida todo o grupo; devolve { values: {caminho: valor}, error }
const parseGroup = (group, body) => {
  const values = {};
  for (const f of flat(group)) {
    if (f.type !== 'list') {
      const r = coerce(f, body[f.path]);
      if (r.error) return { error: r.error };
      values[f.path] = r.value;
      continue;
    }
    // Listas de objetos
    const def = getPath(defaults, f.path) || [];
    const rawItems = f.fixed ? def.map((_, i) => (body[f.path] && (body[f.path][i] ?? body[f.path][String(i)])) || {}) : toList(body[f.path]).slice(0, f.max || 12);
    const items = [];
    for (let i = 0; i < rawItems.length; i++) {
      const base = def[i] || f.itemDefaults || {};
      const item = { ...base };
      for (const sub of f.fields) {
        const r = coerce({ ...sub, label: `${f.label}, item ${i + 1}: ${sub.label}` }, rawItems[i][sub.key]);
        if (r.error) return { error: r.error };
        item[sub.key] = r.value;
      }
      items.push(item);
    }
    if (!f.fixed && !items.length) return { error: `${f.label}: mantenha ao menos um item.` };
    values[f.path] = items;
  }
  return { values };
};

// Valor para mostrar no formulário
const display = (f, v) => {
  if (v == null) return '';
  if (f.type === 'lines') return (v || []).join('\n');
  if (f.type === 'pairs') return (v || []).map((p) => p.join(' | ')).join('\n');
  if (f.type === 'table') return (v || []).map((r) => [r.time, ...r.classes].join(' | ')).join('\n');
  return String(v);
};

module.exports = { groups, byId, flat, getPath, setPath, parseGroup, display, HEAD_KEYS };
