import db from './db.js';
import { data as fmtData, dinheiro } from './util.js';
import { toast } from './toast.js';

let clienteEditandoId = null;

export function initClientes() {
  document.getElementById('btn-novo-cliente').addEventListener('click', () => abrirModal(null));
  document.getElementById('busca-cliente').addEventListener('input', e => renderClientes(e.target.value));
  document.getElementById('btn-cancelar-cliente').addEventListener('click', fecharModal);
  document.getElementById('modal-cliente').addEventListener('click', e => {
    if (e.target.id === 'modal-cliente') fecharModal();
  });
  document.getElementById('form-cliente').addEventListener('submit', salvarCliente);
  document.getElementById('btn-voltar-clientes').addEventListener('click', mostrarLista);

  renderClientes();
}

export async function renderClientes(busca = '') {
  let clientes = await db.clientes.orderBy('nome').toArray();
  if (busca) {
    const q = busca.toLowerCase();
    clientes = clientes.filter(c => c.nome.toLowerCase().includes(q));
  }

  const container = document.getElementById('clientes-lista');
  if (!clientes.length) {
    container.innerHTML = `<p class="vazio">${busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}</p>`;
    return;
  }

  container.innerHTML = clientes.map(c => `
    <div class="list-item list-item-clicavel">
      <div class="list-item-info" data-action="detalhe" data-id="${c.id}">
        <strong>${c.nome}</strong>
        ${c.telefone ? `<span>📞 ${c.telefone}</span>` : ''}
        ${c.observacao ? `<span class="obs">${c.observacao}</span>` : ''}
      </div>
      <div class="list-item-acoes">
        <button class="btn-icone" data-action="editar" data-id="${c.id}" title="Editar">✏️</button>
        <button class="btn-icone" data-action="excluir" data-id="${c.id}" title="Excluir">🗑️</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-action="detalhe"]').forEach(el =>
    el.addEventListener('click', () => abrirDetalhe(Number(el.dataset.id)))
  );
  container.querySelectorAll('[data-action="editar"]').forEach(el =>
    el.addEventListener('click', e => { e.stopPropagation(); abrirModal(Number(el.dataset.id)); })
  );
  container.querySelectorAll('[data-action="excluir"]').forEach(el =>
    el.addEventListener('click', e => { e.stopPropagation(); excluirCliente(Number(el.dataset.id)); })
  );
}

async function abrirDetalhe(id) {
  const cliente = await db.clientes.get(id);
  if (!cliente) return;

  const vendas   = await db.vendas.where('clienteId').equals(id).toArray();
  const graos    = await db.graos.toArray();
  const graoMap  = Object.fromEntries(graos.map(g => [g.id, g.nome]));

  // Saldo devedor: calculado venda a venda para não misturar pagamentos de vendas já quitadas
  const idsVendas = vendas.map(v => v.id);
  const pagamentos = idsVendas.length
    ? await db.pagamentos.where('vendaId').anyOf(idsVendas).toArray()
    : [];
  const pagsPorVenda = {};
  pagamentos.forEach(p => { pagsPorVenda[p.vendaId] = (pagsPorVenda[p.vendaId] || 0) + p.valor; });
  const saldo = vendas.reduce((s, v) => {
    if (v.status === 'pago') return s;
    return s + Math.max(0, (v.total || 0) - (pagsPorVenda[v.id] || 0));
  }, 0);

  document.getElementById('clientes-detalhe-content').innerHTML = `
    <div class="detalhe-header card">
      <h2>${cliente.nome}</h2>
      ${cliente.telefone ? `<p class="texto-2">📞 ${cliente.telefone}</p>` : ''}
      ${cliente.observacao ? `<p class="texto-2">${cliente.observacao}</p>` : ''}
    </div>
    <div class="card${saldo > 0 ? ' card-alerta' : ''}">
      <h2>Situação financeira</h2>
      <div class="saldo-item">
        <span>Saldo devedor</span>
        <span class="saldo-valor${saldo > 0 ? ' saldo-negativo' : ''}">${dinheiro(saldo)}</span>
      </div>
      <div class="saldo-item">
        <span>Total de compras</span>
        <span class="saldo-valor">${vendas.length}</span>
      </div>
    </div>
    <div class="card">
      <h2>Histórico de compras</h2>
      ${vendas.length === 0
        ? '<p class="vazio">Nenhuma compra registrada</p>'
        : vendas.slice().reverse().map(v => `
          <div class="list-item">
            <div class="list-item-info">
              <strong>${graoMap[v.graoId] || '?'} — ${dinheiro(v.total)}</strong>
              <span>${fmtData(v.data)} · <span class="badge badge-${v.status}">${v.status}</span></span>
            </div>
          </div>
        `).join('')
      }
    </div>
  `;

  document.getElementById('clientes-lista-view').classList.add('oculto');
  document.getElementById('clientes-detalhe-view').classList.remove('oculto');
}

function mostrarLista() {
  document.getElementById('clientes-lista-view').classList.remove('oculto');
  document.getElementById('clientes-detalhe-view').classList.add('oculto');
}

async function abrirModal(id) {
  clienteEditandoId = id;
  document.getElementById('form-cliente').reset();
  document.getElementById('modal-cliente-titulo').textContent = id ? 'Editar Cliente' : 'Novo Cliente';

  if (id) {
    const c = await db.clientes.get(id);
    document.getElementById('cliente-nome').value = c.nome;
    document.getElementById('cliente-telefone').value = c.telefone || '';
    document.getElementById('cliente-obs').value = c.observacao || '';
  }

  document.getElementById('modal-cliente').classList.remove('oculto');
  setTimeout(() => document.getElementById('cliente-nome').focus(), 50);
}

function fecharModal() {
  document.getElementById('modal-cliente').classList.add('oculto');
  clienteEditandoId = null;
}

async function salvarCliente(e) {
  e.preventDefault();
  const nome      = document.getElementById('cliente-nome').value.trim();
  const telefone  = document.getElementById('cliente-telefone').value.trim();
  const observacao= document.getElementById('cliente-obs').value.trim();

  if (!nome) { toast('Nome é obrigatório', 'erro'); return; }

  if (clienteEditandoId) {
    await db.clientes.update(clienteEditandoId, { nome, telefone, observacao });
    toast('Cliente atualizado!');
  } else {
    await db.clientes.add({ nome, telefone, observacao });
    toast('Cliente cadastrado!');
  }

  fecharModal();
  renderClientes(document.getElementById('busca-cliente').value);
}

async function excluirCliente(id) {
  const total = await db.vendas.where('clienteId').equals(id).count();
  if (total > 0) {
    toast(`Este cliente possui ${total} venda(s) e não pode ser excluído`, 'erro');
    return;
  }
  if (!confirm('Excluir este cliente permanentemente?')) return;
  await db.clientes.delete(id);
  toast('Cliente excluído');
  renderClientes(document.getElementById('busca-cliente').value);
}
