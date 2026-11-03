(() => {
  const form = document.querySelector('[data-login]');
  const input = document.getElementById('lg-pass');
  if (!form || !input) return;
  const eye = form.querySelector('[data-eye]');
  const caps = form.querySelector('[data-caps]');
  const submit = form.querySelector('[data-submit]');

  eye.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eye.classList.toggle('on', show);
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    input.focus();
  });

  const checkCaps = (e) => { if (e.getModifierState) caps.hidden = !e.getModifierState('CapsLock'); };
  input.addEventListener('keydown', checkCaps);
  input.addEventListener('keyup', checkCaps);
  input.addEventListener('blur', () => { caps.hidden = true; });

  form.addEventListener('submit', () => {
    submit.disabled = true;
    submit.textContent = 'Entrando…';
  });
  // voltar pelo histórico não deve deixar o botão travado
  addEventListener('pageshow', () => { submit.disabled = false; submit.textContent = 'Entrar'; });
})();
