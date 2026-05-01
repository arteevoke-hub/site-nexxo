-- Executar este script no SQL Editor do Supabase

-- Tabela de Produtos Sincronizados do Tiny
CREATE TABLE IF NOT EXISTS produtos (
  id BIGINT PRIMARY KEY, -- ID do Tiny
  nome TEXT NOT NULL,
  sku TEXT,
  preco_venda NUMERIC,
  preco_custo NUMERIC,
  estoque_atual INTEGER DEFAULT 0,
  url_imagem TEXT,
  tipo TEXT, -- K (Kit), F (Fabricado), V (Variacao), P (Produto)
  id_pai BIGINT, -- Se for variação, guarda o ID do produto pai
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Dicionário de SKUs (De-Para) Mercado Livre / Shopee
CREATE TABLE IF NOT EXISTS skus_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produto_tiny BIGINT REFERENCES produtos(id) ON DELETE CASCADE,
  sku_tiny TEXT NOT NULL,
  sku_mercadolivre TEXT,
  sku_shopee TEXT,
  anuncio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id_produto_tiny)
);

-- Tabela de Ordem de Produção de Kits
CREATE TABLE IF NOT EXISTS ordem_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produto_fabricado BIGINT REFERENCES produtos(id), -- O Kit que será montado
  quantidade_planejada INTEGER NOT NULL,
  quantidade_produzida INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PENDENTE', -- PENDENTE, EM_PRODUCAO, CONCLUIDA
  funcionario TEXT, -- Nome de quem produziu
  custo_total NUMERIC,
  data_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_fim TIMESTAMP WITH TIME ZONE
);

-- Configurar RLS (Row Level Security) para permitir acesso anônimo inicial (Para facilitar o MVP)
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordem_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura anonima produtos" ON produtos FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima produtos" ON produtos FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura anonima skus" ON skus_marketplace FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima skus" ON skus_marketplace FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura anonima ordens" ON ordem_producao FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima ordens" ON ordem_producao FOR ALL USING (true) WITH CHECK (true);
