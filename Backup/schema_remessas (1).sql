-- Executar este script no SQL Editor do Supabase

-- Tabela principal da Remessa (O Cabeçalho do PDF)
CREATE TABLE IF NOT EXISTS remessas_full (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma TEXT NOT NULL, -- 'Mercado Livre' ou 'Shopee'
  numero_envio TEXT,
  unidade TEXT,
  codigo_coleta TEXT,
  volume_total TEXT,
  motorista TEXT,
  placa TEXT,
  
  -- Checklists de Impressão
  check_etiqueta_volume BOOLEAN DEFAULT false,
  check_nota_fiscal BOOLEAN DEFAULT false,
  check_autorizacao BOOLEAN DEFAULT false,
  check_foto_video BOOLEAN DEFAULT false,
  
  data_envio DATE,
  horario_coleta TEXT,
  pdf_url TEXT, -- Link gerado pela automação do webhook
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Itens da Remessa (As linhas dentro dos grupos do PDF)
CREATE TABLE IF NOT EXISTS remessa_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_remessa UUID REFERENCES remessas_full(id) ON DELETE CASCADE,
  id_produto_tiny BIGINT REFERENCES produtos(id), -- Referência ao produto master
  
  -- Para agrupar igual ao PDF (Ex: 'KIT 20 ITENS')
  grupo_nome TEXT NOT NULL, 
  
  -- Valores do momento da criação (caso o Dicionário mude no futuro, o histórico fica preservado)
  sku_tiny_snapshot TEXT,
  sku_marketplace_snapshot TEXT,
  
  -- Controles de quantidade
  qtd_enviar INTEGER DEFAULT 0,
  qtd_feitos INTEGER DEFAULT 0,
  qtd_falta INTEGER DEFAULT 0,
  check_pronto BOOLEAN DEFAULT false,
  volume TEXT,
  
  ordem INTEGER DEFAULT 0, -- Para ordenar as linhas na tela
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuração de RLS para permitir acesso anônimo inicial (MVP)
ALTER TABLE remessas_full ENABLE ROW LEVEL SECURITY;
ALTER TABLE remessa_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura anonima remessas" ON remessas_full FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima remessas" ON remessas_full FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura anonima itens" ON remessa_itens FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima itens" ON remessa_itens FOR ALL USING (true) WITH CHECK (true);
