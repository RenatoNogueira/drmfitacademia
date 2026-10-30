// Escolhe o armazenamento: Supabase se as variáveis existirem; senão, arquivos locais.
// Se o Supabase estiver mal configurado (ex.: URL inválida), o site continua no ar e o painel mostra o problema.
const local = require('./local');

let store = local;
if (process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  try {
    store = require('./supabase');
  } catch (err) {
    console.error('Supabase mal configurado:', err.message);
    store = { ...local, ready: false, problem: `Configuração do Supabase inválida (${err.message}). Confira SUPABASE_URL e SUPABASE_SECRET_KEY.` };
  }
}

module.exports = store;
