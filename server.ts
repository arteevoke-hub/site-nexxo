console.log('>>> SERVIDOR TENTANDO INICIAR AGORA <<<');
console.log('Data:', new Date().toISOString());
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { createRequire } from 'module'; // <--- Deixe apenas UMA vez!

import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse/lib/pdf-parse.js');
const { google } = require('googleapis');

// Carregamento seguro do Puppeteer para evitar crash em ambientes sem libs de sistema (Hostinger)
let puppeteer: any = null;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.error('AVISO: Puppeteer não pôde ser carregado. Geração de PDF desativada.', e.message);
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// Inicialização segura do Supabase para evitar crash se as chaves faltarem no hPanel
let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error('Erro ao inicializar Supabase:', e.message);
  }
} else {
  console.warn('AVISO: Variáveis do Supabase faltando no ambiente!');
}

const upload = multer({ storage: multer.memoryStorage() });

const TINY_TOKENS = {
  MEIKE: process.env.TINY_API_TOKEN_MEIKE || process.env.TINY_API_TOKEN || '',
  ONN: process.env.TINY_API_TOKEN_ONN || ''
};

const getToken = (req: express.Request): string => {
  const store = (req.headers['x-nexxo-store'] as string) || 'MEIKE';
  return TINY_TOKENS[store as keyof typeof TINY_TOKENS] || '';
};

// Google Auth Configuration
const getGoogleAuth = () => {
  const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  const googlePrivateKey = rawKey.replace(/^"(.*)"$/s, '$1').replace(/\\n/g, '\n');

  if (!googleClientEmail || googlePrivateKey.length < 100) {
    return null;
  }

  return new google.auth.GoogleAuth({
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
};

// In-memory Cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta 'dist' (Vite build)
app.use(express.static(path.join(__dirname, 'dist')));

// Rota para a API status (opcional)
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', message: 'Nexxo API Ativa' });
});

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' }
});

app.use('/api/', apiLimiter);

// --- ROTAS TINY ---

app.get('/api/tiny/estoque', async (req, res) => {
  const token = getToken(req);
  const { pesquisa } = req.query;
  if (!token) return res.status(401).json({ error: 'Token não configurado' });

  try {
    const url = `https://api.tiny.com.br/api2/produtos.pesquisa.php?token=${token}&pesquisa=${pesquisa || ''}&formato=json`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tiny/produto/:id', async (req, res) => {
  const token = getToken(req);
  const { id } = req.params;
  if (!token) return res.status(401).json({ error: 'Token não configurado' });

  const cacheKey = `prod_${token}_${id}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) return res.json(cached.data);
  }

  try {
    const response = await fetch(`https://api.tiny.com.br/api2/produto.obter.php?token=${token}&id=${id}&formato=json`);
    const data = await response.json();
    const product = data.retorno?.produto || {};
    cache.set(cacheKey, { data: product, timestamp: Date.now() });
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tiny/estoque/:id', async (req, res) => {
  const token = getToken(req);
  const { id } = req.params;
  if (!token) return res.status(401).json({ error: 'Token não configurado' });

  try {
    const response = await fetch(`https://api.tiny.com.br/api2/produto.obter.estoque.php?token=${token}&id=${id}&formato=json`);
    const data = await response.json();
    res.json(data.retorno?.produto || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- ROTA PDF MERCADO LIVRE ---

app.post('/api/ml/parse-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  try {
    const data = await pdf(req.file.buffer);
    const text = data.text;

    // Regex para encontrar linhas do tipo: "Unidades SKU: [CODIGO] [NOME]" ou similar
    // Mercado Livre costuma listar o SKU e a quantidade
    // Como não temos o PDF exato, vamos buscar por padrões de SKU e nomes com *

    const lines = text.split('\n');
    const itemsFound: any[] = [];

    // Lógica de Extração (Heurística para ML Full)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Tenta encontrar a quantidade seguida do SKU ou Título
      // Padrão comum: "10 SKU-12345 Produto..."
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const qtd = parseInt(match[1]);
        const resto = match[2].trim();

        // Busca o produto no banco pelo SKU ou Nome (que deve começar com *)
        const { data: prods } = await supabase
          .from('produtos')
          .select('*, skus_marketplace(*)')
          .or(`sku.eq.${resto},nome.ilike.*${resto}%`);

        if (prods && prods.length > 0) {
          const prod = prods.find(p => p.nome.startsWith('*')) || prods[0];
          itemsFound.push({
            id_produto_tiny: prod.id,
            qtd_enviar: qtd,
            produto: prod
          });
        }
      }
    }

    res.json({
      success: true,
      items: itemsFound,
      rawText: text.slice(0, 500) // Para debug
    });
  } catch (error: any) {
    console.error('Erro PDF:', error);
    res.status(500).json({ error: 'Erro ao processar PDF: ' + error.message });
  }
});

// --- ROTA INTEGRAÇÃO (SALVAR NO TINY) ---

// --- ROTA INTEGRAÇÃO (SALVAR NO TINY + GOOGLE DRIVE/CALENDAR) ---

app.post('/api/ml/integrate/:id', async (req, res) => {
  const { id } = req.params;
  const token = getToken(req);
  console.log(`[Integrate] Iniciando integração para remessa: ${id}`);

  try {
    // 1. Buscar a Remessa e Itens
    const { data: remessa, error: errRem } = await supabase.from('remessas_full').select('*').eq('id', id).single();
    if (errRem || !remessa) throw new Error('Remessa não encontrada');

    const { data: itens, error: errItens } = await supabase.from('remessa_itens').select('*, produtos(*)').eq('id_remessa', id).order('ordem');
    if (errItens) throw errItens;

    // 2. Gerar Sequencial se não existir
    let currentSeq = remessa.sequencial;
    if (!currentSeq) {
      console.log(`[Integrate] Gerando novo sequencial...`);
      const { data: newSeq, error: seqError } = await supabase.rpc('incrementar_sequencial_ml');
      if (!seqError) {
        currentSeq = newSeq;
        await supabase.from('remessas_full').update({ sequencial: currentSeq }).eq('id', id);
      }
    }

    const numFormatadoDrive = String(currentSeq || 0).padStart(3, '0');
    const numFormatadoAgenda = String(currentSeq || 0).padStart(2, '0');

    let dataFormatada = 'XX/XX';
    if (remessa.data_envio) {
      const parts = remessa.data_envio.split('-');
      if (parts.length === 3) dataFormatada = `${parts[2]}/${parts[1]}`;
    }

    const plataformaLower = (remessa.plataforma || '').toLowerCase();
    let prefixoAgenda = 'FULL';
    if (plataformaLower.includes('mercado')) prefixoAgenda = 'FULL ML';
    else if (plataformaLower.includes('shopee')) prefixoAgenda = 'FULL SHOPEE';
    else if (plataformaLower.includes('amazon')) prefixoAgenda = 'FULL AMZ';

    const nomeFinal = `${plataformaLower.includes('mercado') ? 'ML' : plataformaLower.includes('shopee') ? 'SHP' : 'AMZ'} ${numFormatadoDrive} | ${dataFormatada}`;
    const tituloAgenda = `${prefixoAgenda} | ${numFormatadoAgenda} | #${remessa.numero_envio || 'S/N'}`;

    // 3. Gerar PDF com Puppeteer
    console.log(`[Integrate] Gerando PDF com Puppeteer...`);
    if (!puppeteer) {
      throw new Error('Serviço de PDF indisponível neste servidor (Requer VPS).');
    }
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

    // 4. Integração Google
    const googleAuth = getGoogleAuth();
    let folderLink = null;
    let eventLink = null;

    if (googleAuth) {
      console.log(`[Integrate] Conectando ao Google...`);
      const authClient = await googleAuth.getClient();
      const drive = google.drive({ version: 'v3', auth: authClient });
      const calendar = google.calendar({ version: 'v3', auth: authClient });

      // 4.1 Criar Pasta
      let parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (plataformaLower.includes('mercado')) parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ML;
      else if (plataformaLower.includes('shopee')) parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_SHOPEE;
      else if (plataformaLower.includes('amazon')) parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_AMAZON;

      const folderRes = await drive.files.create({
        requestBody: {
          name: nomeFinal,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentFolderId ? [parentFolderId] : []
        },
        fields: 'id, webViewLink'
      });
      folderLink = folderRes.data.webViewLink;

      // 4.2 Criar Evento
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      const eventDateBase = remessa.data_envio || new Date().toISOString().split('T')[0];

      let colorId = '8';
      if (plataformaLower.includes('mercado')) colorId = '5';
      else if (plataformaLower.includes('shopee')) colorId = '6';

      const itensHtml = (itens || []).map((item: any) => `• ${item.grupo_nome} (Qntd: ${item.qtd_enviar})`).join('<br>');
      const descricaoHtml = `
        <p>🚀 <strong>ENVIO Nº</strong> #${remessa.numero_envio || 'N/A'}</p>
        <p>📦 <strong>Volume:</strong> ${remessa.volume_total || '0'} | ${remessa.volume_caixas || '0'} cx</p>
        <p>🚛 <strong>Motorista:</strong> ${remessa.motorista || 'Pendente'}</p>
        <br><p>📝 <strong>ITENS</strong></p>${itensHtml}
        <br><p>📂 <a href="${folderLink}">PASTA DRIVE</a></p>
      `.trim();

      const eventRes = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: tituloAgenda,
          description: descricaoHtml,
          start: { dateTime: `${eventDateBase}T09:00:00-03:00`, timeZone: 'America/Sao_Paulo' },
          end: { dateTime: `${eventDateBase}T10:00:00-03:00`, timeZone: 'America/Sao_Paulo' },
          colorId,
        }
      });
      eventLink = eventRes.data.htmlLink;
    }

    // 5. Atualizar Status no Supabase
    await supabase.from('remessas_full').update({
      status: 'Integrado',
      data_integracao: new Date().toISOString(),
      pdf_url: folderLink || remessa.pdf_url
    }).eq('id', id);

    res.json({
      status: 'success',
      message: `Integração completa para ${remessa.numero_envio || id}!`,
      folder_link: folderLink,
      event_link: eventLink
    });
  } catch (error: any) {
    console.error('Erro Integração:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- ROTA GOOGLE UPLOAD ---
app.post('/api/google/upload-file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const { id_remessa } = req.body;

  try {
    const googleAuth = getGoogleAuth();
    if (!googleAuth) throw new Error('Google Auth não configurado');

    const authClient = await googleAuth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Busca o link da pasta na remessa
    const { data: remessa } = await supabase.from('remessas_full').select('pdf_url').eq('id', id_remessa).single();
    let folderId = null;

    if (remessa?.pdf_url && remessa.pdf_url.includes('folders/')) {
      folderId = remessa.pdf_url.split('folders/')[1].split('?')[0];
    }

    const fileMetadata = {
      name: req.file.originalname,
      parents: folderId ? [folderId] : []
    };
    const media = {
      mimeType: req.file.mimetype,
      body: Readable.from(req.file.buffer)
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    res.json({ success: true, link: file.data.webViewLink });
  } catch (error: any) {
    console.error('Erro Upload Google:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- ROTA SINCRONIZAÇÃO ---

app.post('/api/sync/produtos', async (req, res) => {
  const token = getToken(req);
  const store = (req.headers['x-nexxo-store'] as string) || 'MEIKE';
  if (!token) return res.status(401).json({ error: 'Token não configurado' });

  try {
    let pagina = 1;
    let total = 0;
    let temMais = true;

    while (temMais && pagina <= 10) {
      const response = await fetch(`https://api.tiny.com.br/api2/produtos.pesquisa.php?token=${token}&formato=json&pagina=${pagina}`);
      const data = await response.json();
      const produtos = data.retorno?.produtos || [];

      if (produtos.length === 0) { temMais = false; break; }

      const supabaseData = produtos.map((item: any) => ({
        id: parseInt(item.produto.id),
        nome: item.produto.nome,
        sku: item.produto.codigo || '',
        unidade: store
      }));

      await supabase.from('produtos').upsert(supabaseData, { onConflict: 'id' });
      total += produtos.length;
      pagina++;
      await new Promise(r => setTimeout(r, 300));
    }
    res.json({ status: 'success', synchronized: total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para qualquer outra coisa - Serve o index.html do React (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log(`SERVIDOR NEXXO INICIADO COM SUCESSO`);
  console.log(`Porta: ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'produção'}`);
  console.log('====================================');
});
