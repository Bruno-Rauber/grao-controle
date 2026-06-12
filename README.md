# GrãoControle

PWA offline-first para controle de vendas e estoque de grãos. Roda 100% no celular sem internet após o primeiro acesso. Todos os dados ficam no próprio dispositivo (IndexedDB).

**Funcionalidades:** vendas a prazo (fiado/parcial/pago), controle de estoque, cadastro de clientes, dashboard financeiro, backup/restauração e exportação CSV.

---

## Rodar localmente

```bash
npx serve . -l 3000
```

Abra `http://localhost:3000` no navegador. Para testar offline, vá em DevTools → Network → Offline após o primeiro carregamento.

---

## Publicar na Vercel

1. Crie uma conta em [vercel.com](https://vercel.com) (gratuito)
2. Instale a CLI: `npm i -g vercel`
3. Na pasta do projeto: `vercel --prod`
4. Aceite os padrões — a Vercel detecta automaticamente que é um site estático

Ou arraste a pasta para o dashboard da Vercel em [vercel.com/new](https://vercel.com/new).

> Para publicar atualizações basta rodar `vercel --prod` novamente. O service worker usa cache versionado (`graocontrole-v4`); para forçar atualização nos celulares dos usuários, incremente o número da versão em `sw.js` antes de publicar.

---

## Instalar na tela inicial

### Android (Chrome)
1. Abra o app no Chrome
2. Toque nos três pontos (⋮) no canto superior direito
3. Selecione **"Adicionar à tela inicial"** ou **"Instalar app"**
4. Confirme — o ícone aparece na tela inicial como um app nativo

### iPhone (Safari)
1. Abra o app no **Safari** (não funciona em outros navegadores no iOS)
2. Toque no botão de compartilhar (□↑) na barra inferior
3. Selecione **"Adicionar à Tela de Início"**
4. Confirme o nome e toque em **Adicionar**

---

## Backup e offline

- Os dados ficam **só no dispositivo**. Use a aba Ajustes para fazer backup regularmente.
- O app avisa automaticamente se o backup tiver mais de 15 dias.
- Para trocar de celular: faça backup → mande o arquivo para o novo aparelho → restaure na aba Ajustes.
