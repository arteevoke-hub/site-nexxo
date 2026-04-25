import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Tiny ERP API Proxy
  app.get('/api/tiny/estoque', async (req, res) => {
    const token = process.env.TINY_API_TOKEN;
    if (!token) {
      // Mock data for demo if no token is provided
      return res.json({
        retorno: {
          status: 'OK',
          produtos: [
            { id: '1', nome: 'Camiseta Básica Preta', sku: 'CAM-001', estoque: 150, preco: 49.9, url_imagem: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&auto=format&fit=crop&q=60' },
            { id: '2', nome: 'Calça Jeans Slim', sku: 'CAL-002', estoque: 85, preco: 129.9, url_imagem: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&auto=format&fit=crop&q=60' },
            { id: '3', nome: 'Tênis Esportivo Runner', sku: 'TEN-003', estoque: 42, preco: 299.9, url_imagem: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=60' },
            { id: '4', nome: 'Boné Aba Curva', sku: 'BON-004', estoque: 210, preco: 79.9, url_imagem: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&auto=format&fit=crop&q=60' },
            { id: '5', nome: 'Moletom Canguru', sku: 'MOL-005', estoque: 0, preco: 159.9, url_imagem: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&auto=format&fit=crop&q=60' },
          ]
        }
      });
    }

    try {
      const pesq = req.query.pesquisa ? `&pesquisa=${req.query.pesquisa}` : '';
      // products search
      const response = await fetch(`https://api.tiny.com.br/api2/produtos.pesquisa.php?token=${token}&formato=json${pesq}`);
      const data = await response.json();
      
      if (data.retorno && data.retorno.status === 'Erro') {
        return res.status(401).json({ 
          error: 'Token do Tiny ERP inválido ou permissão negada.',
          details: data.retorno.erros 
        });
      }

      // If we got products, let's try to get actual stock for them to show correct quantities
      if (data.retorno && data.retorno.produtos) {
        const productsWithStock = await Promise.all(
          data.retorno.produtos.map(async (item: any) => {
            const p = item.produto;
            try {
              // Fetch stock for each product if we want high accuracy
              const stockResponse = await fetch(`https://api.tiny.com.br/api2/produto.obter.estoque.php?token=${token}&id=${p.id}&formato=json`);
              const stockData = await stockResponse.json();
              if (stockData.retorno && stockData.retorno.status === 'OK') {
                p.estoque = stockData.retorno.produto.estoque;
                // Add deposits for warehouse info
                p.depositos = stockData.retorno.produto.depositos || [];
              }
              
              // If image is still missing from search, we could fetch details, but let's try search fields first
              // Search returns url_fotos which is a string
              if (!p.url_imagem && item.url_fotos) {
                  p.url_imagem = item.url_fotos.split(' ')[0];
              }
            } catch (e) {
              // Fallback to what was in search or 0
            }
            return item;
          })
        );
        data.retorno.produtos = productsWithStock;
      }
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Erro de conexão com os servidores do Tiny ERP' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
