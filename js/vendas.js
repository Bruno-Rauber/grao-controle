import db from './db.js';
import { peso as fmtPeso, dinheiro, data as fmtData, parseDecimal, hojeISO } from './util.js';
import { toast } from './toast.js';

// ── Inicialização (chamada uma vez no startup) ────────────────────────────────
export async function initVendas() {
  const graos = await db.graos.toArray();

  // Filtro grão
  document.getElementById('filtro-grao').innerHTML =
    `<option value="">Todos grãos</option>` +
    graos.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');

  // Preenche select de grão no form
  document.getElementById('venda-grao').innerHTML =
    graos.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');

  // Eventos da lista
  document.getElementById('btn-nova-venda').addEventListener('click', abrirFormVenda);
  document.getElementById('filtro-status').addEventListener('change', renderVendas);
  document.getElementById('filtro-grao').addEventListener('change', renderVendas);

  // Eventos do formulário
  document.getElementById('btn-voltar-vendas').addEventListener('click', mostrarLista);
  document.getElementById('venda-peso').addEventListener('input', () => { atualizarTotal(); verificarEstoque(); });
  document.getElementById('venda-preco').addEventListener('input', atualizarTotal);
  document.getElementById('venda-grao').addEventListener('change', async () => { await preencherPreco(); await verificarEstoque(); });

  document.querySelectorAll('#toggle-status .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#toggle-status .toggle-btn').forEach(b => b.classList.remove('toggle-ativo'));
      btn.classList.add('toggle-ativo');
    });
  });

  document.getElementById('form-venda').addEventListener('submit', salvarVenda);

  // Eventos do modal de pagamento
  document.getElementById('btn-cancelar-pagamento').addEventListener('click', fecharModalPagamento);
  document.getElementById('modal-pagamento').addEventListener('click', e => {
    if (e.target.id === 'modal-pagamento') fecharModalPagamento();
  });
  document.getElementById('form-pagamento').addEventListener('submit', salvarPagamento);

  await renderVendas();
}

// ── Renderiza lista de vendas ─────────────────────────────────────────────────
export async function renderVendas() {
  const statusFiltro = document.getElementById('filtro-status')?.value || '';
  const graoFiltro   = document.getElementById('filtro-grao')?.value || '';

  let vendas = await db.vendas.orderBy('data').reverse().toArray();
  if (statusFiltro) vendas = vendas.filter(v => v.status === statusFiltro);
  if (graoFiltro)   vendas = vendas.filter(v => String(v.graoId) === graoFiltro);

  const [graos, clientes] = await Promise.all([db.graos.toArray(), db.clientes.toArray()]);
  const graoMap    = Object.fromEntries(graos.map(g => [g.id, g.nome]));
  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nome]));

  const vendasComSaldo = await Promise.all(vendas.map(async v => {
    if (v.status === 'pago') return { ...v, saldo: 0 };
    const pags = await db.pagamentos.where('vendaId').equals(v.id).toArray();
    return { ...v, saldo: Math.max(0, (v.total || 0) - pags.reduce((s, p) => s + (p.valor || 0), 0)) };
  }));

  const container = document.getElementById('vendas-lista');
  if (!vendasComSaldo.length) {
    container.innerHTML = '<p class="vazio">Nenhuma venda registrada ainda</p>';
    return;
  }

  container.innerHTML = vendasComSaldo.map(v => `
    <div class="venda-card">
      <div class="venda-header">
        <span class="venda-cliente">${clienteMap[v.clienteId] || '?'}</span>
        <span class="badge badge-${v.status}">${v.status}</span>
      </div>
      <div class="venda-detalhes">
        <span>${graoMap[v.graoId] || '?'} · ${fmtPeso(v.pesoKg)}</span>
        <span class="texto-2">${fmtData(v.data)}</span>
      </div>
      <div class="venda-rodape">
        <div>
          <span class="venda-total">${dinheiro(v.total)}</span>
          ${v.saldo > 0 ? `<span class="venda-saldo-dev">Deve: ${dinheiro(v.saldo)}</span>` : ''}
        </div>
        <div class="list-item-acoes">
          ${v.status !== 'pago'
            ? `<button class="btn btn-pagar btn-secundario" data-id="${v.id}" data-saldo="${v.saldo}">💰 Pagar</button>`
            : ''}
          <button class="btn-icone btn-excluir-venda" data-id="${v.id}" title="Excluir">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-pagar').forEach(btn =>
    btn.addEventListener('click', () => abrirModalPagamento(Number(btn.dataset.id), parseFloat(btn.dataset.saldo)))
  );
  container.querySelectorAll('.btn-excluir-venda').forEach(btn =>
    btn.addEventListener('click', () => excluirVenda(Number(btn.dataset.id)))
  );
}

// ── Abrir formulário de nova venda ────────────────────────────────────────────
export async function abrirFormVenda() {
  // Atualiza select de clientes (pode ter novos desde o init)
  const clientes = await db.clientes.orderBy('nome').toArray();
  document.getElementById('venda-cliente').innerHTML =
    `<option value="">-- Selecione --</option>` +
    clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

  document.getElementById('form-venda').reset();
  document.getElementById('venda-data').value = hojeISO();
  document.getElementById('venda-total-display').textContent = 'R$ 0,00';
  document.getElementById('aviso-estoque').classList.add('oculto');

  // Status padrão: Pago
  document.querySelectorAll('#toggle-status .toggle-btn').forEach(b => b.classList.remove('toggle-ativo'));
  document.querySelector('#toggle-status [data-valor="pago"]').classList.add('toggle-ativo');

  // Preenche preço do primeiro grão
  await preencherPreco();

  document.getElementById('vendas-lista-view').classList.add('oculto');
  document.getElementById('vendas-form-view').classList.remove('oculto');
  setTimeout(() => document.getElementById('venda-cliente').focus(), 50);
}

function mostrarLista() {
  document.getElementById('vendas-lista-view').classList.remove('oculto');
  document.getElementById('vendas-form-view').classList.add('oculto');
}

// ── Helpers do formulário ─────────────────────────────────────────────────────
function atualizarTotal() {
  const peso  = parseDecimal(document.getElementById('venda-peso').value);
  const preco = parseDecimal(document.getElementById('venda-preco').value);
  document.getElementById('venda-total-display').textContent = dinheiro(peso * preco);
}

async function preencherPreco() {
  const graoId = Number(document.getElementById('venda-grao').value);
  const cfg = await db.config.get('ultimoPrecoPorGrao');
  if (!cfg) return;
  try {
    const mapa = JSON.parse(cfg.valor);
    if (mapa[graoId] !== undefined) {
      document.getElementById('venda-preco').value = String(mapa[graoId]).replace('.', ',');
      atualizarTotal();
    }
  } catch { /* JSON inválido */ }
}

async function verificarEstoque() {
  const graoId = Number(document.getElementById('venda-grao').value);
  const peso   = parseDecimal(document.getElementById('venda-peso').value);
  const aviso  = document.getElementById('aviso-estoque');
  if (!peso || !graoId) { aviso.classList.add('oculto'); return; }

  const entradas = await db.entradas_estoque.where('graoId').equals(graoId).toArray();
  const vendas   = await db.vendas.where('graoId').equals(graoId).toArray();
  const saldo = entradas.reduce((s, e) => s + (e.pesoKg || 0), 0)
              - vendas.reduce((s, v) => s + (v.pesoKg || 0), 0);
  aviso.classList.toggle('oculto', peso <= saldo);
}

// ── Salvar venda ──────────────────────────────────────────────────────────────
async function salvarVenda(e) {
  e.preventDefault();

  const clienteId  = Number(document.getElementById('venda-cliente').value);
  const graoId     = Number(document.getElementById('venda-grao').value);
  const pesoKg     = parseDecimal(document.getElementById('venda-peso').value);
  const precoKg    = parseDecimal(document.getElementById('venda-preco').value);
  const dataVal    = document.getElementById('venda-data').value;
  const observacao = document.getElementById('venda-obs').value.trim();
  const status     = document.querySelector('#toggle-status .toggle-ativo').dataset.valor;

  if (!clienteId) { toast('Selecione um cliente', 'erro'); return; }
  if (!pesoKg || pesoKg <= 0) { toast('Informe um peso válido', 'erro'); return; }
  if (!precoKg || precoKg <= 0) { toast('Informe um preço válido', 'erro'); return; }

  const total = pesoKg * precoKg;
  const vendaId = await db.vendas.add({ clienteId, graoId, pesoKg, precoKg, total, data: dataVal, status, observacao });

  // Venda paga → pagamento automático
  if (status === 'pago') {
    await db.pagamentos.add({ vendaId, valor: total, data: dataVal, observacao: '' });
  }

  // Persiste último preço por grão
  const cfg = await db.config.get('ultimoPrecoPorGrao');
  const mapa = cfg ? JSON.parse(cfg.valor) : {};
  mapa[graoId] = precoKg;
  await db.config.put({ chave: 'ultimoPrecoPorGrao', valor: JSON.stringify(mapa) });

  toast('Venda registrada!');
  mostrarLista();
  await renderVendas();
}

// ── Modal pagamento ───────────────────────────────────────────────────────────
async function abrirModalPagamento(vendaId, saldoDevedor) {
  document.getElementById('pagamento-venda-id').value = vendaId;
  document.getElementById('form-pagamento').reset();
  document.getElementById('pagamento-data').value = hojeISO();

  const venda   = await db.vendas.get(vendaId);
  const cliente = await db.clientes.get(venda?.clienteId);
  document.getElementById('modal-pagamento-info').innerHTML = `
    <p class="modal-sub">
      <strong>${cliente?.nome || '?'}</strong>
      &nbsp;·&nbsp; Saldo devedor: <strong class="saldo-negativo">${dinheiro(saldoDevedor)}</strong>
    </p>
  `;

  document.getElementById('modal-pagamento').classList.remove('oculto');
  setTimeout(() => document.getElementById('pagamento-valor').focus(), 50);
}

function fecharModalPagamento() {
  document.getElementById('modal-pagamento').classList.add('oculto');
}

async function salvarPagamento(e) {
  e.preventDefault();

  const vendaId    = Number(document.getElementById('pagamento-venda-id').value);
  const valor      = parseDecimal(document.getElementById('pagamento-valor').value);
  const dataVal    = document.getElementById('pagamento-data').value;
  const observacao = document.getElementById('pagamento-obs').value.trim();

  if (!valor || valor <= 0) { toast('Informe um valor válido', 'erro'); return; }

  const venda = await db.vendas.get(vendaId);
  const pags  = await db.pagamentos.where('vendaId').equals(vendaId).toArray();
  const totalPago = pags.reduce((s, p) => s + (p.valor || 0), 0);
  const saldo = (venda.total || 0) - totalPago;

  if (valor > saldo + 0.001) {
    toast(`Valor maior que o saldo (${dinheiro(saldo)})`, 'erro');
    return;
  }

  await db.pagamentos.add({ vendaId, valor, data: dataVal, observacao });

  const novoTotal = totalPago + valor;
  const novoStatus = novoTotal >= (venda.total || 0) - 0.001 ? 'pago' : 'parcial';
  await db.vendas.update(vendaId, { status: novoStatus });

  toast(`Pagamento registrado! Status: ${novoStatus}`);
  fecharModalPagamento();
  await renderVendas();
}

// ── Excluir venda + pagamentos ────────────────────────────────────────────────
async function excluirVenda(id) {
  if (!confirm('Excluir esta venda e todos os pagamentos vinculados?')) return;
  await db.pagamentos.where('vendaId').equals(id).delete();
  await db.vendas.delete(id);
  toast('Venda excluída');
  await renderVendas();
}
