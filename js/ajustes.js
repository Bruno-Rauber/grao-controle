import db from './db.js';
import { data as fmtData, hojeISO } from './util.js';
import { toast } from './toast.js';

// ── Lembrete de backup ─────────────────────────────────────────────────────────
export async function verificarLembreteBackup() {
  const banner = document.getElementById('banner-backup');
  if (!banner) return;

  const cfg = await db.config.get('ultimoBackup');
  if (!cfg) {
    banner.textContent = 'Você nunca fez backup. Toque aqui para fazer agora.';
    banner.classList.remove('oculto');
    return;
  }

  const diasSemBackup = Math.floor((Date.now() - new Date(cfg.valor).getTime()) / 86400000);
  if (diasSemBackup >= 15) {
    banner.textContent = `Você não faz backup há ${diasSemBackup} dias. Toque aqui para fazer agora.`;
    banner.classList.remove('oculto');
  } else {
    banner.classList.add('oculto');
  }
}

// ── Init (chamado uma vez no startup) ─────────────────────────────────────────
export function initAjustes() {
  document.getElementById('banner-backup').addEventListener('click', fazerBackup);
  document.getElementById('btn-fazer-backup').addEventListener('click', fazerBackup);
  document.getElementById('btn-restaurar-backup').addEventListener('click', () => {
    document.getElementById('input-restaurar').click();
  });
  document.getElementById('input-restaurar').addEventListener('change', restaurarBackup);
  document.getElementById('btn-exportar-csv').addEventListener('click', exportarCSV);
}

// ── Render (chamado ao navegar para a aba) ────────────────────────────────────
export async function renderAjustes() {
  const [nVendas, nClientes, nEntradas, cfg] = await Promise.all([
    db.vendas.count(),
    db.clientes.count(),
    db.entradas_estoque.count(),
    db.config.get('ultimoBackup'),
  ]);

  document.getElementById('ajustes-total-vendas').textContent = nVendas;
  document.getElementById('ajustes-total-clientes').textContent = nClientes;
  document.getElementById('ajustes-total-entradas').textContent = nEntradas;
  document.getElementById('ajustes-ultimo-backup').textContent = cfg ? fmtData(cfg.valor) : 'Nunca';

  const hoje = hojeISO();
  const ate = document.getElementById('csv-ate');
  const de  = document.getElementById('csv-de');
  if (!ate.value) ate.value = hoje;
  if (!de.value) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    de.value = d.toISOString().slice(0, 10);
  }
}

// ── Fazer Backup ───────────────────────────────────────────────────────────────
async function fazerBackup() {
  try {
    const [graos, entradas_estoque, clientes, vendas, pagamentos, config] = await Promise.all([
      db.graos.toArray(),
      db.entradas_estoque.toArray(),
      db.clientes.toArray(),
      db.vendas.toArray(),
      db.pagamentos.toArray(),
      db.config.toArray(),
    ]);

    const backup = {
      versao: 1,
      exportadoEm: new Date().toISOString(),
      dados: { graos, entradas_estoque, clientes, vendas, pagamentos, config },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const hoje = hojeISO();
    const nomeArquivo = `graocontrole-backup-${hoje}.json`;

    if (navigator.canShare) {
      const file = new File([blob], nomeArquivo, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'GrãoControle Backup' });
      } else {
        baixarArquivo(blob, nomeArquivo);
      }
    } else {
      baixarArquivo(blob, nomeArquivo);
    }

    await db.config.put({ chave: 'ultimoBackup', valor: hoje });

    document.getElementById('ajustes-ultimo-backup').textContent = fmtData(hoje);
    document.getElementById('banner-backup').classList.add('oculto');
    toast('Backup realizado com sucesso!', 'sucesso');
  } catch (err) {
    if (err?.name !== 'AbortError') toast('Erro ao fazer backup', 'erro');
  }
}

// ── Restaurar Backup ───────────────────────────────────────────────────────────
async function restaurarBackup(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    toast('Arquivo inválido. Selecione um backup do GrãoControle.', 'erro');
    return;
  }

  if (!backup.versao || !backup.dados) {
    toast('Arquivo inválido. Selecione um backup do GrãoControle.', 'erro');
    return;
  }

  const exportadoEm = backup.exportadoEm
    ? new Date(backup.exportadoEm).toLocaleDateString('pt-BR')
    : 'data desconhecida';

  const confirmar = confirm(
    `⚠️ ATENÇÃO: Esta ação irá SUBSTITUIR todos os dados atuais pelo backup.\n\nBackup de: ${exportadoEm}\n\nDeseja continuar?`
  );
  if (!confirmar) return;

  try {
    const d = backup.dados;
    await db.transaction('rw', [db.graos, db.entradas_estoque, db.clientes, db.vendas, db.pagamentos, db.config], async () => {
      await Promise.all([
        db.graos.clear(), db.entradas_estoque.clear(), db.clientes.clear(),
        db.vendas.clear(), db.pagamentos.clear(), db.config.clear(),
      ]);
      if (d.graos?.length)            await db.graos.bulkAdd(d.graos);
      if (d.entradas_estoque?.length) await db.entradas_estoque.bulkAdd(d.entradas_estoque);
      if (d.clientes?.length)         await db.clientes.bulkAdd(d.clientes);
      if (d.vendas?.length)           await db.vendas.bulkAdd(d.vendas);
      if (d.pagamentos?.length)       await db.pagamentos.bulkAdd(d.pagamentos);
      if (d.config?.length)           await db.config.bulkAdd(d.config);
    });

    toast('Dados restaurados com sucesso!', 'sucesso');
    renderAjustes();
    verificarLembreteBackup();
  } catch (err) {
    toast('Erro ao restaurar. O arquivo pode estar corrompido.', 'erro');
    console.error(err);
  }
}

// ── Exportar CSV ───────────────────────────────────────────────────────────────
async function exportarCSV() {
  const de  = document.getElementById('csv-de').value;
  const ate = document.getElementById('csv-ate').value;

  if (!de || !ate) { toast('Selecione o período para exportar', 'erro'); return; }
  if (de > ate)    { toast('A data inicial deve ser anterior à data final', 'erro'); return; }

  const [clientes, graos, vendas, pagamentos] = await Promise.all([
    db.clientes.toArray(),
    db.graos.toArray(),
    db.vendas.where('data').between(de, ate, true, true).toArray(),
    db.pagamentos.toArray(),
  ]);

  if (!vendas.length) { toast('Nenhuma venda no período selecionado', 'erro'); return; }

  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nome]));
  const graoMap    = Object.fromEntries(graos.map(g => [g.id, g.nome]));
  const pagsPorVenda = {};
  pagamentos.forEach(p => { pagsPorVenda[p.vendaId] = (pagsPorVenda[p.vendaId] || 0) + p.valor; });

  const numBR = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statusLabel = { pago: 'Pago', fiado: 'Fiado', parcial: 'Parcial' };

  const cabecalho = ['Data', 'Cliente', 'Grão', 'Kg', 'Preço/Kg', 'Total', 'Status', 'Total Pago'].join(';');
  const linhas = vendas.map(v => [
    fmtData(v.data),
    clienteMap[v.clienteId] || '',
    graoMap[v.graoId] || '',
    numBR(v.pesoKg),
    numBR(v.precoKg),
    numBR(v.total),
    statusLabel[v.status] || v.status,
    numBR(pagsPorVenda[v.id] || 0),
  ].join(';'));

  // BOM (U+FEFF) para Excel abrir corretamente em português
  const csv  = '﻿' + [cabecalho, ...linhas].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  baixarArquivo(blob, `graocontrole-vendas-${de}-a-${ate}.csv`);
  toast(`${vendas.length} venda(s) exportada(s)`, 'sucesso');
}

// ── Utilitário ─────────────────────────────────────────────────────────────────
function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
