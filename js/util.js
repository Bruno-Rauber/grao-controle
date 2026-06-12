export function dinheiro(valor) {
  return 'R$ ' + Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function peso(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' kg';
}

// Exibe DD/MM/AAAA a partir de uma string YYYY-MM-DD ou objeto Date
export function data(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  const [y, m, d] = String(valor).split('-');
  return `${d}/${m}/${y}`;
}

// Retorna string YYYY-MM-DD para hoje
export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

// Converte texto com vírgula decimal (ex: "12,5" ou "1.234,50") para número
export function parseDecimal(texto) {
  if (typeof texto === 'number') return texto;
  const s = String(texto).trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}
