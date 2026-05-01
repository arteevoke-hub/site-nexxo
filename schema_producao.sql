-- Tabela de Funcionários (Mão de Obra)
CREATE TABLE IF NOT EXISTS funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cargo TEXT DEFAULT 'Auxiliar de Produção',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expandir a tabela ordem_producao existente
ALTER TABLE ordem_producao ADD COLUMN IF NOT EXISTS id_funcionario UUID REFERENCES funcionarios(id);
ALTER TABLE ordem_producao ADD COLUMN IF NOT EXISTS tempo_gasto_segundos INTEGER DEFAULT 0;
ALTER TABLE ordem_producao ADD COLUMN IF NOT EXISTS sincronizado_tiny BOOLEAN DEFAULT false;

-- Adicionar Preços e Estrutura no Produto
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS valor_mao_de_obra NUMERIC DEFAULT 0;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estrutura JSONB DEFAULT '[]'::jsonb;

-- Permitir acesso anônimo para o MVP
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura anonima funcionarios" ON funcionarios FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima funcionarios" ON funcionarios FOR ALL USING (true) WITH CHECK (true);

-- Tabela de Ponto Digital do Freelancer
CREATE TABLE IF NOT EXISTS ponto_funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_funcionario UUID REFERENCES funcionarios(id),
  data_trabalho DATE DEFAULT CURRENT_DATE,
  entrada TIMESTAMP WITH TIME ZONE,
  saida TIMESTAMP WITH TIME ZONE,
  minutos_trabalhados INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE ponto_funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura anonima ponto" ON ponto_funcionarios FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima ponto" ON ponto_funcionarios FOR ALL USING (true) WITH CHECK (true);
