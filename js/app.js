import db from './db.js';
import { peso as fmtPeso, dinheiro, data as fmtData } from './util.js';
import { initClientes, renderClientes } from './clientes.js';
import { initEstoque, renderEstoque } from './estoque.js';
import { initVendas, renderVendas, abrirFormVenda } from './vendas.js';
import { initAjustes, renderAjustes, verificarLembreteBackup } from './ajustes.js';

const sections = {
  inicio:   document.getElementById('sec-inicio'),
  vendas:   document.getElementById('sec-vendas'),
  estoque:  document.getElementById('sec-estoque'),
  clientes: document.getElementById('sec-clientes'),
  ajustes:  document.getElementById('sec-ajustes'),
};

const navBtns = document.querySelectorAll('.nav-btn');

function navegar(aba) {
  Object.values(sections).forEach(s => s.classList.remove('ativa'));
  navBtns.forEach(b => b.classList.remove('ativo'));

  const sec = sections[aba];
  if (sec) sec.classList.add('ativa');

  const btn = document.querySelector(`.nav-btn[data-aba="${aba}"]`);
  if (btn) btn.classList.add('ativo');

  history.replaceState(null, '', `#${aba}`);

  if (aba === 'inicio')   carregarInicio();
  if (aba === 'estoque')  renderEstoque();
  if (aba === 'vendas')   renderVendas();
  if (aba === 'clientes') renderClientes(document.getElementById('busca-cliente')?.value || '');
  if (aba === 'ajustes')  renderAjustes();
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => navegar(btn.dataset.aba));
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function carregarInicio() {
  const hoje     = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const [graos, clientes] = await Promise.all([db.graos.toArray(), db.clientes.toArray()]);
  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nome]));

  // Estoque por grão
  const saldosGrao = await Promise.all(graos.map(async g => {
    const entradas = await db.entradas_estoque.where('graoId').equals(g.id).toArray();
    const vendas   = await db.vendas.where('graoId').equals(g.id).toArray();
    return {
      nome: g.nome,
      saldo: entradas.reduce((s, e) => s + (e.pesoKg || 0), 0)
           - vendas.reduce((s, v) => s + (v.pesoKg || 0), 0),
    };
  }));

  // Arrecadado no mês corrente
  const todosPagamentos = await db.pagamentos.toArray();
  const arrecadadoMes = todosPagamentos
    .filter(p => p.data?.startsWith(mesAtual))
    .reduce((s, p) => s + (p.valor || 0), 0);

  // Saldo devedor total + lista de devedores
  const vendasAbertas = await db.vendas.where('status').anyOf(['fiado', 'parcial']).toArray();
  const pagsAbertos   = vendasAbertas.length
    ? await db.pagamentos.where('vendaId').anyOf(vendasAbertas.map(v => v.id)).toArray()
    : [];

  const pagsPorVenda = {};
  pagsAbertos.forEach(p => { pagsPorVenda[p.vendaId] = (pagsPorVenda[p.vendaId] || 0) + p.valor; });

  let aReceber = 0;
  const devedoresMap = {};
  for (const v of vendasAbertas) {
    const saldo = Math.max(0, (v.total || 0) - (pagsPorVenda[v.id] || 0));
    if (saldo <= 0) continue;
    aReceber += saldo;
    if (!devedoresMap[v.clienteId]) devedoresMap[v.clienteId] = { saldo: 0, dataAntiga: v.data };
    devedoresMap[v.clienteId].saldo += saldo;
    if (v.data < devedoresMap[v.clienteId].dataAntiga) devedoresMap[v.clienteId].dataAntiga = v.data;
  }

  const devedores = Object.entries(devedoresMap)
    .map(([id, info]) => ({ nome: clienteMap[Number(id)] || '?', ...info }))
    .sort((a, b) => a.dataAntiga.localeCompare(b.dataAntiga));

  document.getElementById('inicio-content').innerHTML = `
    <button class="btn btn-primario btn-full btn-nova-dash" id="btn-nova-venda-dash">
      🛒 Nova Venda
    </button>

    <div class="dash-grid">
      <div class="dash-card">
        <span class="dash-label">Arrecadado no mês</span>
        <span class="dash-valor">${dinheiro(arrecadadoMes)}</span>
      </div>
      <div class="dash-card">
        <span class="dash-label">A receber</span>
        <span class="dash-valor${aReceber > 0 ? ' saldo-negativo' : ''}">${dinheiro(aReceber)}</span>
      </div>
      ${saldosGrao.map(g => `
        <div class="dash-card">
          <span class="dash-label">Estoque ${g.nome}</span>
          <span class="dash-valor${g.saldo < 0 ? ' saldo-negativo' : ''}">${fmtPeso(g.saldo)}</span>
        </div>
      `).join('')}
    </div>

    ${devedores.length ? `
      <div class="card">
        <h2>Quem está devendo</h2>
        ${devedores.map(d => `
          <div class="list-item">
            <div class="list-item-info">
              <strong>${d.nome}</strong>
              <span>Desde ${fmtData(d.dataAntiga)}</span>
            </div>
            <span class="saldo-valor saldo-negativo">${dinheiro(d.saldo)}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  document.getElementById('btn-nova-venda-dash').addEventListener('click', () => {
    navegar('vendas');
    abrirFormVenda();
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  await db.open();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  initClientes();
  await initEstoque();
  await initVendas();
  initAjustes();
  await verificarLembreteBackup();

  const hash = location.hash.replace('#', '') || 'inicio';
  navegar(Object.keys(sections).includes(hash) ? hash : 'inicio');
}

init();
