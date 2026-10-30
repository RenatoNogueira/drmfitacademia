// Regras do agendamento de avaliação: horários oferecidos, janela de datas e validação.
const TZ = 'America/Fortaleza'; // São Luís/MA: UTC-3, sem horário de verão

const DEFAULT_AGENDA = {
  daysAhead: 21,
  minNoticeHours: 2,
  blocked: [], // datas YYYY-MM-DD sem atendimento
  slots: {
    0: [],
    1: ['07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '19:00'],
    2: ['07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '19:00'],
    3: ['07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '19:00'],
    4: ['07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '19:00'],
    5: ['07:00', '08:00', '09:00', '10:00', '17:00', '18:00'],
    6: ['08:00', '09:00', '10:00']
  }
};

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidDate = (s) => {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// "Agora" no fuso da academia
const nowInTz = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(now).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

// Mescla o que foi salvo com os padrões e saneia os valores
const normalizeAgenda = (raw) => {
  const a = { ...DEFAULT_AGENDA, ...(raw && typeof raw === 'object' ? raw : {}) };
  a.daysAhead = Math.min(90, Math.max(1, parseInt(a.daysAhead, 10) || DEFAULT_AGENDA.daysAhead));
  a.minNoticeHours = Math.min(72, Math.max(0, parseInt(a.minNoticeHours, 10) || 0));
  a.blocked = [...new Set((Array.isArray(a.blocked) ? a.blocked : []).filter(isValidDate))].sort();
  const slots = {};
  for (let d = 0; d < 7; d++) {
    const list = Array.isArray(a.slots?.[d]) ? a.slots[d] : [];
    slots[d] = [...new Set(list.filter((t) => TIME_RE.test(t)))].sort();
  }
  a.slots = slots;
  return a;
};

// Horários livres de um dia, dado o que já foi reservado
const availableTimes = (agenda, date, taken = [], now = new Date()) => {
  if (!isValidDate(date)) return [];
  const cur = nowInTz(now);
  if (date < cur.date || date > addDays(cur.date, agenda.daysAhead)) return [];
  if (agenda.blocked.includes(date)) return [];
  const takenSet = new Set(taken);
  return (agenda.slots[weekdayOf(date)] || []).filter((t) => {
    if (takenSet.has(t)) return false;
    if (date === cur.date && toMinutes(t) < cur.minutes + agenda.minNoticeHours * 60) return false;
    return true;
  });
};

const cleanText = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);

const OBJECTIVES = ['Emagrecimento', 'Ganho de massa', 'Condicionamento físico', 'Saúde / reabilitação', 'Outro'];

// Valida os dados do aluno; devolve { values, errors }
const validateBooking = (body) => {
  const values = {
    date: cleanText(body.date, 10),
    time: cleanText(body.time, 5),
    name: cleanText(body.name, 80),
    phone: cleanText(body.phone, 20),
    email: cleanText(body.email, 120),
    objective: cleanText(body.objective, 40),
    notes: cleanText(body.notes, 300)
  };
  const errors = {};
  if (!isValidDate(values.date)) errors.date = 'Escolha uma data.';
  if (!TIME_RE.test(values.time)) errors.time = 'Escolha um horário.';
  if (values.name.length < 3) errors.name = 'Informe seu nome completo.';
  const digits = values.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) errors.phone = 'Informe um telefone/WhatsApp com DDD.';
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'E-mail inválido.';
  if (values.objective && !OBJECTIVES.includes(values.objective)) values.objective = 'Outro';
  if (body.consent !== true && body.consent !== 'true' && body.consent !== 'on') errors.consent = 'É preciso aceitar o uso dos dados para contato.';
  values.phone = digits;
  return { values, errors };
};

module.exports = {
  TZ, DEFAULT_AGENDA, WEEKDAYS, WEEKDAYS_SHORT, OBJECTIVES, TIME_RE,
  isValidDate, nowInTz, addDays, weekdayOf, normalizeAgenda, availableTimes, validateBooking
};
