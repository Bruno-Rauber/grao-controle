import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.mjs';

const db = new Dexie('GraoControle');

db.version(1).stores({
  graos:           '++id, nome',
  entradas_estoque:'++id, graoId, data',
  clientes:        '++id, nome',
  vendas:          '++id, clienteId, graoId, data, status',
  pagamentos:      '++id, vendaId, data',
  config:          'chave'
});

// Seed: insere Soja e Milho somente na primeira execução
db.on('populate', async () => {
  await db.graos.bulkAdd([
    { nome: 'Soja' },
    { nome: 'Milho' }
  ]);
});

export default db;
