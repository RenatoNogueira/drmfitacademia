// API pública: horários livres e criação de agendamentos de avaliação.
const express = require('express');
const store = require('../lib/store');
const site = require('../data/site');
const agendaLib = require('../lib/agenda');

const router = express.Router();
router.use(express.json({ limit: '20kb' }));

const getAgenda = async () => {
  try { return agendaLib.normalizeAgenda(await store.getSetting('agenda')); } catch { return agendaLib.normalizeAgenda(null); }
};

const unavailable = (res) => res.status(503).json({ error: 'O agendamento online está indisponível no momento. Fale conosco pelo WhatsApp.' });

const fmtDate = (date) => {
  const [y, m, d] = date.split('-');
  return `${agendaLib.WEEKDAYS_SHORT[agendaLib.weekdayOf(date)]}, ${d}/${m}/${y}`;
};

// Limite de pedidos por IP (em memória)
const hits = new Map();
const limited = (ip) => {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 6;
};

router.get('/agenda', async (req, res) => {
  if (!store.ready) return unavailable(res);
  try {
    const agenda = await getAgenda();
    const today = agendaLib.nowInTz().date;
    const last = agendaLib.addDays(today, agenda.daysAhead);
    const taken = await store.takenBetween(today, last);
    const byDate = {};
    taken.forEach((t) => { (byDate[t.date] ||= []).push(String(t.time).slice(0, 5)); });

    const days = [];
    for (let i = 0; i <= agenda.daysAhead; i++) {
      const date = agendaLib.addDays(today, i);
      const times = agendaLib.availableTimes(agenda, date, byDate[date] || []);
      if (times.length) days.push({ date, label: fmtDate(date), weekday: agendaLib.WEEKDAYS_SHORT[agendaLib.weekdayOf(date)], times });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ days, objectives: agendaLib.OBJECTIVES });
  } catch (err) {
    console.error('agenda:', err.message);
    unavailable(res);
  }
});

router.post('/agendar', async (req, res) => {
  if (!store.ready) return unavailable(res);
  if (req.body?.website) return res.json({ ok: true }); // campo-isca para robôs
  if (limited(req.ip)) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });

  const { values, errors } = agendaLib.validateBooking(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  try {
    const agenda = await getAgenda();
    const taken = await store.takenTimes(values.date);
    if (!agendaLib.availableTimes(agenda, values.date, taken.map((t) => String(t).slice(0, 5))).includes(values.time)) {
      return res.status(409).json({ error: 'Esse horário não está mais disponível. Escolha outro.', refresh: true });
    }
    await store.createBooking({
      date: values.date, time: values.time, name: values.name, phone: values.phone,
      email: values.email || null, objective: values.objective || null, notes: values.notes || null
    });
    const when = `${fmtDate(values.date)} às ${values.time}`;
    res.status(201).json({
      ok: true,
      when,
      whatsapp: site.whatsappLink(`Olá! Sou ${values.name} e agendei uma avaliação física na DRMFIT para ${when}. Pode confirmar?`)
    });
  } catch (err) {
    if (err.code === 'SLOT_TAKEN') return res.status(409).json({ error: 'Esse horário acabou de ser reservado. Escolha outro.', refresh: true });
    console.error('agendar:', err.message);
    res.status(500).json({ error: 'Não foi possível agendar agora. Tente pelo WhatsApp.' });
  }
});

module.exports = router;
module.exports.getAgenda = getAgenda;
