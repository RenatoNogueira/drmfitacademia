// Assinatura de plano por PIX: dados do aluno -> QR Code -> envio do comprovante -> acompanhamento.
(() => {
  const modal = document.getElementById('pay-modal');
  const panel = modal && modal.querySelector('[data-pay]');
  if (!modal || !panel) return;

  const $ = (sel) => panel.querySelector(sel);
  const $$ = (sel) => [...panel.querySelectorAll(sel)];
  const steps = $$('[data-pay-step]');
  const stepDots = $$('[data-pay-steps] li');
  const form = $('[data-pay-form]');
  const WA = panel.dataset.wa; // https://wa.me/55...?text=
  const STORE = 'drm-pay-pending';

  let state = null; // { id, token, plan }
  let current = null; // resposta do servidor (protocolo, QR, status...)
  let plan = { name: '', price: '' };
  let file = null;
  let opener = null;
  let closing = false;

  const api = async (method, url, body, token) => {
    const headers = { Accept: 'application/json' };
    if (token) headers['X-Token'] = token;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(url, { method, headers, body: payload });
    let data = {};
    try { data = await res.json(); } catch { /* sem JSON */ }
    return { ok: res.ok, status: res.status, data };
  };

  const remember = () => { try { localStorage.setItem(STORE, JSON.stringify({ ...state, at: Date.now() })); } catch { /* sem armazenamento */ } };
  const forget = () => { try { localStorage.removeItem(STORE); } catch { /* ignora */ } };
  const recall = () => {
    try {
      const v = JSON.parse(localStorage.getItem(STORE) || 'null');
      return v && v.id && v.token && Date.now() - v.at < 24 * 3600 * 1000 ? v : null;
    } catch { return null; }
  };

  const showStep = (n) => {
    steps.forEach((s) => { s.hidden = s.dataset.payStep !== String(n); });
    stepDots.forEach((d, i) => { d.classList.toggle('on', i + 1 <= Math.min(n, 3)); d.classList.toggle('done', i + 1 < Math.min(n, 3)); });
    $('[data-pay-steps]').hidden = n >= 4;
    panel.scrollTop = 0;
  };

  const waLink = (msg) => `${WA}${encodeURIComponent(msg)}`;

  // ---------- QR Code ----------
  const renderPix = (d) => {
    const box = $('[data-pay-qr]');
    box.replaceChildren();
    if (d.pix.mode === 'image' && d.pix.imageUrl) {
      const img = document.createElement('img');
      img.src = d.pix.imageUrl; img.alt = 'QR Code PIX'; img.width = 260; img.height = 260;
      box.append(img);
    } else {
      box.innerHTML = d.pix.svg; // SVG gerado pelo servidor
    }
    $('[data-pay-amount]').textContent = d.pix.amountLabel || '';
    $('[data-pay-receiver]').textContent = d.pix.receiver ? `Para: ${d.pix.receiver}${d.pix.city ? ' · ' + d.pix.city : ''}` : '';
    $('[data-pay-protocol]').textContent = d.protocol;
    $('[data-pay-copy]').hidden = !d.pix.copyPaste;
    $('[data-pay-copy]').dataset.code = d.pix.copyPaste || '';
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* tenta o método antigo */ }
    const t = document.createElement('textarea');
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.append(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  };

  // ---------- resultado / andamento ----------
  const renderResult = (d) => {
    const icon = $('[data-pay-icon]');
    const title = $('[data-pay-result-title]');
    const text = $('[data-pay-result-text]');
    const retry = $('[data-pay-retry]');
    retry.hidden = true;
    icon.className = 'b-check';
    if (d.status === 'confirmado') {
      title.textContent = 'Pagamento confirmado!';
      text.textContent = `Seu plano ${d.plan} está confirmado. Bem-vindo(a)! Fale com a gente para combinar o início.`;
      forget();
    } else if (d.status === 'recusado') {
      icon.classList.add('is-bad');
      title.textContent = 'Não conseguimos confirmar o comprovante';
      text.textContent = d.rejectReason ? `Motivo: ${d.rejectReason}` : 'Confira o comprovante e envie novamente, ou fale com a gente.';
      retry.hidden = false;
    } else {
      title.textContent = 'Comprovante enviado!';
      text.textContent = panel.dataset.success || 'Recebemos o seu comprovante. Em breve confirmamos o pagamento.';
    }
    $('[data-pay-result-protocol]').textContent = d.protocol;
    $('[data-pay-wa]').href = waLink(`Olá! Sou ${form.name.value || 'aluno(a)'} e fiz o pagamento do plano ${d.plan}. Protocolo ${d.protocol}.`);
    showStep(4);
  };

  const goTo = (d) => {
    current = d;
    if (d.status === 'em_analise' || d.status === 'confirmado' || d.status === 'recusado') { renderResult(d); return; }
    renderPix(d);
    showStep(2);
  };

  // ---------- abrir / fechar ----------
  const focusables = () => [...panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not(.b-trap), select, textarea')].filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);

  const resetUi = () => {
    form.reset();
    form.querySelectorAll('[data-error]').forEach((s) => { s.textContent = ''; });
    clearFile();
    $('[data-pay-resume]').hidden = true;
    current = null;
    showStep(1);
  };

  const open = (from, planName, price) => {
    if (!modal.hidden) return;
    opener = from || document.activeElement;
    plan = { name: planName, price: price || '' };
    resetUi();
    $('[data-pay-plan]').innerHTML = '';
    const tag = document.createElement('strong'); tag.textContent = `Plano ${planName}`;
    const sub = document.createElement('span'); sub.textContent = price ? ` · R$ ${price}` : '';
    $('[data-pay-plan]').append(tag, sub);
    modal.hidden = false;
    window.pageLock?.lock();
    requestAnimationFrame(() => { modal.classList.add('is-open'); panel.focus({ preventScroll: true }); });
    // Pagamento ainda não liberado (PIX desativado, sem chave ou banco sem tabela): mostra o caminho pelo WhatsApp
    if (panel.dataset.ready !== '1') {
      $('[data-pay-wa-off]').href = waLink(`Olá! Quero assinar o plano ${planName}${price ? ' (R$ ' + price + ')' : ''}. Como faço o pagamento?`);
      showStep(5);
      return;
    }
    const saved = recall();
    if (saved && saved.plan === planName) { state = saved; $('[data-pay-resume]').hidden = false; }
  };

  const close = () => {
    if (modal.hidden || closing) return;
    closing = true;
    modal.classList.remove('is-open');
    const finish = () => { modal.hidden = true; closing = false; window.pageLock?.unlock(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish(); else setTimeout(finish, 220);
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  };

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-subscribe]');
    if (link) { e.preventDefault(); open(link, link.dataset.subscribe, link.dataset.price); return; }
    if (e.target.closest('[data-pay-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ---------- etapa 1 ----------
  $('[data-pay-continue]').addEventListener('click', async () => {
    const r = await api('GET', `/api/assinaturas/${state.id}`, null, state.token);
    if (r.ok) goTo(r.data);
    else { forget(); $('[data-pay-resume]').hidden = true; }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelectorAll('[data-error]').forEach((s) => { s.textContent = ''; });
    const fd = new FormData(form);
    const payload = { plan: plan.name, consent: fd.get('consent') === 'on' };
    ['name', 'phone', 'email', 'website'].forEach((k) => { payload[k] = fd.get(k) || ''; });
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const r = await api('POST', '/api/assinaturas', payload);
      if (r.ok && r.data.id) {
        state = { id: r.data.id, token: r.data.token, plan: plan.name };
        remember();
        goTo(r.data);
      } else if (r.data.errors) {
        Object.entries(r.data.errors).forEach(([k, v]) => { const s = form.querySelector(`[data-error="${k}"]`); if (s) s.textContent = v; });
        if (r.data.errors.plan) $('[data-pay-error]').textContent = r.data.errors.plan;
      } else {
        $('[data-pay-error]').textContent = r.data.error || 'Não foi possível gerar o QR Code. Tente de novo.';
      }
    } catch {
      $('[data-pay-error]').textContent = 'Sem conexão. Tente de novo ou fale pelo WhatsApp.';
    } finally { btn.disabled = false; }
  });

  // ---------- etapa 2 ----------
  $('[data-pay-copy]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const ok = await copy(btn.dataset.code);
    const old = btn.textContent;
    btn.textContent = ok ? 'Código copiado!' : 'Não foi possível copiar';
    setTimeout(() => { btn.textContent = old; }, 2200);
  });
  $('[data-pay-paid]').addEventListener('click', () => showStep(3));
  $('[data-pay-back]').addEventListener('click', () => showStep(2));

  // ---------- etapa 3: comprovante ----------
  const MAX = 4 * 1024 * 1024;
  const fileInput = $('[data-pay-file]');
  const sendBtn = $('[data-pay-send]');
  const fileErr = $('[data-pay-file-error]');

  function clearFile() {
    file = null;
    if (fileInput) fileInput.value = '';
    const prev = panel.querySelector('[data-pay-preview]');
    if (prev) prev.hidden = true;
    const drop = panel.querySelector('[data-pay-drop]');
    if (drop) drop.hidden = false;
    if (sendBtn) sendBtn.disabled = true;
    if (fileErr) fileErr.textContent = '';
  }

  // Reduz fotos grandes no navegador (limite de envio da Vercel)
  const shrink = async (f) => {
    let bmp;
    try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch { return f; }
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && f.size <= 1.5 * 1024 * 1024) { bmp.close?.(); return f; }
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
    return blob ? new File([blob], 'comprovante.jpg', { type: 'image/jpeg' }) : f;
  };

  const fmtSize = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  fileInput.addEventListener('change', async () => {
    fileErr.textContent = '';
    const f = fileInput.files[0];
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!isPdf && !f.type.startsWith('image/')) { fileErr.textContent = 'Envie uma imagem (JPG, PNG, WebP) ou PDF.'; fileInput.value = ''; return; }
    let use = f;
    if (!isPdf) use = await shrink(f);
    if (use.size > MAX) { fileErr.textContent = 'Arquivo grande demais (máx. 4 MB). Envie uma foto ou PDF menor.'; fileInput.value = ''; return; }
    file = use;
    $('[data-pay-filename]').textContent = f.name;
    $('[data-pay-filesize]').textContent = ` ${fmtSize(use.size)}`;
    const thumb = $('[data-pay-thumb]');
    thumb.hidden = isPdf; $('[data-pay-pdf]').hidden = !isPdf;
    if (!isPdf) { if (thumb.dataset.url) URL.revokeObjectURL(thumb.dataset.url); thumb.dataset.url = URL.createObjectURL(use); thumb.src = thumb.dataset.url; }
    $('[data-pay-preview]').hidden = false;
    $('[data-pay-drop]').hidden = true;
    sendBtn.disabled = false;
  });
  $('[data-pay-clear]').addEventListener('click', clearFile);

  sendBtn.addEventListener('click', async () => {
    if (!file || !state) return;
    sendBtn.disabled = true;
    const old = sendBtn.textContent;
    sendBtn.textContent = 'Enviando…';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api('POST', `/api/assinaturas/${state.id}/comprovante`, fd, state.token);
      if (r.ok) {
        const info = await api('GET', `/api/assinaturas/${state.id}`, null, state.token);
        clearFile();
        renderResult(info.ok ? info.data : { ...current, status: 'em_analise' });
      } else {
        fileErr.textContent = r.data.error || 'Não foi possível enviar. Tente de novo.';
        sendBtn.disabled = false;
      }
    } catch {
      fileErr.textContent = 'Sem conexão. Tente de novo.';
      sendBtn.disabled = false;
    } finally { sendBtn.textContent = old; }
  });

  $('[data-pay-retry]').addEventListener('click', () => { clearFile(); showStep(3); });
})();
