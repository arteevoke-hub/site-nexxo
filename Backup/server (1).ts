import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import { google } from 'googleapis';
import multer from 'multer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { Readable } from 'stream';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory Cache to prevent API blocking and speed up loading
const detailCache = new Map<string, any>();
const stockCache = new Map<string, { data: any, timestamp: number }>();
const STOCK_CACHE_TTL = 1000 * 60 * 2; // 2 minutes for stock cache

// Definição das ferramentas que o agente pode usar no Tiny ERP
const TINY_TOOLS = [
  {
    name: 'buscar_produtos',
    description: 'Busca produtos no Tiny ERP por nome, SKU ou código.',
    input_schema: {
      type: 'object',
      properties: {
        pesquisa: { type: 'string', description: 'Termo de busca: nome, SKU ou código' },
        pagina: { type: 'number', description: 'Página (padrão: 1)' },
      },
      required: ['pesquisa'],
    },
  },
  {
    name: 'obter_produto',
    description: 'Obtém todos os detalhes de um produto do Tiny pelo ID, incluindo variações, estoque por depósito e imagens.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do produto no Tiny ERP' },
      },
      required: ['id'],
    },
  },
  {
    name: 'criar_produto_com_variacoes',
    description: 'Cria um produto com variações (grade de tamanhos, cores etc) no Tiny ERP.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome do produto' },
        codigo: { type: 'string', description: 'SKU base' },
        preco: { type: 'number', description: 'Preço base' },
        unidade: { type: 'string', description: 'Unidade (padrão: UN)' },
        ncm: { type: 'string', description: 'NCM' },
        marca: { type: 'string' },
        categoria: { type: 'string' },
        descricao: { type: 'string' },
        variacoes: {
          type: 'array',
          description: 'Lista de variações',
          items: {
            type: 'object',
            properties: {
              grade1: { type: 'string', description: 'Ex: Tamanho: P' },
              grade2: { type: 'string', description: 'Ex: Cor: Azul' },
              codigo: { type: 'string' },
              preco: { type: 'number' },
              estoque: { type: 'number' },
            },
            required: ['grade1'],
          },
        },
      },
      required: ['nome', 'preco', 'variacoes'],
    },
  },
  {
    name: 'criar_kit',
    description: 'Cria um kit/combo no Tiny ERP composto por outros produtos.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        codigo: { type: 'string' },
        preco: { type: 'number' },
        descricao: { type: 'string' },
        categoria: { type: 'string' },
        componentes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID do produto componente' },
              codigo: { type: 'string' },
              quantidade: { type: 'number' },
            },
            required: ['quantidade'],
          },
        },
      },
      required: ['nome', 'preco', 'componentes'],
    },
  },
  {
    name: 'atualizar_produto',
    description: 'Atualiza dados de um produto existente no Tiny.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do produto no Tiny' },
        nome: { type: 'string' },
        preco: { type: 'number' },
        preco_promocional: { type: 'number' },
        ncm: { type: 'string' },
        descricao: { type: 'string' },
        marca: { type: 'string' },
        categoria: { type: 'string' },
        situacao: { type: 'string', enum: ['A', 'I'], description: 'A = Ativo, I = Inativo' },
      },
      required: ['id'],
    },
  },
  {
    name: 'duplicar_como_variacoes',
    description: 'Busca um produto existente no Tiny e cria uma versão nova com variações baseada nele.',
    input_schema: {
      type: 'object',
      properties: {
        id_original: { type: 'string', description: 'ID do produto original' },
        novo_nome: { type: 'string' },
        variacoes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              grade1: { type: 'string' },
              grade2: { type: 'string' },
              sufixo_codigo: { type: 'string' },
              preco: { type: 'number' },
              estoque: { type: 'number' },
            },
            required: ['grade1'],
          },
        },
      },
      required: ['id_original', 'variacoes'],
    },
  },
  {
    name: 'criar_produto_fabricado',
    description: 'Cria um Produto Fabricado (Tipo F) com estrutura de produção (componentes/insumos) no Tiny ERP.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        codigo: { type: 'string' },
        preco: { type: 'number' },
        descricao: { type: 'string' },
        categoria: { type: 'string' },
        componentes: {
          type: 'array',
          description: 'Lista de insumos/matérias-primas que compõem este produto',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID do insumo' },
              quantidade: { type: 'number', description: 'Quantidade consumida' },
            },
            required: ['id', 'quantidade'],
          },
        },
      },
      required: ['nome', 'preco', 'componentes'],
    },
  },
  {
    name: 'adicionar_estrutura_producao',
    description: 'Adiciona ou atualiza a estrutura de produção (componentes/insumos) de um produto ou de uma variação (filha) existente no Tiny ERP. Essencial para transformar variações em produtos Fabricados.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID exato do produto ou da variação que receberá a estrutura' },
        tipo: { type: 'string', enum: ['F', 'K'], description: 'F para Produto Fabricado, K para Kit' },
        componentes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID numérico do insumo/componente no Tiny' },
              quantidade: { type: 'number', description: 'Quantidade consumida' },
            },
            required: ['id', 'quantidade'],
          },
        },
      },
      required: ['id', 'tipo', 'componentes'],
    },
  },
];

// Executor das ferramentas — chama a API do Tiny
async function executarFerramenta(nome: string, input: any, token: string): Promise<string> {
  const BASE = 'https://api.tiny.com.br/api2';

  const get = async (endpoint: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams({ token, formato: 'json', ...params });
    const r = await fetch(`${BASE}/${endpoint}?${qs}`);
    const d = await r.json() as any;
    if (d?.retorno?.status === 'Erro') {
      throw new Error(d.retorno.erros?.map((e: any) => e.erro).join(', '));
    }
    return d?.retorno;
  };

  const post = async (endpoint: string, xml: string) => {
    const body = new URLSearchParams({ token, formato: 'json', xml });
    const r = await fetch(`${BASE}/${endpoint}`, { method: 'POST', body });
    const d = await r.json() as any;
    if (d?.retorno?.status === 'Erro') {
      throw new Error(d.retorno.erros?.map((e: any) => e.erro).join(', '));
    }
    return d?.retorno;
  };

  const campo = (tag: string, val: any) =>
    val != null && val !== '' ? `<${tag}>${String(val).replace(/&/g, '&amp;')}</${tag}>` : '';

  switch (nome) {
    case 'buscar_produtos': {
      const r = await get('produtos.pesquisa.php', { pesquisa: input.pesquisa, pagina: String(input.pagina ?? 1) });
      const lista = (r?.produtos ?? []).map((p: any) =>
        `ID: ${p.produto.id} | ${p.produto.nome} | SKU: ${p.produto.sku ?? '—'} | Estoque: ${p.produto.estoque ?? '?'} | R${p.produto.preco ?? '?'}`
      ).join('\n');
      return lista || 'Nenhum produto encontrado.';
    }

    case 'obter_produto': {
      const [det, est] = await Promise.all([
        get('produto.obter.php', { id: input.id }),
        get('produto.obter.estoque.php', { id: input.id }),
      ]);
      return JSON.stringify({
        ...det?.produto,
        estoque_total: est?.produto?.estoque,
        depositos: est?.produto?.depositos,
      }, null, 2);
    }

    case 'criar_produto_com_variacoes': {
      const varXml = (input.variacoes ?? []).map((v: any) => `<variacao>
        ${campo('grade1', v.grade1)}${campo('grade2', v.grade2)}
        ${campo('codigo', v.codigo)}${campo('preco', v.preco ?? input.preco)}
        ${campo('estoque', v.estoque ?? 0)}
      </variacao>`).join('');
      const xml = `<produto>
        ${campo('nome', input.nome)}${campo('codigo', input.codigo)}
        ${campo('preco', input.preco)}${campo('tipo', 'V')}
        ${campo('unidade', input.unidade ?? 'UN')}${campo('ncm', input.ncm)}
        ${campo('marca', input.marca)}${campo('categoria', input.categoria)}
        ${campo('descricao', input.descricao)}
        <variacoes>${varXml}</variacoes>
      </produto>`;
      const r = await post('produto.incluir.php', xml);
      const id = r?.registros?.[0]?.registro?.id ?? '?';
      return `Produto "${input.nome}" criado com sucesso! ID: ${id}. ${input.variacoes.length} variações cadastradas: ${input.variacoes.map((v: any) => v.grade1 + (v.grade2 ? '/' + v.grade2 : '')).join(', ')}.`;
    }

    case 'criar_kit': {
      const compXml = (input.componentes ?? []).map((c: any) => `<componente>
        ${campo('id', c.id)}${campo('codigo', c.codigo)}${campo('quantidade', c.quantidade)}
      </componente>`).join('');
      const xml = `<produto>
        ${campo('nome', input.nome)}${campo('codigo', input.codigo)}
        ${campo('preco', input.preco)}${campo('tipo', 'K')}
        ${campo('unidade', 'UN')}${campo('descricao', input.descricao)}
        ${campo('categoria', input.categoria)}
        <componentes>${compXml}</componentes>
      </produto>`;
      const r = await post('produto.incluir.php', xml);
      const id = r?.registros?.[0]?.registro?.id ?? '?';
      return `Kit "${input.nome}" criado! ID: ${id}. Composto por ${input.componentes.length} produto(s).`;
    }

    case 'atualizar_produto': {
      const xml = `<produto>
        ${campo('id', input.id)}${campo('nome', input.nome)}
        ${campo('preco', input.preco)}${campo('preco_promocional', input.preco_promocional)}
        ${campo('ncm', input.ncm)}${campo('descricao', input.descricao)}
        ${campo('marca', input.marca)}${campo('categoria', input.categoria)}
        ${campo('situacao', input.situacao)}
      </produto>`;
      await post('produto.alterar.php', xml);
      return `Produto ID ${input.id} atualizado com sucesso!`;
    }

    case 'duplicar_como_variacoes': {
      const det = await get('produto.obter.php', { id: input.id_original });
      const orig = det?.produto ?? {};
      const varXml = (input.variacoes ?? []).map((v: any) => `<variacao>
        ${campo('grade1', v.grade1)}${campo('grade2', v.grade2)}
        ${campo('codigo', orig.codigo ? `${orig.codigo}-${v.sufixo_codigo ?? v.grade1.split(':').pop()?.trim()}` : '')}
        ${campo('preco', v.preco ?? orig.preco)}${campo('estoque', v.estoque ?? 0)}
      </variacao>`).join('');
      const xml = `<produto>
        ${campo('nome', input.novo_nome ?? orig.nome)}
        ${campo('codigo', orig.codigo ? orig.codigo + '-GRADE' : '')}
        ${campo('preco', orig.preco)}${campo('tipo', 'V')}
        ${campo('unidade', orig.unidade ?? 'UN')}${campo('ncm', orig.ncm)}
        ${campo('marca', orig.marca)}${campo('categoria', orig.categoria)}
        ${campo('descricao', orig.descricao)}
        <variacoes>${varXml}</variacoes>
      </produto>`;
      const r = await post('produto.incluir.php', xml);
      const id = r?.registros?.[0]?.registro?.id ?? '?';
      return `Produto "${input.novo_nome ?? orig.nome}" criado com variações a partir do ID ${input.id_original}. Novo ID: ${id}.`;
    }

    case 'criar_produto_fabricado': {
      const compXml = (input.componentes ?? []).map((c: any) => `<componente>
        ${campo('id', c.id)}${campo('quantidade', c.quantidade)}
      </componente>`).join('');
      const xml = `<produto>
        ${campo('nome', input.nome)}${campo('codigo', input.codigo)}
        ${campo('preco', input.preco)}${campo('tipo', 'F')}
        ${campo('unidade', 'UN')}${campo('descricao', input.descricao)}
        ${campo('categoria', input.categoria)}
        <componentes>${compXml}</componentes>
      </produto>`;
      const r = await post('produto.incluir.php', xml);
      const id = r?.registros?.[0]?.registro?.id ?? '?';
      return `Produto Fabricado "${input.nome}" criado! ID: ${id}. Composto por ${input.componentes.length} insumo(s).`;
    }

    case 'adicionar_estrutura_producao': {
      const compXml = (input.componentes ?? []).map((c: any) => `<componente>
        ${campo('id', c.id)}${campo('quantidade', c.quantidade)}
      </componente>`).join('');
      const xml = `<produto>
        ${campo('id', input.id)}
        ${campo('tipo', input.tipo)}
        <componentes>${compXml}</componentes>
      </produto>`;
      await post('produto.alterar.php', xml);
      return `Estrutura de produção adicionada ao Produto/Variação ID ${input.id} com sucesso!`;
    }

    default:
      return `Ferramenta "${nome}" não reconhecida.`;
  }
}


async function startServer() {

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Endpoint de Sincronização Tiny -> Supabase
  app.post('/api/sync/produtos', async (req, res) => {
    const token = process.env.TINY_API_TOKEN;
    if (!token) return res.status(401).json({ error: 'Token Tiny não configurado' });

    try {
      // 1. Busca produtos no Tiny (exemplo: página 1)
      const response = await fetch(`https://api.tiny.com.br/api2/produtos.pesquisa.php?token=${token}&formato=json`);
      const data = await response.json();

      if (data?.retorno?.status === 'Erro') {
        return res.status(400).json({ error: data.retorno.erros[0].erro });
      }

      const produtos = data.retorno.produtos || [];
      const supabaseData = [];

      // 2. Transforma dados pro Supabase
      for (const item of produtos) {
        const p = item.produto;
        supabaseData.push({
          id: parseInt(p.id),
          nome: p.nome,
          sku: p.codigo || p.sku || '',
          preco_venda: parseFloat(p.preco) || 0,
          preco_custo: parseFloat(p.preco_custo) || 0,
          estoque_atual: parseFloat(p.saldo) || 0,
          tipo: p.tipo || 'P'
        });
      }

      // 3. Upsert no Supabase (Atualiza se existir ID, cria se não existir)
      if (supabaseData.length > 0) {
        const { error } = await supabase
          .from('produtos')
          .upsert(supabaseData, { onConflict: 'id' });

        if (error) throw error;
      }

      res.json({ status: 'success', synchronized: supabaseData.length });
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Tiny ERP API Proxy - Rotas movidas para baixo

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
        const errorMsg = data.retorno.erros && data.retorno.erros.length > 0 
          ? data.retorno.erros[0].erro 
          : 'Token do Tiny ERP inválido ou permissão negada.';
        return res.status(401).json({ 
          error: `Erro do Tiny: ${errorMsg}`,
          details: data.retorno.erros 
        });
      }

      if (data.retorno && data.retorno.produtos) {
        // Pagination logic
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        
        const totalItems = data.retorno.produtos.length;
        const totalPages = Math.ceil(totalItems / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        
        // Only process the slice for the current page
        const pagedProducts = data.retorno.produtos.slice(startIndex, endIndex);
        
        const productsWithStock = [];
        // Process sequentially to avoid hitting Tiny ERP rate limits too hard
        for (const item of pagedProducts) {
          const p = item.produto;
          try {
            let madeNetworkCall = false;
            
            // 1. Fetch or use cached Stock
            const now = Date.now();
            const cachedStock = stockCache.get(p.id);
            if (cachedStock && (now - cachedStock.timestamp < STOCK_CACHE_TTL)) {
              p.estoque = cachedStock.data.saldo;
              p.depositos = cachedStock.data.depositos || [];
            } else {
              const stockResponse = await fetch(`https://api.tiny.com.br/api2/produto.obter.estoque.php?token=${token}&id=${p.id}&formato=json`);
              const stockData = await stockResponse.json();
              if (stockData.retorno && stockData.retorno.status === 'OK') {
                const sData = stockData.retorno.produto;
                p.estoque = sData.saldo;
                p.depositos = sData.depositos || [];
                stockCache.set(p.id, { data: sData, timestamp: now });
                madeNetworkCall = true;
              }
            }

            // 2. Fetch or use cached Details (Images, Min Stock) - Cache forever while server runs
            if (detailCache.has(p.id)) {
              const dData = detailCache.get(p.id);
              p.estoque_minimo = dData.estoque_minimo;
              p.preco_custo = dData.preco_custo;
              p.url_imagem = dData.url_imagem;
            } else {
              const detailResponse = await fetch(`https://api.tiny.com.br/api2/produto.obter.php?token=${token}&id=${p.id}&formato=json`);
              const detailData = await detailResponse.json();
              if (detailData.retorno && detailData.retorno.status === 'OK') {
                const fullProd = detailData.retorno.produto;
                p.estoque_minimo = fullProd.estoque_minimo;
                p.preco_custo = fullProd.preco_custo;
                if (fullProd.anexos && fullProd.anexos.length > 0) {
                  p.url_imagem = fullProd.anexos[0].anexo;
                }
                detailCache.set(p.id, {
                  estoque_minimo: p.estoque_minimo,
                  preco_custo: p.preco_custo,
                  url_imagem: p.url_imagem
                });
                madeNetworkCall = true;
              }
            }

            // Small delay ONLY if we actually hit the Tiny API, to respect rate limits (approx 3 reqs per second max)
            if (madeNetworkCall) {
              await new Promise(resolve => setTimeout(resolve, 330));
            }
            
          } catch (e) {
            console.error(`Erro ao buscar detalhes do produto ${p.id}`, e);
          }
          productsWithStock.push(item);
        }
        data.retorno.produtos = productsWithStock;
      }
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Erro de conexão com os servidores do Tiny ERP' });
    }
  });

// Rota para Lançar Estoque de Produção no Tiny
app.post('/api/tiny/producao', express.json(), async (req, res) => {
  const { ordem_id, deposito, quantidade, sku } = req.body;
  const token = process.env.TINY_API_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'TINY_API_TOKEN não configurado' });
  }

  try {
    console.log(`[Produção] Lançando ${quantidade} unidades do SKU ${sku} no ${deposito}...`);
    
    // Na API do Tiny, precisamos do ID interno do produto. Vamos buscar o ID pelo SKU primeiro
    const searchRes = await fetch(`https://api.tiny.com.br/api2/produtos.pesquisa.php?token=${token}&pesquisa=${sku}&formato=json`);
    const searchData = await searchRes.json();
    
    if (searchData.retorno.status === 'Erro' || searchData.retorno.produtos.length === 0) {
       console.error("Produto não encontrado no Tiny para lançar estoque.");
       return res.status(404).json({ error: 'Produto não encontrado no Tiny.' });
    }

    const idProdutoTiny = searchData.retorno.produtos[0].produto.id;

    // Agora fazemos a requisição para ATUALIZAR ESTOQUE (Entrada)
    const formData = new URLSearchParams();
    formData.append('token', token);
    formData.append('formato', 'json');
    
    const safeObservacao = `Produção Concluída Meikê Hub - Ordem ${ordem_id}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const xml = `<estoque>
      <idProduto>${idProdutoTiny}</idProduto>
      <tipo>E</tipo>
      <quantidade>${quantidade}</quantidade>
      <observacao>${safeObservacao}</observacao>
    </estoque>`;
    
    formData.append('xml', xml);

    const updateRes = await fetch('https://api.tiny.com.br/api2/produto.atualizar.estoque.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    const updateData = await updateRes.json();
    console.log("Resposta Tiny Estoque:", updateData);

    if (updateData.retorno.status === 'OK') {
      return res.json({ success: true, message: 'Estoque atualizado no Tiny com sucesso!' });
    } else {
      return res.status(400).json({ error: 'Erro ao atualizar estoque no Tiny', detalhes: updateData.retorno.erros });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno ao comunicar com Tiny' });
  }
});

// Rota principal do agente — suporta streaming SSE
app.post('/api/agente', async (req, res) => {
  const { mensagens } = req.body as { mensagens: any[] };
  const geminiKey = process.env.GEMINI_API_KEY ?? '';
  const tinyToken = process.env.TINY_API_TOKEN ?? '';

  if (!geminiKey) {
    return res.status(400).json({ error: 'GEMINI_API_KEY não configurada no .env' });
  }

  // Configura SSE para streaming de eventos para o frontend
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const enviar = (tipo: string, dados: any) => {
    res.write(`data: ${JSON.stringify({ tipo, ...dados })}\n\n`);
  };

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const systemInstruction = `Você é um agente autônomo especialista no Tiny ERP, integrado ao Dashboard Meikê.
Você tem acesso a várias ferramentas e DEVE usá-las para completar o que o usuário pede.
Nunca peça para o usuário fazer o que você pode fazer usando as ferramentas.

REGRAS CRÍTICAS DE PRODUÇÃO/ESTRUTURA:
Se o usuário pedir para criar Variações que também são Produtos Fabricados (ex: Kit Pitaya com variações P, M, G, onde cada variação tem sua própria estrutura de insumos), você DEVE seguir este exato fluxo:
1. Crie as variações usando 'criar_produto_com_variacoes' ou 'duplicar_como_variacoes'.
2. O passo anterior retornará apenas o ID PAI. Você DEVE usar a ferramenta 'obter_produto' no ID Pai para descobrir os IDs individuais de CADA variação filha recém-criada (eles estarão dentro da lista de variações retornada).
3. Após obter os IDs filhos, você DEVE usar a ferramenta 'adicionar_estrutura_producao' para CADA ID de variação filha individualmente, definindo o tipo como 'F' e passando os IDs dos componentes e quantidades.
4. Responda ao usuário apenas depois de confirmar que adicionou a estrutura de produção em TODAS as variações.

Responda sempre em português brasileiro e seja direto.`;

    const convertTypes = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(convertTypes);
      const newObj: any = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'type' && typeof v === 'string') {
          newObj[k] = v.toUpperCase();
        } else {
          newObj[k] = convertTypes(v);
        }
      }
      return newObj;
    };

    const geminiTools = [{
      functionDeclarations: TINY_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties: convertTypes(t.input_schema.properties),
          required: t.input_schema.required
        }
      }))
    }];

    let historico = mensagens.map(m => {
      if (m.role === 'assistant') {
        return { role: 'model', parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }] };
      } else if (m.role === 'user' && m.content && typeof m.content === 'object' && m.content[0]?.type === 'tool_result') {
        // Conversão de tool_result do histórico
        return {
          role: 'user',
          parts: [{
            functionResponse: {
              name: m.content[0].tool_use_id, // we don't have the name here easily, but just standardizing
              response: { result: m.content[0].content }
            }
          }]
        };
      } else {
        return { role: 'user', parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }] };
      }
    });

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    let rodadas = 0;
    while (rodadas < 10) {
      rodadas++;
      
      if (rodadas > 1) {
        // Pausa de 2 segundos entre chamadas para evitar Rate Limit 429 do plano Free do Gemini
        await delay(2000);
      }

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: historico,
        config: {
          tools: geminiTools,
          systemInstruction,
          temperature: 0.2
        }
      });

      let textoAcumulado = '';
      let funcoesParaChamar: any[] = [];
      let finalResponseParts: any[] = [];

      for await (const chunk of responseStream) {
        if (chunk.text) {
          textoAcumulado += chunk.text;
          enviar('texto', { conteudo: chunk.text });
        }
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          funcoesParaChamar.push(...chunk.functionCalls);
        }
      }

      if (textoAcumulado) {
        finalResponseParts.push({ text: textoAcumulado });
      }

      if (funcoesParaChamar.length > 0) {
        for (const call of funcoesParaChamar) {
          finalResponseParts.push({ functionCall: call });
        }
        historico.push({ role: 'model', parts: finalResponseParts });

        const toolResponses = [];

        for (const fCall of funcoesParaChamar) {
          enviar('ferramenta_inicio', {
            nome: fCall.name,
            input: fCall.args,
            id: fCall.name + '-' + Math.random().toString(36).substring(7)
          });

          try {
            const resultado = await executarFerramenta(fCall.name, fCall.args, tinyToken);
            enviar('ferramenta_resultado', { id: fCall.name + '-' + Math.random().toString(36).substring(7), resultado, sucesso: true });
            
            toolResponses.push({
              functionResponse: {
                name: fCall.name,
                response: { result: resultado }
              }
            });
          } catch (err: any) {
            const erroMsg = err.message ?? 'Erro ao executar';
            enviar('ferramenta_resultado', { id: fCall.name + '-' + Math.random().toString(36).substring(7), resultado: erroMsg, sucesso: false });
            
            toolResponses.push({
              functionResponse: {
                name: fCall.name,
                response: { error: erroMsg }
              }
            });
          }
        }
        
        historico.push({ role: 'user', parts: toolResponses });
      } else {
        break; // Nenhuma ferramenta chamada, termina a rodada
      }
    }

    enviar('fim', { rodadas });
  } catch (err: any) {
    console.error('Erro na chamada Gemini:', err);
    enviar('erro', { mensagem: err.message ?? 'Erro interno no Gemini' });
  } finally {
    res.end();
  }
});

async function processarRemessaML(shipmentId: string, supabase: any) {
  const mlToken = process.env.ML_ACCESS_TOKEN;
  if (!mlToken) throw new Error('ML_ACCESS_TOKEN não configurado');

  // 1. Fetch ML Data
  const mlRes = await fetch(`https://api.mercadolibre.com/fbm/shipments/${shipmentId}`, {
    headers: { Authorization: `Bearer ${mlToken}` }
  });
  if (!mlRes.ok) {
     throw new Error(`Falha ao buscar remessa ML: ${mlRes.statusText}`);
  }
  const shipment = await mlRes.json();

  // 2. Query Supabase
  const itemIds = (shipment.items || []).map((i: any) => i.item_id);
  
  const { data: skusData, error: skuError } = await supabase
    .from('skus_marketplace')
    .select(`
      sku_mercadolivre,
      produtos (
        nome,
        sku,
        url_imagem
      )
    `)
    .in('sku_mercadolivre', itemIds);
    
  if (skuError) throw skuError;

  const skuMap = new Map();
  if (skusData) {
    skusData.forEach((s: any) => {
      skuMap.set(s.sku_mercadolivre, s.produtos);
    });
  }

  // 3. Gerar HTML
  const linhasTabela = (shipment.items || []).map((item: any) => {
    const info = skuMap.get(item.item_id) || { nome: 'Produto Desconhecido', sku: 'N/A', url_imagem: '' };
    return `
      <tr>
        <td style="text-align:center"><img src="${info.url_imagem}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;" /></td>
        <td><strong>${info.nome}</strong><br/><small style="color:#666">SKU: ${info.sku} | ML: ${item.item_id}</small></td>
        <td style="text-align:center; font-size:18px; font-weight:bold">${item.declared_quantity}</td>
        <td style="border: 2px solid #ccc; width:60px;"></td>
        <td style="border: 2px solid #ccc; width:60px;"></td>
        <td style="border: 2px solid #ccc; width:60px;"></td>
        <td style="border: 2px solid #ccc; width:60px;"></td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .header-col { width: 32%; }
        h1 { margin: 0; font-size: 24px; }
        .info-box { border: 1px solid #ccc; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
        .checklist { display: flex; gap: 20px; margin-bottom: 20px; }
        .check-item { display: flex; align-items: center; gap: 5px; font-weight: bold; }
        .box { width: 16px; height: 16px; border: 2px solid #333; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #f5f5f5; text-transform: uppercase; font-size: 12px; }
        .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; display: flex; justify-content: space-between; }
        .sign-line { border-bottom: 1px solid #000; width: 300px; display: inline-block; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-col">
          <h1>Controle de Envios - FULL</h1>
          <p><strong>Envio:</strong> ${shipment.id || shipmentId}</p>
          <p><strong>Data:</strong> ${shipment.date_created ? new Date(shipment.date_created).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <div class="header-col">
          <p><strong>Destino:</strong> ${shipment.destination?.name || 'Mercado Livre'}</p>
          <p><strong>Unidades Totais:</strong> ${shipment.declared_units || 0}</p>
        </div>
        <div class="header-col">
          <p><strong>Horário Coleta:</strong> ________________</p>
          <p><strong>Motorista:</strong> ____________________</p>
          <p><strong>Placa:</strong> ________________________</p>
        </div>
      </div>

      <div class="info-box checklist">
        <div class="check-item"><div class="box"></div> Etiqueta Volume</div>
        <div class="check-item"><div class="box"></div> Nota Fiscal</div>
        <div class="check-item"><div class="box"></div> Autorização</div>
        <div class="check-item"><div class="box"></div> Foto / Vídeo</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:60px">Img</th>
            <th>Produto</th>
            <th>A Enviar</th>
            <th>Feitos</th>
            <th>Falta</th>
            <th>Check</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody>
          ${linhasTabela}
        </tbody>
      </table>

      <div class="footer">
        <div>
          <p><strong>Assinatura Conferente:</strong></p>
          <span class="sign-line"></span>
        </div>
        <div>
          <p><strong>Assinatura Motorista:</strong></p>
          <span class="sign-line"></span>
          <p>RG/CPF: ___________________</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // 4. Gerar PDF
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  // 5. Upload pro Supabase
  const fileName = `controle_envio_${shipmentId}_${Date.now()}.pdf`;
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('pdfs')
    .upload(fileName, pdfBuffer, { contentType: 'application/pdf' });

  if (uploadError) {
    console.warn("Storage upload error (ignoring for testing, PDF was generated):", uploadError);
  }

  const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(fileName);
  const pdfUrl = urlData.publicUrl;

  // 6. Salvar dados na tabela
  const { data: remessaInfo, error: remessaError } = await supabase
    .from('remessas_full')
    .insert([{
       plataforma: 'Mercado Livre',
       numero_envio: shipment.id || shipmentId,
       unidade: shipment.destination?.name || 'Mercado Livre',
       pdf_url: pdfUrl, // Lembre-se de criar essa coluna no banco
       data_envio: shipment.date_created || new Date().toISOString()
    }])
    .select()
    .single();

  if (remessaError) {
    console.error("Erro salvando remessa:", remessaError);
    return;
  }

  const remessaId = remessaInfo.id;
  const itensInsert = (shipment.items || []).map((item: any, idx: number) => {
    const info = skuMap.get(item.item_id) || { nome: 'Produto Desconhecido', sku: 'N/A' };
    return {
      id_remessa: remessaId,
      grupo_nome: info.nome,
      sku_marketplace_snapshot: item.item_id,
      sku_tiny_snapshot: info.sku,
      qtd_enviar: item.declared_quantity,
      ordem: idx
    };
  });

  await supabase.from('remessa_itens').insert(itensInsert);
  
  console.log(`[Webhook ML] Remessa ${shipmentId} processada com sucesso. PDF gerado e salvo.`);
}

  const upload = multer({ storage: multer.memoryStorage() });

  app.post('/api/ml/parse-pdf', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    
    try {
      const data = await pdfParse(req.file.buffer);
      const text = data.text;
      
      const items = [];
      const mlCodeRegex = /Código ML:\s*([A-Z0-9]+)[\s\S]*?SKU:\s*([^\n]+)/g;
      let match;
      const mlCodes = [];
      
      while ((match = mlCodeRegex.exec(text)) !== null) {
        mlCodes.push({ mlCode: match[1], sku: match[2].trim() });
      }
      
      const qtyRegex = /\n(\d+)•/g;
      const quantities = [];
      while ((match = qtyRegex.exec(text)) !== null) {
        quantities.push(Number(match[1]));
      }

      let totalUnidades = '';
      const totalMatch = text.match(/Total de unidades:\s*(\d+)/i);
      if (totalMatch) {
        totalUnidades = totalMatch[1];
      }

      let volumeCaixas = '';
      // Conforme solicitado pelo usuário: se diz "Produtos do envio: 6", preencher o campo volume (caixas) com 6
      const volumeMatch = text.match(/Produtos do envio:\s*(\d+)/i);
      if (volumeMatch) {
        volumeCaixas = volumeMatch[1];
      }
      
      if (mlCodes.length > 0 && quantities.length === mlCodes.length) {
         for (let i = 0; i < mlCodes.length; i++) {
           items.push({
             item_id: mlCodes[i].sku,
             ml_code: mlCodes[i].mlCode,
             declared_quantity: quantities[i]
           });
         }
      } else {
         return res.status(400).json({ error: 'Não foi possível extrair os itens corretamente. O layout do PDF pode ser diferente.' });
      }
      
      res.json({ id: 'PDF', items, total_unidades: totalUnidades, volume_caixas: volumeCaixas });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Erro interno ao processar PDF' });
    }
  });

  app.post('/api/ml/integrate/:id', express.json(), async (req, res) => {
    const { id } = req.params;
    console.log(`[Integrate] Iniciando integração para remessa: ${id}`);
    
    try {
      // 1. Fase 6: Buscar a Remessa e Incrementar o sequencial (se necessário)
      console.log(`[Integrate] Buscando remessa no Supabase...`);
      const { data: remessa, error: remError } = await supabase
        .from('remessas_full')
        .select('*')
        .eq('id', id)
        .single();
  
      if (remError) {
        console.error(`[Integrate] Erro ao buscar remessa:`, remError);
        throw new Error('Remessa não encontrada: ' + remError.message);
      }
      console.log(`[Integrate] Remessa encontrada: ${remessa.numero_envio}`);

      let currentSeq = remessa.sequencial;

      if (!currentSeq) {
        console.log(`[Integrate] Gerando novo sequencial...`);
        const { data: newSeq, error: seqError } = await supabase.rpc('incrementar_sequencial_ml');
        if (seqError) {
          console.error(`[Integrate] Erro no RPC:`, seqError);
          throw new Error('Erro ao gerar sequencial: ' + seqError.message);
        }
        currentSeq = newSeq;
        
        // Persistir o sequencial na remessa para que não mude em futuras integrações
        await supabase.from('remessas_full').update({ sequencial: currentSeq }).eq('id', id);
        console.log(`[Integrate] Sequencial #${currentSeq} persistido na remessa.`);
      } else {
        console.log(`[Integrate] Usando sequencial existente: #${currentSeq}`);
      }
  
      // Número formatado: 3 dígitos para pasta Drive, 2 dígitos para Agenda
      const numFormatadoDrive = String(currentSeq).padStart(3, '0');  // 015
      const numFormatadoAgenda = String(currentSeq).padStart(2, '0'); // 15
      
      let dataFormatada = 'XX/XX';
      if (remessa.data_envio) {
        const [year, month, day] = remessa.data_envio.split('T')[0].split('-');
        dataFormatada = `${day}/${month}`;
      }
  
      // Prefixo por marketplace para a Agenda
      const plataformaLower = (remessa.plataforma || '').toLowerCase();
      let prefixoAgenda = 'FULL';
      if (plataformaLower.includes('mercado')) prefixoAgenda = 'FULL ML';
      else if (plataformaLower.includes('shopee')) prefixoAgenda = 'FULL SHOPEE';
      else if (plataformaLower.includes('amazon')) prefixoAgenda = 'FULL AMZ';
  
      // Nome da pasta no Drive: ML 015 | 30/04
      const nomeFinalDrive = `ML ${numFormatadoDrive} | ${dataFormatada}`;
      // Título do evento no Calendar: FULL ML | 15 | #66576077
      const nomeFinalAgenda = `${prefixoAgenda} | ${numFormatadoAgenda} | #${remessa.numero_envio}`;
      
      console.log(`[Integrate] Pasta Drive: "${nomeFinalDrive}" | Evento Agenda: "${nomeFinalAgenda}"`);
  
      // Variável para compatibilidade com o restante do código
      const nomeFinal = nomeFinalDrive;

  
      // 2. Buscar itens para gerar o PDF
      console.log(`[Integrate] Buscando itens da remessa...`);
      const { data: itens, error: itensError } = await supabase
        .from('remessa_itens')
        .select('*, produtos (nome, url_imagem)')
        .eq('id_remessa', id)
        .order('ordem');
  
      console.log(`[Integrate] Itens encontrados: ${itens?.length || 0}`);
  
      // 3. Gerar PDF com Puppeteer
      console.log(`[Integrate] Iniciando Puppeteer...`);
      const linhasTabela = (itens || []).map((item: any) => {
        const img = item.produtos?.url_imagem || '';
        return `
          <tr>
            <td style="text-align:center"><img src="${img}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;" /></td>
            <td><strong>${item.grupo_nome}</strong><br/><small style="color:#666">SKU: ${item.sku_tiny_snapshot}</small></td>
            <td style="text-align:center; font-size:18px; font-weight:bold">${item.qtd_enviar}</td>
            <td style="border: 2px solid #ccc; width:60px;"></td>
            <td style="border: 2px solid #ccc; width:60px;"></td>
            <td style="border: 2px solid #ccc; width:60px;"></td>
            <td style="border: 2px solid #ccc; width:60px;"></td>
          </tr>
        `;
      }).join('');
  
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header-col { width: 32%; }
            h1 { margin: 0; font-size: 24px; }
            .info-box { border: 1px solid #ccc; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
            .checklist { display: flex; gap: 20px; margin-bottom: 20px; }
            .check-item { display: flex; align-items: center; gap: 5px; font-weight: bold; }
            .box { width: 16px; height: 16px; border: 2px solid #333; border-radius: 3px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f5f5f5; text-transform: uppercase; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-col">
              <h1>Controle de Envios - FULL</h1>
              <h2>${nomeFinal}</h2>
              <p><strong>Envio:</strong> ${remessa.numero_envio}</p>
            </div>
            <div class="header-col">
              <p><strong>Volume Total:</strong> ${remessa.volume_total}</p>
            </div>
          </div>
          <div class="info-box checklist">
            <div class="check-item"><div class="box"></div> Etiqueta Volume</div>
            <div class="check-item"><div class="box"></div> Nota Fiscal</div>
            <div class="check-item"><div class="box"></div> Autorização</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:60px">Img</th>
                <th>Produto</th>
                <th>A Enviar</th>
                <th>Feitos</th>
                <th>Falta</th>
                <th>Check</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>${linhasTabela}</tbody>
          </table>
        </body>
        </html>
      `;
  
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      console.log(`[Integrate] PDF gerado com sucesso.`);
  
      // Lê a chave e converte \n literal em quebra de linha real (formato que o Google exige)
      const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
      console.log(`[Integrate][DIAG] rawKey tamanho: ${rawKey.length}`);
      console.log(`[Integrate][DIAG] rawKey primeiros 60 chars: ${JSON.stringify(rawKey.substring(0, 60))}`);
      
      const googlePrivateKey = rawKey.replace(/^"(.*)"$/s, '$1').replace(/\\n/g, '\n');
  
      const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      console.log(`[Integrate] Email: ${googleClientEmail}`);
      console.log(`[Integrate] Chave final tamanho: ${googlePrivateKey.length}, início: '${googlePrivateKey.substring(0,27)}'`);

      if (!googleClientEmail || googlePrivateKey.length < 100) {
        console.warn(`[Integrate] Credenciais do Google ausentes. Finalizando...`);
        // Se nao tiver config, finaliza por aqui, atualiza a remessa no supabase e sucesso
        await supabase.from('remessas_full').update({
           pdf_url: nomeFinal // Pode guardar o nome para controle visual na tela
        }).eq('id', id);

        return res.status(200).json({ 
          success: true, 
          message: 'PDF gerado e sequência criada no banco.', 
          warning: 'Para criar as pastas e agenda, configure GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY no .env.',
          nome_final: nomeFinal
        });
      }
  
      // Padrão moderno recomendado para googleapis v8+ / google-auth-library v9+
      const googleAuth = new google.auth.GoogleAuth({
        credentials: {
          type: 'service_account',
          client_email: googleClientEmail,
          private_key: googlePrivateKey,
        },
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/calendar'
        ],
      });

      console.log(`[Integrate] Solicitando client autenticado...`);
      const authClient = await googleAuth.getClient();
      console.log(`[Integrate] Client autenticado com sucesso.`);
  
      const drive = google.drive({ version: 'v3', auth: authClient as any });
      const calendar = google.calendar({ version: 'v3', auth: authClient as any });
      console.log(`[Integrate] Autenticado e Autorizado no Google.`);
  
      // 4.1 Criar Pasta no Drive — dentro da subpasta do marketplace correto
      console.log(`[Integrate] Criando pasta no Drive para plataforma: ${remessa.plataforma}...`);
      
      // Seleciona a pasta pai de acordo com o marketplace
      const plataforma = (remessa.plataforma || '').toLowerCase();
      let parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '139GB7UEhDLLcHkeMdfrCwKCTBenNONIB';
      if (plataforma.includes('mercado')) {
        parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ML || '1FWwMzY7IiNeZ7RAskq2oxuyqXJXReXG-';
      } else if (plataforma.includes('shopee')) {
        parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_SHOPEE || '1xmEPEkUFicUwJBRJJdVtf0lwPox4zeNJ';
      } else if (plataforma.includes('amazon')) {
        parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_AMAZON || '1llJc_y5tfXTrYQ26PaXfSLByL0hxAEMF';
      }
      console.log(`[Integrate] Pasta pai selecionada: ${parentFolderId}`);
      
      const folderMetadata = {
        name: nomeFinal,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };
      const folderRes = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id, webViewLink'
      });
      const newFolderId = folderRes.data.id;
      const folderLink = folderRes.data.webViewLink;
      console.log(`[Integrate] Pasta criada: ${newFolderId}`);
  
      // NOTA: Upload direto de arquivo via Conta de Serviço requer Shared Drive (Google Workspace).
      // O PDF de controle já fica salvo no Supabase Storage.
      // A pasta no Drive serve como organizador visual para a equipe.
      console.log(`[Integrate] Pasta organizada no Drive: ${folderLink}`);
  

  
      // 4.3 Criar Evento no Calendar
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

      // Cor por marketplace
      let colorId = '8'; // Grafite (padrão/Amazon)
      if (plataformaLower.includes('mercado')) colorId = '5'; // Banana (amarelo)
      else if (plataformaLower.includes('shopee')) colorId = '6'; // Tangerina (laranja)

      // Data/hora do evento (09:00 às 10:00, horário de Brasília)
      const eventDateBase = remessa.data_envio 
        ? remessa.data_envio.split('T')[0]
        : new Date().toISOString().split('T')[0];
      const eventStart = `${eventDateBase}T09:00:00-03:00`;
      const eventEnd   = `${eventDateBase}T10:00:00-03:00`;

      // Links das pastas do Drive para a descrição
      const urlML      = `https://drive.google.com/drive/folders/${process.env.GOOGLE_DRIVE_FOLDER_ML || '1FWwMzY7IiNeZ7RAskq2oxuyqXJXReXG-'}`;
      const urlShopee  = `https://drive.google.com/drive/folders/${process.env.GOOGLE_DRIVE_FOLDER_SHOPEE || '1xmEPEkUFicUwJBRJJdVtf0lwPox4zeNJ'}`;
      const urlAmazon  = `https://drive.google.com/drive/folders/${process.env.GOOGLE_DRIVE_FOLDER_AMAZON || '1llJc_y5tfXTrYQ26PaXfSLByL0hxAEMF'}`;

      // Monta bloco de itens do envio para a descrição
      const itensHtml = (itens || []).map((item: any) => {
        const nome = item.produtos?.nome || item.grupo_nome || item.sku_tiny_snapshot || 'Produto';
        return `• ${nome} (Qntd: ${item.qtd_enviar})`;
      }).join('<br>');

      // Descrição em HTML conforme template do usuário
      const descricaoHtml = `
        <p>🚀 <strong>ENVIO Nº</strong></p>
        <p>#${remessa.numero_envio || 'N/A'}</p>
        <br>
        <p>============</p>
        <br>
        <p>📋 <strong>DADOS DO ENVIO</strong></p>
        <p><strong>📦 Volume Total:</strong> ${remessa.volume_total || '0'}</p>
        <p><strong>📦 Volume Caixas:</strong> ${remessa.volume_caixas || '0'}</p>
        <p><strong>🚛 Motorista:</strong> ${remessa.motorista || 'Pendente'}</p>
        <p><strong>🏷️ Placa:</strong> ${remessa.placa || 'Pendente'}</p>
        <br>
        <p>============</p>
        <br>
        <p>📝 <strong>ITENS DO ENVIO</strong></p>
        ${itensHtml}
        <br>
        <p>============</p>
        <br>
        <p>📂 <strong>PASTA DRIVE FULL</strong></p>
        <p><a href="${urlAmazon}">AMAZON</a></p>
        <p><a href="${urlShopee}">SHOPEE</a></p>
        <p><a href="${urlML}">MERCADO LIVRE</a></p>
      `.trim();

      console.log(`[Integrate] Criando evento: "${nomeFinalAgenda}" | data="${eventDateBase}" | colorId=${colorId}`);
      
      let eventLink: string | null = null;
      try {
        const eventRes = await calendar.events.insert({
          calendarId: calendarId,
          requestBody: {
            summary: nomeFinalAgenda,
            description: descricaoHtml,
            start: { dateTime: eventStart, timeZone: 'America/Sao_Paulo' },
            end:   { dateTime: eventEnd,   timeZone: 'America/Sao_Paulo' },
            colorId: colorId,
          }
        });
        eventLink = eventRes.data.htmlLink || null;
        console.log(`[Integrate] ✅ Evento criado com sucesso: ${eventLink}`);
      } catch (calErr: any) {
        console.error(`[Integrate] ❌ Falha ao criar evento no Calendar:`, calErr.message);
        console.error(`[Integrate] Verifique a permissão da conta de serviço no calendário ${calendarId}`);
      }


  
      // Atualiza a remessa no Supabase com o link da pasta
      await supabase.from('remessas_full').update({
        pdf_url: folderLink
      }).eq('id', id);
      console.log(`[Integrate] Remessa atualizada no Supabase com sucesso.`);

      res.json({ 
        success: true, 
        message: `✅ Integração completa!\n📁 Pasta: ${nomeFinal}\n📅 Evento criado na Agenda Google`, 
        nome_final: nomeFinal,
        folder_link: folderLink,
        event_link: eventLink
      });
  
    } catch (error: any) {
      console.error('Erro na integração:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/webhooks/mercadolivre', express.json(), async (req, res) => {
    try {
      const { resource, topic } = req.body;
      // Sempre retornar 200 OK pro ML parar de reenviar
      res.status(200).send('OK');

      if (topic !== 'inbound-shipments' && topic !== 'fbm-shipments') return;
      
      // O recurso costuma ser algo como /shipments/FBM12345
      const shipmentId = resource ? resource.split('/').pop() : req.body.shipment_id;
      if (!shipmentId) return;
      
      // Processamento em background
      processarRemessaML(shipmentId, supabase).catch(console.error);
      
    } catch(e) {
      console.error('Webhook Error:', e);
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
