# Manual de Deploy - Hostinger (Nexxo)

Para garantir que o site funcione sempre na Hostinger, siga estas regras técnicas:

## 1. Arquivo de Inicialização (index.js)
A Hostinger exige um arquivo `.js` na raiz. Criamos o `index.js` que carrega o TypeScript corretamente. No painel da Hostinger (hPanel), o campo "Application startup file" deve ser:
`index.js`

## 2. Porta e Host
O servidor deve sempre ouvir na porta dinâmica da Hostinger e no host `0.0.0.0`.
*   Porta: `process.env.PORT || 3000`
*   Host: `'0.0.0.0'`

## 3. Servindo o Frontend
Como o projeto usa Vite (React), o servidor Express **precisa** servir a pasta `dist`.
O comando de build (`npm run build`) gera essa pasta. Se ela não existir ou o servidor não a servir, o site mostrará erro.

## 4. Comandos de Build no Painel
Sempre execute nesta ordem no painel da Hostinger se houver erros:
1. `npm install`
2. `npm run build`

## 5. Limitações de PDF (Puppeteer)
O Puppeteer **não roda** em hospedagem compartilhada da Hostinger (Shared/Business). Ele exige VPS. Se precisar de PDFs em planos comuns, precisamos trocar a biblioteca por uma que não dependa do Chrome (ex: `jspdf` no frontend ou `pdfkit`).

---
*Este documento é o padrão de ouro do projeto. Não altere as configurações de porta ou caminhos de arquivos sem consultá-lo.*
