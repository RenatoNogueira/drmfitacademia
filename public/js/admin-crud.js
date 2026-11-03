// Novo / Editar: agendamentos, mensagens, pagamentos e fotos da galeria.
// Usa api(), shrink(), busy() e maskers de admin.js e formDialog/notify/flash de admin-ui.js.
(() => {
  const saved = (title, text) => { flash({ type: 'success', title, text }); location.reload(); };
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // ---- agendamentos ----
  const bookingMeta = document.querySelector('[data-b-meta]');
  const newBooking = document.querySelector('[data-new-booking]');
  if (bookingMeta && newBooking) {
    const objectives = JSON.parse(bookingMeta.dataset.objectives || '[]');
    const open = (card) => {
      const d = card ? card.dataset : {};
      formDialog({
        title: card ? 'Editar agendamento' : 'Novo agendamento',
        text: 'O mesmo dia e horário não pode ter dois agendamentos ativos.',
        submitText: card ? 'Salvar alterações' : 'Criar agendamento',
        fields: [
          { name: 'name', label: 'Nome', required: true, max: 80, value: d.name, wide: true },
          { name: 'phone', label: 'WhatsApp / telefone', required: true, type: 'tel', mask: 'phone', value: d.phone },
          { name: 'email', label: 'E-mail', type: 'email', max: 120, value: d.email },
          { name: 'date', label: 'Data', required: true, type: 'date', value: d.date || todayIso() },
          { name: 'time', label: 'Horário', required: true, type: 'time', value: d.time || '' },
          { name: 'birth_date', label: 'Data de nascimento', type: 'date', value: d.birth || '' },
          { name: 'health', label: 'Comorbidades', max: 200, value: d.health, placeholder: 'Ex.: Pressão alta, Diabetes', hint: 'Deixe em branco se não tiver nenhuma.' },
          { name: 'objective', label: 'Objetivo', type: 'select', value: d.objective || '', options: [['', '—'], ...objectives.map((o) => [o, o])] },
          { name: 'status', label: 'Situação', type: 'select', value: card ? d.status : 'confirmado', options: [['pendente', 'Pendente'], ['confirmado', 'Confirmado'], ['cancelado', 'Cancelado']] },
          { name: 'notes', label: 'Observações', type: 'textarea', max: 300, value: d.notes }
        ],
        onSubmit: async (v) => {
          await api('POST', card ? `/admin/api/agendamentos/${card.dataset.id}/editar` : '/admin/api/agendamentos', new URLSearchParams(v));
          saved(card ? 'Agendamento atualizado' : 'Agendamento criado', `${v.name} — ${v.date.split('-').reverse().join('/')} às ${v.time}`);
        }
      });
    };
    newBooking.addEventListener('click', () => open(null));
    document.getElementById('b-list')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-edit-booking]');
      if (b) open(b.closest('.b-card'));
    });
  }

  // ---- mensagens ----
  const newMessage = document.querySelector('[data-new-message]');
  if (newMessage) {
    const open = (box) => {
      const d = box ? box.dataset : {};
      formDialog({
        title: box ? 'Editar mensagem' : 'Registrar contato',
        text: box ? '' : 'Use para anotar um contato recebido por telefone, Instagram ou pessoalmente.',
        submitText: box ? 'Salvar alterações' : 'Registrar',
        fields: [
          { name: 'name', label: 'Nome', required: true, max: 80, value: d.name, wide: true },
          { name: 'phone', label: 'WhatsApp / telefone', required: true, type: 'tel', mask: 'phone', value: d.phone },
          { name: 'email', label: 'E-mail', type: 'email', max: 120, value: d.email },
          { name: 'message', label: 'Mensagem / anotação', type: 'textarea', required: true, max: 2000, value: d.message }
        ],
        onSubmit: async (v) => {
          await api('POST', box ? `/admin/api/mensagens/${box.dataset.id}/editar` : '/admin/api/mensagens', new URLSearchParams(v));
          saved(box ? 'Mensagem atualizada' : 'Contato registrado', v.name);
        }
      });
    };
    newMessage.addEventListener('click', () => open(null));
    document.querySelector('.a-msgs')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-edit-message]');
      if (b) open(b.closest('.a-msg'));
    });
  }

  // ---- pagamentos ----
  const payMeta = document.querySelector('[data-p-meta]');
  const newPayment = document.querySelector('[data-new-payment]');
  if (payMeta && newPayment) {
    const plans = JSON.parse(payMeta.dataset.plans || '[]');
    const open = (card) => {
      const d = card ? card.dataset : {};
      formDialog({
        title: card ? 'Editar pagamento' : 'Novo pagamento',
        text: card ? `Protocolo ${d.protocol}` : 'Registre um aluno que pagou fora do site (dinheiro, balcão, transferência).',
        submitText: card ? 'Salvar alterações' : 'Registrar pagamento',
        fields: [
          { name: 'name', label: 'Nome do aluno', required: true, max: 80, value: d.name, wide: true },
          { name: 'phone', label: 'WhatsApp / telefone', required: true, type: 'tel', mask: 'phone', value: d.phone },
          { name: 'email', label: 'E-mail', type: 'email', max: 120, value: d.email },
          { name: 'plan', label: 'Plano', required: true, type: 'select', value: d.plan || (plans[0] && plans[0][0]), options: plans },
          { name: 'amount', label: 'Valor (R$)', placeholder: 'vazio = valor do plano', max: 12, value: d.value, hint: 'Preencha só se for diferente do plano (ex.: desconto).' },
          ...(card ? [] : [{ name: 'status', label: 'Situação', type: 'select', value: 'confirmado', options: [['confirmado', 'Já pago (confirmado)'], ['aguardando_pagamento', 'Aguardando pagamento']], wide: true }])
        ],
        onSubmit: async (v) => {
          await api('POST', card ? `/admin/api/pagamentos/${card.dataset.id}/editar` : '/admin/api/pagamentos', new URLSearchParams(v));
          saved(card ? 'Pagamento atualizado' : 'Pagamento registrado', v.name);
        }
      });
    };
    newPayment.addEventListener('click', () => open(null));
    document.getElementById('p-list')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-edit-payment]');
      if (b) open(b.closest('.p-card'));
    });
  }

  // ---- galeria: trocar a foto mantendo a posição ----
  document.querySelectorAll('[data-replace-photo]').forEach((input) => input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const card = input.closest('[data-id]');
    busy(card, true);
    try {
      const fd = new FormData();
      fd.append('file', await shrink(file));
      await api('POST', `/admin/api/galeria/${card.dataset.id}/trocar`, fd);
      saved('Foto trocada', 'A nova foto ficou na mesma posição da galeria.');
    } catch (err) { notify({ type: 'error', title: 'Não foi possível trocar a foto', text: err.message }); busy(card, false); }
  }));
})();
