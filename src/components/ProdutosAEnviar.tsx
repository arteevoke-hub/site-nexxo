import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ProductCardEnvio } from './ProductCardEnvio';
import { RefreshCw, Package } from 'lucide-react';

interface ProdutoEnvio {
  id_produto_tiny: number | null;
  nome_produto: string;
  qtd_ml: number;
  qtd_shopee: number;
  qtd_amazon: number;
  total_geral: number;
  status: string;
  url_imagem?: string;
  sku?: string;
  estoque_meike?: number;
  unidade?: string;
}

// Busca o estoque do Depósito Local (Meikê ou Onn) via nossa API de backend
async function fetchEstoqueLocal(idTiny: number, store: string): Promise<number> {
  try {
    const res = await fetch(`/api/tiny/estoque/${idTiny}`, {
      headers: {
        'x-nexxo-store': store
      }
    });
    if (!res.ok) return 0;
    const data = await res.json();
    
    const depositos: { nome: string; saldo: number }[] = data.depositos || [];
    
    // Busca o depósito que contém o nome da loja (Meike ou Onn)
    const searchName = store === 'MEIKE' ? 'meik' : 'onn';
    const local = depositos.find(
      (d) => d.nome?.toLowerCase().includes(searchName)
    );
    return local?.saldo ?? 0;
  } catch {
    return 0;
  }
}

export function ProdutosAEnviar() {
  const [produtos, setProdutos] = useState<ProdutoEnvio[]>([]);
  const [semEstoque, setSemEstoque] = useState<ProdutoEnvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
      console.log('DEBUG: Unidade Ativa no Frontend:', store);
      
      // 1. Buscar view de agregação (só pendentes)
      const { data: rawData, error } = await supabase
        .from('vw_produtos_a_enviar')
        .select('*')
        .eq('status', 'pendente');

      if (error) throw error;
      
      console.log('DEBUG: Dados brutos da View:', rawData);

      // 2. Filtrar por unidade (no JS para ser resiliente a views sem a coluna)
      const filteredData = (rawData || []).filter(item => {
        const itemUnit = item.unidade || 'MEIKE';
        return itemUnit === store;
      });
      
      console.log('DEBUG: Dados após filtro:', filteredData);

      // 3. Enriquecer com dados do Supabase (imagem, sku)
      const produtosIds = filteredData
        .filter((p) => p.id_produto_tiny && p.nome_produto.startsWith('*'))
        .map((p) => p.id_produto_tiny as number);

      let produtosMeta: Record<number, { url_imagem?: string; sku?: string }> = {};
      if (produtosIds.length > 0) {
        const { data: metaData } = await supabase
          .from('produtos')
          .select('id, url_imagem, sku')
          .in('id', produtosIds);

        (metaData || []).forEach((p: any) => {
          produtosMeta[p.id] = { url_imagem: p.url_imagem, sku: p.sku };
        });
      }

      // 4. Buscar estoque local em paralelo para cada produto
      const enrichedList = await Promise.all(
        filteredData
          .filter((p) => p.nome_produto?.startsWith('*'))
          .map(async (p) => {
            const meta = p.id_produto_tiny ? produtosMeta[p.id_produto_tiny] : {};
            const estoque_local = p.id_produto_tiny
              ? await fetchEstoqueLocal(p.id_produto_tiny, store)
              : 0;
            return {
              ...p,
              url_imagem: meta?.url_imagem,
              sku: meta?.sku,
              estoque_meike: estoque_local,
            };
          })
      );

      // Separar produtos com estoque vs. sem estoque
      const comEstoque = enrichedList.filter((p) => p.total_geral > 0);
      const semEst = enrichedList.filter((p) => p.total_geral === 0);

      setProdutos(comEstoque);
      setSemEstoque(semEst);
    } catch (err) {
      console.error('Erro ao carregar produtos a enviar:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-6">
          PRODUTOS À ENVIAR
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
          PRODUTOS À ENVIAR - <span className="text-indigo-500">{localStorage.getItem('nexxo_selected_store') || 'MEIKE'}</span>
        </h2>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-black transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {produtos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <Package size={40} strokeWidth={1} />
          <p className="text-sm font-medium">Nenhum produto pendente de envio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtos.map((p) => (
            <ProductCardEnvio
              key={p.id_produto_tiny ?? p.nome_produto}
              produto={p}
            />
          ))}
        </div>
      )}

      {semEstoque.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-4 border-b border-gray-200 pb-2">
            ITENS SEM ESTOQUE
          </h2>
          <div className="space-y-2">
            {semEstoque.map((p) => (
              <div
                key={p.id_produto_tiny ?? p.nome_produto}
                className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 text-sm"
              >
                <span className="font-semibold text-slate-700 truncate">{p.nome_produto}</span>
                <span className="text-xs text-black font-black uppercase tracking-wider">OK</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
