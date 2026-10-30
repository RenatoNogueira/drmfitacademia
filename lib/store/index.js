// Escolhe o armazenamento: Supabase se as variáveis existirem; senão, arquivos locais.
const useSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
module.exports = useSupabase ? require('./supabase') : require('./local');
