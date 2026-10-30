// Formatação de telefones brasileiros para exibição: 98981419822 -> (98) 98141-9822
const fmtPhone = (value) => {
  const d = String(value ?? '').replace(/\D/g, '');
  const n = d.length > 11 && d.startsWith('55') ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return String(value ?? '');
};

module.exports = { fmtPhone };
