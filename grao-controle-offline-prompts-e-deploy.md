# GrãoControle (versão offline) — Prompts para Claude Code + Deploy

Sistema 100% client-side (sem backend): PWA que roda no celular, guarda os dados no aparelho (IndexedDB) e funciona sem internet. Hospedagem gratuita na Vercel.

**Como usar:** crie uma pasta vazia (ex: `grao-controle`), abra o Claude Code dentro dela e rode os prompts em sequência. Teste cada etapa no navegador antes da próxima (basta abrir o `index.html` com um servidor local — o Prompt 1 já configura isso).

---

## Prompt 1 — Base do projeto e banco de dados local

```
Crie a base de um PWA chamado "GrãoControle" para um classificador de grãos que
vende amostras de soja e milho por kg a produtores rurais. Uso pessoal, um único
usuário, 99% pelo celular, frequentemente SEM internet.

Arquitetura:
- 100% client-side: HTML + CSS + JavaScript puro, SEM backend, SEM frameworks
- Dados gravados no IndexedDB usando a biblioteca Dexie.js (via CDN)
- Estrutura de arquivos simples, com index.html na raiz (pronta para deploy
  estático na Vercel depois)
- SPA: uma página única com seções trocadas via JS, e abas fixas no rodapé:
  Início, Vendas, Estoque, Clientes, Ajustes (por enquanto podem ficar vazias,
  só com a navegação funcionando)

Nesta etapa, crie:
1. index.html, css/estilo.css, js/db.js, js/app.js
2. js/db.js com o banco Dexie e as stores:
   - graos: id, nome (inserir "Soja" e "Milho" como seed na primeira execução)
   - entradas_estoque: id, graoId, pesoKg, data, observacao
   - clientes: id, nome, telefone, observacao
   - vendas: id, clienteId, graoId, pesoKg, precoKg, total, data,
     status ('pago' | 'fiado' | 'parcial'), observacao
   - pagamentos: id, vendaId, valor, data, observacao
   - config: chave/valor (para ultimoBackup e ultimoPrecoPorGrao)
3. js/util.js com funções de formatação:
   - dinheiro: R$ 1.234,56
   - peso: 1.234,50 kg
   - data: exibir DD/MM/AAAA (armazenar como YYYY-MM-DD)
   - parseDecimal: converter texto com VÍRGULA (ex: "12,5") em número

Visual: mobile-first, tema verde claro (agro), fundo claro, cards com sombra
leve, botões grandes (mínimo 44px de área de toque).

Para eu testar localmente, adicione um package.json com script "dev" que sobe
um servidor estático simples (ex: npx serve). Ao final, me diga como rodar e
confirme que o app abre com as abas funcionando e o seed criado (posso conferir
no DevTools > Application > IndexedDB).
```

---

## Prompt 2 — Clientes e Estoque

```
Agora implemente as telas de Clientes e Estoque.

CLIENTES:
- Lista de clientes com campo de busca por nome
- Botão "+ Novo cliente" abrindo formulário: nome (obrigatório), telefone,
  observação
- Editar e excluir cliente (excluir só se ele não tiver vendas; senão, avisar)
- Ao tocar num cliente: tela de detalhe com histórico de compras dele e total
  que ele deve (deixe o histórico preparado, mesmo que vendas ainda não existam)

ESTOQUE:
- Topo: saldo atual por grão em kg
  Regra: saldo = soma das entradas − soma dos pesos vendidos (sempre calculado,
  nunca armazenado)
- Formulário de entrada de amostra: grão (select), peso em kg (aceitar vírgula),
  data (padrão hoje), observação
- Histórico de entradas (mais recentes primeiro), com opção de excluir

Geral:
- Campos numéricos com inputmode="decimal" (teclado numérico no celular)
- Confirmação antes de excluir qualquer registro
- Toast simples de sucesso/erro
- Estados vazios amigáveis ("Nenhum cliente cadastrado ainda")

Teste criando 2 clientes e 2 entradas de estoque e me confirme que o saldo
aparece certo.
```

---

## Prompt 3 — Vendas, pagamentos e tela Início

```
Agora a parte central do sistema: vendas e pagamentos.

NOVA VENDA (essa é a tela mais usada — otimize para o mínimo de toques):
- Campos: cliente (select com busca), grão, peso em kg, preço por kg,
  data (padrão hoje), status Pago/Fiado (botões de alternância, padrão Pago),
  observação opcional
- Total = peso × preço, calculado e exibido em tempo real enquanto digita
- Ao escolher o grão, preencher o preço/kg com o último valor usado para
  aquele grão (guardado em config.ultimoPrecoPorGrao)
- Se o peso vendido for maior que o saldo em estoque do grão, mostrar aviso,
  mas permitir salvar
- Venda com status 'pago' gera automaticamente um registro em pagamentos com
  o valor total na mesma data

LISTA DE VENDAS:
- Mais recentes primeiro, com filtros por status e por grão
- Cada item mostra: data, cliente, grão, kg, total, status (com cor:
  verde=pago, vermelho=fiado, amarelo=parcial) e saldo devedor se houver
- Vendas fiado/parcial têm botão "Registrar pagamento" abrindo modal com
  valor (aceitar vírgula) e data
  - Não permitir pagar mais que o saldo devedor
  - Status atualiza sozinho: quitou tudo → 'pago'; pagou parte → 'parcial'
- Excluir venda remove também seus pagamentos

TELA INÍCIO (dashboard):
- Cards: Arrecadado no mês (soma de pagamentos do mês atual), A receber
  (saldo devedor total), Estoque de cada grão em kg
- Lista "Quem está devendo": nome do cliente, valor devido, data da venda
  em aberto mais antiga
- Botão grande e destacado "+ Nova venda" que leva direto ao formulário

Conecte também o histórico no detalhe do cliente (compras + dívida), criado
no prompt anterior.

Teste o fluxo completo e me confirme: venda fiada → pagamento parcial
(status vira 'parcial') → quitação (status vira 'pago') → dashboard reflete
os valores.
```

---

## Prompt 4 — Ajustes: backup, restauração e exportação

```
Como os dados ficam só no celular, backup é a função mais importante desta
etapa. Implemente a aba Ajustes:

1. FAZER BACKUP:
   - Botão que exporta TODOS os dados (todas as stores) em um único arquivo
     JSON, nomeado graocontrole-backup-AAAA-MM-DD.json
   - No celular, usar a Web Share API se disponível (para mandar direto pro
     WhatsApp/Drive); senão, download normal
   - Ao concluir, gravar a data em config.ultimoBackup

2. RESTAURAR BACKUP:
   - Botão que abre seletor de arquivo, valida o JSON e importa os dados
   - Avisar claramente que a restauração SUBSTITUI os dados atuais, com
     confirmação antes
   - Tratar arquivo inválido com mensagem amigável

3. LEMBRETE DE BACKUP:
   - Se o último backup tiver mais de 15 dias (ou nunca tiver sido feito),
     mostrar uma faixa de aviso no topo do app: "Você não faz backup há X
     dias. Toque aqui para fazer agora."

4. EXPORTAR VENDAS EM CSV:
   - Botão com seleção de período (de/até)
   - Colunas: data, cliente, grão, kg, preço/kg, total, status, total pago
   - Valores no formato brasileiro e separador ponto-e-vírgula (;) para abrir
     certo no Excel em português

5. Na aba Ajustes, mostrar também: data do último backup e total de registros
   no banco (vendas, clientes, entradas).
```

---

## Prompt 5 — PWA: instalação e funcionamento offline

```
Transforme o app em um PWA instalável e 100% funcional offline:

1. manifest.json: nome "GrãoControle", short_name "GrãoControle", ícone SVG
   simples (grão estilizado em verde) nos tamanhos exigidos, display
   "standalone", orientação "portrait", theme_color e background_color no
   verde do tema
2. Meta tags no HTML: theme-color, apple-touch-icon, viewport correto
3. Service worker (sw.js) que:
   - Cacheia TODOS os arquivos do app no install (HTML, CSS, JS, ícones e a
     Dexie.js do CDN), para funcionar totalmente offline após o primeiro acesso
   - Estratégia cache-first
   - Use um nome de cache com versão (ex: graocontrole-v1) e, na ativação,
     delete caches de versões antigas — assim, quando eu publicar atualização,
     basta incrementar a versão que os celulares recebem o app novo
4. Revisão final mobile:
   - Conferir que todo formulário importante cabe na tela sem rolagem excessiva
   - Nenhuma interação dependente de hover
   - Testar que o app abre e funciona com a rede desligada (DevTools > Network
     > Offline)

5. Escreva um README.md curto com: o que é o sistema, como rodar localmente,
   como publicar na Vercel e como instalar na tela inicial do Android e do
   iPhone.

Me confirme que o app passa no teste offline.
```

---

# Subindo para o GitHub

Pré-requisito: Git instalado e uma conta no GitHub (você já tem os dois).

**1. Crie o repositório no GitHub:**
- Acesse github.com → botão **New** (ou github.com/new)
- Nome: `grao-controle` → pode deixar **privado**
- **Não** marque "Add a README" (o projeto já tem um)
- Clique em **Create repository**

**2. No terminal, dentro da pasta do projeto:**

```bash
git init
git add .
git commit -m "GrãoControle v1"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/grao-controle.git
git push -u origin main
```

(Troque `SEU_USUARIO` pelo seu usuário do GitHub. A própria página do repositório recém-criado mostra esses comandos prontos pra copiar.)

**3. Para publicar atualizações depois** (sempre que mexer no código):

```bash
git add .
git commit -m "descrição do que mudou"
git push
```

> 💡 Dica: você pode pedir isso pro próprio Claude Code — "suba este projeto para um novo repositório no GitHub chamado grao-controle" — e ele roda os comandos por você.

---

# Publicando na Vercel

**1. Primeira publicação:**
- Acesse [vercel.com](https://vercel.com) e entre com **Continue with GitHub**
- No painel: **Add New → Project**
- Na lista de repositórios, clique em **Import** no `grao-controle`
  - Se ele não aparecer, clique em "Adjust GitHub App Permissions" e libere o acesso ao repositório
- Na tela de configuração:
  - **Framework Preset:** Other
  - **Build Command:** deixe vazio
  - **Output Directory:** deixe vazio (raiz)
- Clique em **Deploy**

Em ~1 minuto sai uma URL tipo `grao-controle.vercel.app`. É essa URL que seu padrasto vai abrir.

**2. Atualizações são automáticas:** todo `git push` na branch `main` dispara um novo deploy na Vercel sozinho. Você não precisa fazer nada no site deles.

> ⚠️ Importante por causa do service worker: quando publicar uma atualização, lembre de **incrementar a versão do cache** no `sw.js` (de `graocontrole-v1` para `v2`, etc.) — o Prompt 5 já estrutura isso. Sem incrementar, o celular pode continuar mostrando a versão antiga em cache. Pode pedir pro Claude Code: "incremente a versão do cache do service worker" antes de cada push.

---

# Instalando no celular do seu padrasto

**Android (Chrome):**
1. Abra a URL da Vercel no Chrome
2. Toque no menu ⋮ → **"Adicionar à tela inicial"** (ou aceite o aviso "Instalar app" que aparece sozinho)
3. O ícone aparece na tela inicial e abre em tela cheia, como um app

**iPhone (Safari):**
1. Abra a URL no Safari (tem que ser o Safari)
2. Toque no botão de compartilhar (quadrado com seta) → **"Adicionar à Tela de Início"**

Depois de instalado, funciona sem internet. Internet só é necessária quando você publicar uma atualização do app.

**Recomendação final:** ensine o ritual do backup pra ele desde o primeiro dia — abrir Ajustes → Fazer backup → mandar o arquivo pro próprio WhatsApp. Os dados moram só naquele celular; o backup é o seguro contra troca/perda do aparelho.
