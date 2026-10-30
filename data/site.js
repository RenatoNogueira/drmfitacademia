// Conteúdo PADRÃO do site DRMFIT. Tudo aqui pode ser alterado pelo painel (/admin → Conteúdo);
// o que for editado no painel tem prioridade sobre estes valores.
const whatsappNumber = '5598981419822'; // DDI + DDD + número, sem símbolos

module.exports = {
  brand: {
    name: 'DRMFIT',
    tagline: 'Treine forte. Viva melhor.',
    phone: '(98) 98141-9822',
    whatsappNumber,
    email: 'contato@drmfit.com.br',
    address: 'Av. Clodomir Cardoso - OUTEIRO, São José de Ribamar - MA, 65113-660',
    mapQuery: '-2.5528154,-44.0679452',
    mapsLink: 'https://maps.app.goo.gl/GqBxbaoA2vk3tr4v5',
    instagram: 'https://instagram.com/drmfit',
    facebook: 'https://facebook.com/drmfit',
    youtube: 'https://youtube.com/@drmfit'
  },

  // Usa o número atual do site (pode ter sido editado no painel)
  whatsappLink(message) {
    return `https://wa.me/${this.brand.whatsappNumber}?text=${encodeURIComponent(message)}`;
  },

  // Cores principais (editáveis no painel)
  theme: { accent: '#f06c00', accentDark: '#c85800' },

  // Textos fixos das páginas (editáveis no painel). "Cabeçalho" = etiqueta + título com palavra destacada.
  copy: {
    seo: {
      title: 'DRMFIT | Academia - Treine forte. Viva melhor.',
      description: 'DRMFIT - academia completa com musculação, aulas coletivas, personal trainers e planos a partir de R$ 99. Agende sua aula experimental grátis.'
    },
    nav: { home: 'Início', about: 'Sobre', services: 'Serviços', classes: 'Aulas', plans: 'Planos', team: 'Equipe', contact: 'Contato', cta: 'Agendar avaliação' },
    hero: {
      eyebrow: 'Academia completa',
      line1: 'Supere mais',
      line2: 'a cada',
      line3: 'treino!',
      text: 'Musculação, aulas coletivas, personal e avaliação física em um só lugar. Comece hoje com uma aula experimental gratuita.',
      primary: 'Agendar avaliação',
      secondary: 'Ver planos',
      marquee: ['DRMFIT', 'Treine forte', 'Sem limites', 'Supere mais']
    },
    about: { eyebrow: 'Sobre nós' },
    features: { eyebrow: 'Por que a DRMFIT', before: 'Tudo para o seu', highlight: 'resultado', after: '' },
    services: { eyebrow: 'O que fazemos', before: 'Nossos', highlight: 'serviços', after: '', link: 'Quero saber mais' },
    classes: { eyebrow: 'Aulas', before: 'Nossas', highlight: 'aulas', after: '' },
    plans: { eyebrow: 'Planos', before: 'Nossos', highlight: 'planos', after: '', text: 'Sem taxa de matrícula na primeira semana. Cancele quando quiser nos planos mensais.', badge: 'Mais popular', button: 'Assinar' },
    booking: { eyebrow: 'Avaliação física', before: 'Agende sua', highlight: 'avaliação', after: '', text: 'Escolha o melhor dia e horário e deixe seus dados. Nossa equipe confirma com você pelo WhatsApp.' },
    gallery: { eyebrow: 'Galeria', before: 'Vida na', highlight: 'DRMFIT', after: '' },
    trainers: { eyebrow: 'Equipe', before: 'Quem treina', highlight: 'com você', after: '' },
    testimonials: { eyebrow: 'Depoimentos', before: 'Alunos que', highlight: 'transformaram', after: 'a rotina' },
    faq: { eyebrow: 'Dúvidas', before: 'Perguntas', highlight: 'frequentes', after: '' },
    contact: { eyebrow: 'Contato', before: 'Fale com a', highlight: 'DRMFIT', after: '' },
    schedule: { eyebrow: 'Grade de aulas', before: 'Horários que cabem na', highlight: 'sua rotina', after: '' },
    cta: { before: 'Pronto para', highlight: 'começar?', text: 'Agende sua aula experimental gratuita e conheça a DRMFIT.', button: 'Chamar no WhatsApp' },
    footer: { about: 'Estrutura completa, profissionais dedicados e um ambiente que motiva.', copyright: 'Todos os direitos reservados.' },
    pages: {
      about: { eyebrow: 'Sobre nós', before: 'A academia que', highlight: 'move você', text: 'Há 12 anos ajudando pessoas a conquistar saúde, força e confiança.' },
      services: { eyebrow: 'Serviços', before: 'Treinos para', highlight: 'todos os gostos', text: 'Da musculação ao yoga: escolha uma modalidade ou combine várias.' },
      plans: { eyebrow: 'Planos e preços', before: 'Invista na', highlight: 'sua saúde', text: 'Planos flexíveis, sem burocracia. Trimestral e anual com desconto.' },
      schedule: { eyebrow: 'Aulas', before: 'Grade de', highlight: 'horários', text: 'Confira os horários e planeje a sua semana de treinos.' },
      team: { eyebrow: 'Equipe', before: 'Profissionais', highlight: 'apaixonados', text: 'Instrutores certificados prontos para levar você ao próximo nível.' },
      contact: { eyebrow: 'Contato', before: 'Fale com a', highlight: 'DRMFIT', text: 'Tire dúvidas, agende sua aula experimental ou venha nos visitar.' }
    }
  },

  promo: {
    kicker: 'Oferta do mês',
    before: 'Ganhe 30% OFF em',
    highlight: 'Funcional',
    after: 'neste mês',
    cta: 'Quero aproveitar'
  },

  about: {
    title: 'Treinos com apoio e um',
    highlight: 'sorriso',
    paragraphs: [
      'A DRMFIT nasceu com a ideia de que treinar deve ser acessível, motivador e seguro. Começamos com uma pequena sala de musculação e hoje somos referência em estrutura e atendimento.',
      'Nossa equipe acompanha cada aluno de perto, do primeiro treino à conquista da meta, com planejamento, energia e muito respeito pelo seu ritmo.'
    ],
    signature: 'Rodrigo Mendes',
    role: 'Head Coach & Fundador'
  },

  // Aulas exibidas no carrossel (slug = nome da foto aula-<slug>.jpg)
  classes: [
    { slug: 'musculacao', name: 'Musculação', slots: [['Seg a Sex', '05:00 – 23:00'], ['Sábado', '08:00 – 18:00']] },
    { slug: 'crossfit', name: 'Funcional / Cross', slots: [['Seg, Qua, Sex', '06:00 e 19:30'], ['Sábado', '08:00']] },
    { slug: 'spinning', name: 'Spinning', slots: [['Ter e Qui', '06:00 e 19:30'], ['Seg e Qua', '12:00']] },
    { slug: 'danca', name: 'Zumba & Dança', slots: [['Ter e Qui', '18:00'], ['Sábado', '06:00']] },
    { slug: 'lutas', name: 'Boxe & Muay Thai', slots: [['Seg e Sex', '18:00'], ['Qua', '18:00']] },
    { slug: 'yoga', name: 'Yoga & Pilates', slots: [['Seg, Qua, Sex', '08:00'], ['Ter e Qui', '08:00']] }
  ],

  stats: [
    { value: 2500, suffix: '+', label: 'Alunos ativos' },
    { value: 35, suffix: '', label: 'Aulas por semana' },
    { value: 20, suffix: '+', label: 'Profissionais' },
    { value: 12, suffix: '', label: 'Anos de história' }
  ],

  features: [
    { icon: 'dumbbell', title: 'Musculação completa', text: 'Mais de 200 equipamentos de última geração e área de pesos livres ampla.' },
    { icon: 'heart', title: 'Avaliação física', text: 'Bioimpedância e acompanhamento de evolução a cada ciclo de treino.' },
    { icon: 'users', title: 'Personal trainers', text: 'Treino individualizado com profissionais formados e certificados.' },
    { icon: 'clock', title: 'Horário estendido', text: 'Abertos das 5h às 23h em dias úteis, para encaixar no seu dia.' },
    { icon: 'shower', title: 'Vestiários premium', text: 'Armários, chuveiros, sauna seca e toalhas à disposição.' },
    { icon: 'apple', title: 'Nutrição', text: 'Consultas com nutricionista parceira para alinhar dieta e objetivo.' }
  ],

  modalities: [
    { slug: 'musculacao', icon: 'dumbbell', name: 'Musculação', level: 'Todos os níveis', text: 'Ganhe força e massa muscular com acompanhamento de instrutores em todos os turnos.' },
    { slug: 'crossfit', icon: 'bolt', name: 'Funcional / Cross', level: 'Intermediário', text: 'Treinos intensos e variados que melhoram condicionamento, agilidade e força.' },
    { slug: 'spinning', icon: 'bike', name: 'Spinning', level: 'Todos os níveis', text: 'Pedale ao ritmo da música e queime até 600 kcal por aula.' },
    { slug: 'danca', icon: 'music', name: 'Zumba & Dança', level: 'Iniciante', text: 'Diversão e suor em aulas coreografadas com muita energia.' },
    { slug: 'lutas', icon: 'glove', name: 'Boxe & Muay Thai', level: 'Todos os níveis', text: 'Técnica, resistência e disciplina, sem precisar de experiência prévia.' },
    { slug: 'yoga', icon: 'lotus', name: 'Yoga & Pilates', level: 'Todos os níveis', text: 'Flexibilidade, postura e equilíbrio mental para completar seu treino.' }
  ],

  plans: [
    { name: 'Start', price: '99', period: '/mês', highlight: false, items: ['Musculação liberada', 'Avaliação física inicial', 'Acesso das 6h às 17h', 'App DRMFIT'] },
    { name: 'Fit', price: '149', period: '/mês', highlight: true, items: ['Musculação + todas as aulas', 'Avaliação física trimestral', 'Acesso em todos os horários', 'App DRMFIT', '1 convidado por mês'] },
    { name: 'Elite', price: '249', period: '/mês', highlight: false, items: ['Tudo do plano Fit', '4 sessões de personal/mês', 'Consulta com nutricionista', 'Sauna e toalha inclusas', 'Convidados ilimitados'] }
  ],

  schedule: {
    days: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    rows: [
      { time: '06:00', classes: ['Funcional', 'Spinning', 'Funcional', 'Spinning', 'Funcional', 'Zumba'] },
      { time: '08:00', classes: ['Yoga', 'Pilates', 'Yoga', 'Pilates', 'Yoga', 'Boxe'] },
      { time: '12:00', classes: ['Spinning', 'Funcional', 'Spinning', 'Funcional', 'Spinning', '—'] },
      { time: '18:00', classes: ['Boxe', 'Zumba', 'Muay Thai', 'Zumba', 'Boxe', '—'] },
      { time: '19:30', classes: ['Funcional', 'Spinning', 'Funcional', 'Spinning', 'Funcional', '—'] }
    ],
    hours: [
      { label: 'Segunda a sexta', value: '05:00 – 23:00' },
      { label: 'Sábado', value: '08:00 – 18:00' },
      { label: 'Domingo e feriados', value: '09:00 – 14:00' }
    ]
  },

  trainers: [
    { name: 'Rodrigo Mendes', role: 'Head Coach · Musculação', initials: 'RM' },
    { name: 'Camila Duarte', role: 'Funcional & Cross', initials: 'CD' },
    { name: 'Diego Ramos', role: 'Boxe & Muay Thai', initials: 'DR' },
    { name: 'Marina Souza', role: 'Yoga & Pilates', initials: 'MS' }
  ],

  testimonials: [
    { name: 'Ana Paula L.', text: 'Em 6 meses perdi 12 kg e ganhei muita disposição. A equipe da DRMFIT me acompanhou em tudo.', result: '-12 kg' },
    { name: 'Carlos Eduardo', text: 'Ambiente limpo, equipamentos novos e professores que realmente corrigem a execução.', result: '+5 kg de massa' },
    { name: 'Fernanda R.', text: 'As aulas de spinning são viciantes! Nunca imaginei que ia gostar tanto de treinar.', result: '3 anos de casa' }
  ],

  faqs: [
    { q: 'Posso fazer uma aula experimental?', a: 'Sim! A primeira aula é gratuita. Fale com a gente pelo WhatsApp ou preencha o formulário de contato.' },
    { q: 'Existe fidelidade ou multa de cancelamento?', a: 'Os planos mensais não têm fidelidade. Os planos trimestrais e anuais têm desconto especial.' },
    { q: 'A academia tem estacionamento?', a: 'Temos convênio com estacionamento ao lado, com desconto para alunos.' },
    { q: 'Preciso de atestado médico?', a: 'Recomendamos uma avaliação médica. Também fazemos o questionário PAR-Q na matrícula.' }
  ]
};
