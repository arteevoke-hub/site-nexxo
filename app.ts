import { useState, useEffect } from 'react';
import { ProductCard } from './ProductCard'; // Seu componente atualizado
import { supabase } from './lib/supabase'; // Ajuste o caminho do seu client Supabase

type TabType = 'Todas' | 'Mercado Livre' | 'Shopee' | 'Amazon' | 'Arquivados';

export function ControleEnviosFull() {
  const [activeTab, setActiveTab] = useState<TabType>('Todas');
  const [produtosAgregados, setProdutosAgregados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros das Abas de Navegação
  const tabs: TabType[] = ['Todas', 'Mercado Livre', 'Shopee', 'Amazon', 'Arquivados'];

  useEffect(() => {
    async function fetchDemandas() {
      setLoading(true);
      
      // Lógica de Arquivamento: Se for 'Arquivados', puxa status concluido/cancelado.
      // Se não, puxa 'pendente'.
      const statusFiltro = activeTab === 'Arquivados' 
        ? ['concluido', 'cancelado'] 
        : ['pendente'];

      let query = supabase
        .from('vw_produtos_a_enviar')
        .select('*')
        .in('status', statusFiltro);

      const { data, error } = await query;

      if (!error && data) {
        setProdutosAgregados(data);
      }
      setLoading(false);
    }

    fetchDemandas();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header e Abas */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle Envios Full</h1>
          <p className="text-sm text-gray-500">Gerencie remessas para Mercado Livre, Shopee e Amazon.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition">
          + Nova Remessa
        </button>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-2 text-sm font-semibold transition-colors ${
              activeTab === tab 
                ? 'border-b-2 border-indigo-600 text-indigo-600' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Grid de Produtos Acabados */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">Produtos à Enviar</h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Carregando demandas...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {produtosAgregados.map((item) => (
              <ProductCard 
                key={item.id_produto_tiny}
                produto={{
                  id: item.id_produto_tiny,
                  nome: item.nome_produto,
                  // Aqui entra a integração com a API do Tiny para o estoque real do Meikê
                  estoque: 100, // Substituir pelo valor vindo da API
                  url_imagem: '', // Substituir pelo valor da API
                  sku: item.id_produto_tiny.toString() // SKU numérico
                }}
                demandas={{
                  ml: item.qtd_ml,
                  shopee: item.qtd_shopee,
                  amazon: item.qtd_amazon,
                  total: item.total_geral
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Calendário e Itens Sem Estoque entram aqui (mantendo o layout que você já desenhou) */}
    </div>
  );
}