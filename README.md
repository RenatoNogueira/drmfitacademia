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

### Formulário de contato
Na Vercel o servidor não guarda arquivos: hoje a mensagem só aparece nos *Logs* da função. Para receber os contatos,
integre um serviço de e-mail (ex.: Resend, SendGrid) no `POST /contato` em `server.js` e guarde a chave em
**Settings → Environment Variables** (nunca no código).

### Limites
Funções serverless têm limite de 4,5 MB por requisição. Vídeos pesados em `public/media` são servidos pelo CDN, mas mantenha-os leves (até ~10 MB).
