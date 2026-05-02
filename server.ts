import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { createRequire } from 'module';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const _require = typeof require !== 'undefined' ? require : createRequire(import.meta.url);

dotenv.config();

console.log('>>> SERVIDOR NEXXO: INICIALIZANDO MÓDULO DE SEGURANÇA V6 - DIAGNÓSTICO ATIVADO <<<');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(_dirname, 'dist')));

const getGoogleApis = () => _require('googleapis');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- DIAGNÓSTICO DE AMBIENTE ---
app.get('/api/debug-env', (req, res) => {
  const key = process.env.GOOGLE_PRIVATE_KEY || '';
  const email = process.env.GOOGLE_CLIENT_EMAIL || '';
  
  res.json({
    email_presente: email.length > 5,
    email_preview: email.substring(0, 10) + '...',
    chave_presente: key.length > 50,
    chave_tamanho: key.length,
    chave_inicio: key.substring(0, 30) + '...',
    chave_fim: key.substring(key.length - 20),
    ambiente: process.env.NODE_ENV || 'não definido',
    timestamp: new Date().toISOString()
  });
});

const getGoogleAuth = () => {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY || '';

  if (!email || key.length < 50) return null;

  // Limpeza profunda
  let clean = key.trim().replace(/^"(.*)"$/s, '$1').replace(/\\n/g, '\n');
  const base64 = clean.replace(/-----BEGIN PRIVATE KEY-----/g, '')
                     .replace(/-----END PRIVATE KEY-----/g, '')
                     .replace(/[^A-Za-z0-9+/=]/g, '');

  const chunks = base64.match(/.{1,64}/g);
  if (!chunks) return null;

  const pem = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;

  try {
    const { google } = getGoogleApis();
    return new google.auth.GoogleAuth({
      credentials: { type: 'service_account', client_email: email, private_key: pem },
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/calendar'],
    });
  } catch (err) { return null; }
};

app.post('/api/ml/integrate/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: remessa } = await supabase.from('remessas_full').select('*').eq('id', id).single();
    const auth = getGoogleAuth();
    if (!auth) throw new Error('Falha crítica: Autenticação Google não pôde ser inicializada. Verifique as chaves no Painel Hostinger.');

    const { google } = getGoogleApis();
    const drive = google.drive({ version: 'v3', auth });
    const calendar = google.calendar({ version: 'v3', auth });

    const folder = await drive.files.create({
      requestBody: { 
        name: `REMESSA ${remessa.sequencial || 'S/N'} | ${remessa.data_envio}`, 
        mimeType: 'application/vnd.google-apps.folder', 
        parents: [process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '139GB7UEhDLLcHkeMdfrCwKCTBenNONIB'] 
      },
      fields: 'id, webViewLink'
    });

    const event = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      requestBody: {
        summary: `FULL | ${remessa.sequencial || 'S/N'} | #${remessa.numero_envio}`,
        start: { dateTime: `${remessa.data_envio}T20:00:00-03:00` },
        end: { dateTime: `${remessa.data_envio}T21:00:00-03:00` }
      }
    });

    await supabase.from('remessas_full').update({ 
      status: 'integrado', 
      folder_link: folder.data.webViewLink, 
      calendar_link: event.data.htmlLink 
    }).eq('id', id);

    res.json({ message: 'OK' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(_dirname, 'dist', 'index.html')));
app.listen(PORT, () => console.log(`Servidor V6 Rodando na porta ${PORT}`));
