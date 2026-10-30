// Armazenamento no Supabase: tabelas (Postgres) + bucket público de imagens.
// Use a chave "service_role" SOMENTE aqui no servidor; nunca no navegador.
const { createClient } = require('@supabase/supabase-js');

const BUCKET = process.env.SUPABASE_BUCKET || 'media';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const check = ({ data, error }) => {
  if (error) {
    const e = new Error(error.message);
    e.code = error.code === '23505' ? 'SLOT_TAKEN' : error.code;
    throw e;
  }
  return data;
};

module.exports = {
  name: 'supabase',
  ready: true,
  problem: null,

  // ---- arquivos ----
  async uploadFile(buffer, filePath, contentType) {
    check(await sb.storage.from(BUCKET).upload(filePath, buffer, { contentType, upsert: false, cacheControl: '31536000' }));
    const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath);
    return { url: data.publicUrl, path: filePath };
  },
  async removeFile(filePath) {
    if (!filePath) return;
    await sb.storage.from(BUCKET).remove([filePath]);
  },

  // ---- imagens dos espaços ----
  async getMedia() {
    const rows = check(await sb.from('media').select('key,url,path,updated_at')) || [];
    return Object.fromEntries(rows.map((r) => [r.key, r]));
  },
  async setMedia(key, url, filePath) {
    const prev = check(await sb.from('media').select('path').eq('key', key).maybeSingle());
    check(await sb.from('media').upsert({ key, url, path: filePath, updated_at: new Date().toISOString() }));
    return prev?.path || null;
  },
  async deleteMedia(key) {
    const prev = check(await sb.from('media').select('path').eq('key', key).maybeSingle());
    check(await sb.from('media').delete().eq('key', key));
    return prev?.path || null;
  },

  // ---- galeria ----
  async listGallery() {
    return check(await sb.from('gallery').select('id,url,path,position').order('position', { ascending: true })) || [];
  },
  async addGallery(url, filePath) {
    const last = check(await sb.from('gallery').select('position').order('position', { ascending: false }).limit(1));
    const position = (last?.[0]?.position || 0) + 1;
    return check(await sb.from('gallery').insert({ url, path: filePath || null, position }).select('id,url,path,position').single());
  },
  async deleteGallery(id) {
    const prev = check(await sb.from('gallery').select('path').eq('id', id).maybeSingle());
    check(await sb.from('gallery').delete().eq('id', id));
    return prev?.path || null;
  },
  async moveGallery(id, dir) {
    const list = await this.listGallery();
    const i = list.findIndex((g) => g.id === id);
    const j = i + (dir === 'up' ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return;
    check(await sb.from('gallery').update({ position: list[j].position }).eq('id', list[i].id));
    check(await sb.from('gallery').update({ position: list[i].position }).eq('id', list[j].id));
  },

  // ---- configurações (horários) ----
  async getSetting(key) {
    const row = check(await sb.from('settings').select('value').eq('key', key).maybeSingle());
    return row?.value ?? null;
  },
  async setSetting(key, value) {
    check(await sb.from('settings').upsert({ key, value }));
  },

  // ---- agendamentos ----
  async takenTimes(date) {
    const rows = check(await sb.from('bookings').select('time').eq('date', date).neq('status', 'cancelado')) || [];
    return rows.map((r) => r.time);
  },
  async takenBetween(from, to) {
    return check(await sb.from('bookings').select('date,time').gte('date', from).lte('date', to).neq('status', 'cancelado')) || [];
  },
  async createBooking(data) {
    return check(await sb.from('bookings').insert({ ...data, status: 'pendente' }).select().single());
  },
  async listBookings() {
    return check(await sb.from('bookings').select('*').order('date', { ascending: true }).order('time', { ascending: true })) || [];
  },
  async updateBookingStatus(id, status) {
    const rows = check(await sb.from('bookings').update({ status }).eq('id', id).select('id'));
    return rows.length > 0;
  },
  async deleteBooking(id) {
    const rows = check(await sb.from('bookings').delete().eq('id', id).select('id'));
    return rows.length > 0;
  }
};
