import db from './db.js';
import { peso as fmtPeso, data as fmtData, parseDecimal, hojeISO } from './util.js';
import { toast } from './toast.js';

export async function initEstoque() {
  const graos = await db.graos.toArray();
  const sel = document.getElementById('entrada-grao');
  sel.innerHTML = graos.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');

  document.getElementById('entrada-data').value = hojeISO();

  document.getElementById('form-entrada').addEventListener('submit', async e => {
    e.preventDefault();
    const graoId = Number(document.getElementById('entrada-grao').value);
    const pesoKg = parseDecimal(document.getElementById('entrada-peso').value);
    const dataVal = document.getElementById('entrada-data').value;
    const observacao = document.getElementById('entrada-obs').value.trim();

    if (!pesoKg || pesoKg <= 0) { toast('Informe um peso válido', 'erro'); return; }

    await db.entradas_estoque.add({ graoId, pesoKg, data: dataVal, observacao });
    toast('Entrada registrada!');
    e.target.reset();
    document.getElementById('entrada-data').value = hojeISO();
    await renderEstoque();
  });

  await renderEstoque();
}

export async function renderEstoque() {
  await renderSaldo();
  await renderHistorico();
}

async function renderSaldo() {
  const graos = await db.graos.toArray();
  const saldos = await Promise.all(graos.map(async g => {
    const entradas = await db.entradas_estoque.where('graoId').equals(g.id).toArray();
    const vendas   = await db.vendas.where('graoId').equals(g.id).toArray();
    const totalEntrada = entradas.reduce((s, e) => s + (e.pesoKg || 0), 0);
    const totalSaida   = vendas.reduce((s, v) => s + (v.pesoKg || 0), 0);
    return { nome: g.nome, saldo: totalEntrada - totalSaida };
  }));

  document.getElementById('estoque-saldo').innerHTML = `
    <div class="card">
      <h2>Saldo em estoque</h2>
      ${saldos.map(g => `
        <div class="saldo-item">
          <span class="saldo-nome">${g.nome}</span>
          <span class="saldo-valor${g.saldo < 0 ? ' saldo-negativo' : ''}">${fmtPeso(g.saldo)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderHistorico() {
  const graos = await db.graos.toArray();
  const graoMap = Object.fromEntries(graos.map(g => [g.id, g.nome]));

  const entradas = await db.entradas_estoque.orderBy('data').reverse().toArray();
  const container = document.getElementById('estoque-historico');

  if (!entradas.length) {
    container.innerHTML = '<p class="vazio">Nenhuma entrada registrada ainda</p>';
    return;
  }

  container.innerHTML = entradas.map(e => `
    <div class="list-item">
      <div class="list-item-info">
        <strong>${graoMap[e.graoId] || '?'}</strong>
        <span>${fmtPeso(e.pesoKg)} · ${fmtData(e.data)}</span>
        ${e.observacao ? `<span class="obs">${e.observacao}</span>` : ''}
      </div>
      <button class="btn-icone btn-excluir-entrada" data-id="${e.id}" title="Excluir">🗑️</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-excluir-entrada').forEach(btn => {
    btn.addEventListener('click', () => excluirEntrada(Number(btn.dataset.id)));
  });
}

async function excluirEntrada(id) {
  if (!confirm('Excluir esta entrada de estoque?')) return;
  await db.entradas_estoque.delete(id);
  toast('Entrada excluída');
  await renderEstoque();
}
