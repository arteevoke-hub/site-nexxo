-- Atualizado em: 30/04/2026
-- Objetivo: Suporte a múltiplos marketplaces (Amazon) e sistema de Arquivamento Automático

-- Tabela principal da Remessa (Cabeçalho)
CREATE TABLE IF NOT EXISTS remessas_full (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma TEXT NOT NULL, -- 'Mercado Livre', 'Shopee' ou 'Amazon'
  status TEXT DEFAULT 'pendente', -- 'pendente', 'concluido', 'cancelado' (Lógica de Arquivamento)
  numero_envio TEXT,
  unidade TEXT,
  codigo_coleta TEXT,
  volume_total TEXT,
  motorista TEXT,
  placa TEXT,
  
  -- Checklists de Operação
  check_etiqueta_volume BOOLEAN DEFAULT false,
  check_nota_fiscal BOOLEAN DEFAULT false,
  check_autorizacao BOOLEAN DEFAULT false,
  check_foto_video BOOLEAN DEFAULT false,
  
  data_envio DATE,
  horario_coleta TEXT,
  pdf_url TEXT, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Itens da Remessa (Produtos Acabados extraídos do PDF)
CREATE TABLE IF NOT EXISTS remessa_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_remessa UUID REFERENCES remessas_full(id) ON DELETE CASCADE,
  id_produto_tiny BIGINT REFERENCES produtos(id), -- Vínculo para puxar estoque real via API
  
  -- Identificação do Kit (Ex: 'KIT FATALE' ou 'KIT 20 ITENS')
  grupo_nome TEXT NOT NULL, 
  
  -- Snapshots de SKU para histórico e conferência
  sku_tiny_snapshot TEXT,
  sku_marketplace_snapshot TEXT,
  
  -- Controles de Fluxo de Produção
  qtd_enviar INTEGER DEFAULT 0, -- Quantidade vinda do documento (ML, Shopee ou Amazon)[cite: 1]
  qtd_feitos INTEGER DEFAULT 0,
  qtd_falta INTEGER DEFAULT 0,
  check_pronto BOOLEAN DEFAULT false,
  volume TEXT,
  
  ordem INTEGER DEFAULT 0, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas de RLS (Mantendo o padrão que você já usa)[cite: 1]
ALTER TABLE remessas_full ENABLE ROW LEVEL SECURITY;
ALTER TABLE remessa_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura anonima remessas" ON remessas_full FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima remessas" ON remessas_full FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura anonima itens" ON remessa_itens FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima itens" ON remessa_itens FOR ALL USING (true) WITH CHECK (true);