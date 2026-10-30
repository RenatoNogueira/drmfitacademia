# DRMFIT – site da academia (Express + EJS)

## Rodar localmente
```bash
npm install
npm start        # http://localhost:3000
```

## Onde editar
- Textos, planos, horários, endereço e WhatsApp: `data/site.js`
- Fotos e vídeos: `public/media` (nomes em `public/media/LEIAME.txt`)
- Páginas e seções: `views/`
- Estilo e animações: `public/css/style.css`, `public/js/main.js`

## Painel admin (`/admin`)
Área protegida por senha para:
- **Agendamentos**: ver as avaliações marcadas, confirmar/cancelar, chamar o aluno no WhatsApp e baixar planilha (CSV);
- **Horários**: definir os horários livres de cada dia, antecedência, janela de dias e datas sem atendimento;
- **Imagens**: trocar as fotos de cada espaço do site (topo, sobre, aulas, equipe...) ou voltar à foto padrão;
- **Galeria**: adicionar, excluir e reordenar as fotos de "Vida na DRMFIT".

### Rodar o painel no seu computador
1. Copie `.env.example` para `.env` e preencha `ADMIN_PASSWORD` (sem senha o painel fica desativado).
2. `npm start` e abra http://localhost:3000/admin. Sem Supabase, os dados ficam em `data/runtime` e as fotos em `public/media/uploads` (ignorados pelo Git).

### Configurar o Supabase (necessário na Vercel)
A Vercel não guarda arquivos, então imagens e agendamentos vão para o Supabase (plano gratuito atende).
1. Em supabase.com, crie um projeto.
2. **SQL Editor → New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run** (cria as tabelas e o bucket público `media`).
3. **Project Settings → API**: copie a *Project URL* e a chave **secret** (`sb_secret_...`, ou a antiga `service_role`). Ela é secreta: nunca coloque no código nem no navegador. A chave *publishable* (`sb_publishable_...`) não é usada.
4. Na Vercel, **Settings → Environment Variables**, cadastre:
   - `ADMIN_PASSWORD` (a senha do painel)
   - `SESSION_SECRET` (um texto longo e aleatório)
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
5. Faça um novo deploy e acesse `/admin`.

### Dados pessoais (LGPD)
O agendamento guarda nome, WhatsApp e e-mail do aluno apenas para contato sobre a avaliação, com aceite no formulário. Exclua os registros no painel quando não forem mais necessários.

## Publicar na Vercel
1. Suba o projeto para um repositório no GitHub (a pasta `node_modules` já é ignorada).
2. Em vercel.com → **Add New… → Project**, importe o repositório.
3. Framework Preset: **Other**. Não precisa de Build Command nem Output Directory. Deploy.

Ou pela linha de comando:
```bash
npm i -g vercel
vercel          # primeiro deploy (preview)
vercel --prod   # produção
```

Como funciona: `api/index.js` expõe o app Express como função serverless, `vercel.json` envia todas as rotas para ela
e os arquivos de `public/` (css, js, img, media) são servidos direto pelo CDN da Vercel.

### Formulário de contato (página Contato)
Na Vercel o servidor não guarda arquivos: hoje a mensagem só aparece nos *Logs* da função. Para receber os contatos,
integre um serviço de e-mail (ex.: Resend, SendGrid) no `POST /contato` em `server.js` e guarde a chave em
**Settings → Environment Variables** (nunca no código).

### Limites
Funções serverless têm limite de 4,5 MB por requisição. Vídeos pesados em `public/media` são servidos pelo CDN, mas mantenha-os leves (até ~10 MB).
