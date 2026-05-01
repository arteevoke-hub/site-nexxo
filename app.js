import express from 'express';
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>🚀 SISTEMA NEXXO: O SERVIDOR ESTÁ VIVO!</h1><p>Se você está vendo isso, a infraestrutura da Hostinger está funcionando. O erro anterior era no código do servidor.</p>');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de teste rodando na porta ${PORT}`);
});
