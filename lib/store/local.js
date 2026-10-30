// Armazenamento local (arquivo JSON + pasta de uploads). Serve para desenvolvimento no computador.
// Na Vercel o disco é somente leitura: lá use o Supabase (veja README).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const DB_FILE = path.join(ROOT, 'data', 'runtime', 'db.json');
const UPLOAD_DIR = path.join(ROOT, 'public', 'media', 'uploads');

const empty = () => ({ media: {}, gallery: [], settings: {}, bookings: [], seq: 0 });
let cache = null;

const load = () => {
  if (cache) return cache;
  try { cache = { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { cache = empty(); }
  return cache;
};
const save = () => {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
};

module.exports = {
  name: 'local',
  ready: !process.env.VERCEL,
  problem: process.env.VERCEL ? 'Na Vercel é preciso configurar o Supabase (SUPABASE_URL e SUPABASE_SECRET_KEY).' : null,

  // ---- arquivos ----
  async uploadFile(buffer, filePath) {
    const target = path.join(UPLOAD_DIR, filePath);
    if (!target.startsWith(UPLOAD_DIR)) throw new Error('Caminho inválido');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
    return { url: `/media/uploads/${filePath}`, path: filePath };
  },
  async removeFile(filePath) {
    if (!filePath) return;
    const target = path.join(UPLOAD_DIR, filePath);
    if (target.startsWith(UPLOAD_DIR)) fs.rmSync(target, { force: true });
  },

  // ---- imagens dos espaços ----
  async getMedia() { return { ...load().media }; },
  async setMedia(key, url, filePath) {
    const db = load();
    const prev = db.media[key];
    db.media[key] = { url, path: filePath, updated_at: new Date().toISOString() };
    save();
    return prev?.path || null;
  },
  async deleteMedia(key) {
    const db = load();
    const prev = db.media[key];
    delete db.media[key];
    save();
    return prev?.path || null;
  },

  // ---- galeria ----
  async listGallery() { return [...load().gallery].sort((a, b) => a.position - b.position); },
  async addGallery(url, filePath) {
    const db = load();
    const position = db.gallery.reduce((m, g) => Math.max(m, g.position), 0) + 1;
    const item = { id: ++db.seq, url, path: filePath || null, position };
    db.gallery.push(item);
    save();
    return item;
  },
  async deleteGallery(id) {
    const db = load();
    const item = db.gallery.find((g) => g.id === id);
    db.gallery = db.gallery.filter((g) => g.id !== id);
    save();
    return item?.path || null;
  },
  async moveGallery(id, dir) {
    const db = load();
    const list = [...db.gallery].sort((a, b) => a.position - b.position);
    const i = list.findIndex((g) => g.id === id);
    const j = i + (dir === 'up' ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i].position, list[j].position] = [list[j].position, list[i].position];
    save();
  },

  // ---- configurações (horários) ----
  async getSetting(key) { return load().settings[key] ?? null; },
  async setSetting(key, value) { load().settings[key] = value; save(); },

  // ---- agendamentos ----
  async takenTimes(date) {
    return load().bookings.filter((b) => b.date === date && b.status !== 'cancelado').map((b) => b.time);
  },
  async takenBetween(from, to) {
    return load().bookings.filter((b) => b.date >= from && b.date <= to && b.status !== 'cancelado').map((b) => ({ date: b.date, time: b.time }));
  },
  async createBooking(data) {
    const db = load();
    if (db.bookings.some((b) => b.date === data.date && b.time === data.time && b.status !== 'cancelado')) {
      const e = new Error('Horário já reservado'); e.code = 'SLOT_TAKEN'; throw e;
    }
    const item = { id: crypto.randomUUID(), ...data, status: 'pendente', created_at: new Date().toISOString() };
    db.bookings.push(item);
    save();
    return item;
  },
  async listBookings() {
    return [...load().bookings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  },
  async updateBookingStatus(id, status) {
    const b = load().bookings.find((x) => x.id === id);
    if (!b) return false;
    if (status !== 'cancelado' && load().bookings.some((x) => x.id !== id && x.date === b.date && x.time === b.time && x.status !== 'cancelado')) {
      const e = new Error('Horário já reservado'); e.code = 'SLOT_TAKEN'; throw e;
    }
    b.status = status;
    save();
    return true;
  },
  async deleteBooking(id) {
    const db = load();
    const before = db.bookings.length;
    db.bookings = db.bookings.filter((b) => b.id !== id);
    save();
    return db.bookings.length < before;
  }
};
