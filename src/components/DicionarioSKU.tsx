import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Save, Package, Link as LinkIcon, RefreshCw } from 'lucide-react';

interface ProdutoSKU {
  id_produto_tiny: number;
  nome: string;
  sku_tiny: string;
  sku_mercadolivre: string;
  sku_shopee: string;
  sku_amazon: string;
}

export function DicionarioSKU() {
  const [produtos, setProdutos] = useState<ProdutoSKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
      // Puxa produtos e os SKUs associados usando junção do Supabase
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          id,
          nome,
          sku,
          skus_marketplace ( sku_mercadolivre, sku_shopee, sku_amazon )
        `)
        .eq('unidade', store)
        .order('nome', { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((p: any) => ({
        id_produto_tiny: p.id,
        nome: p.nome,
        sku_tiny: p.sku || '',
        sku_mercadolivre: p.skus_marketplace?.[0]?.sku_mercadolivre || '',
        sku_shopee: p.skus_marketplace?.[0]?.sku_shopee || '',
        sku_amazon: p.skus_marketplace?.[0]?.sku_amazon || ''
      }));

      setProdutos(formatted);
    } catch (err) {
      console.error("Erro ao buscar SKUs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (id: number, field: string, value: string) => {
    setProdutos(prev => prev.map(p => 
      p.id_produto_tiny === id ? { ...p, [field]: value } : p
    ));
  };

  const handleSave = async (item: ProdutoSKU) => {
    setSaving(item.id_produto_tiny);
    try {
      const { error } = await supabase
        .from('skus_marketplace')
        .upsert({
          id_produto_tiny: item.id_produto_tiny,
          sku_tiny: item.sku_tiny,
          sku_mercadolivre: item.sku_mercadolivre,
          sku_shopee: item.sku_shopee,
          sku_amazon: item.sku_amazon
        }, { onConflict: 'id_produto_tiny' });

      if (error) throw error;
      
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar SKU");
    } finally {
      setTimeout(() => setSaving(null), 500);
    }
  };

  const filtered = produtos.filter(p => 
    p.nome.toLowerCase().includes(search.toLowerCase()) || 
    p.sku_tiny.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 bg-white text-slate-900 p-8 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-black uppercase tracking-tighter flex items-center gap-3 italic">
              <LinkIcon className="text-black" />
              Dicionário de SKUs
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Sincronização de identificadores entre Tiny ERP e Marketplaces.</p>
          </div>
          
          <button onClick={loadData} className="p-2.5 bg-black hover:bg-slate-800 rounded-none text-white transition-colors">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Barra de Busca */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="BUSCAR PRODUTO OU SKU..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-black placeholder-slate-400 pl-11 pr-4 py-3 rounded-none focus:outline-none focus:border-black transition-colors font-black text-xs uppercase tracking-widest"
          />
        </div>

        {/* Tabela */}
        <div className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0f172a] text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Produto Tiny</th>
                  <th className="px-6 py-4">SKU Tiny</th>
                  <th className="px-6 py-4">SKU Mercado Livre</th>
                  <th className="px-6 py-4">SKU Shopee</th>
                  <th className="px-6 py-4">SKU Amazon</th>
                  <th className="px-6 py-4 w-24 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                      Carregando produtos sincronizados...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Nenhum produto encontrado. Sincronize o Tiny ERP primeiro.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id_produto_tiny} className="hover:bg-slate-800/20 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-200 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none bg-slate-100 flex items-center justify-center text-black border border-slate-200">
                          <Package size={16} />
                        </div>
                        {item.nome}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-slate-800 px-2.5 py-1 rounded-md text-slate-300">
                          {item.sku_tiny || '---'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={item.sku_mercadolivre}
                          onChange={(e) => handleUpdate(item.id_produto_tiny, 'sku_mercadolivre', e.target.value)}
                          placeholder="Ex: MLB12345"
                          className="w-full bg-white border border-slate-200 text-black px-3 py-1.5 rounded-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-mono text-xs font-bold"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={item.sku_shopee}
                          onChange={(e) => handleUpdate(item.id_produto_tiny, 'sku_shopee', e.target.value)}
                          placeholder="Ex: SHP9876"
                          className="w-full bg-white border border-slate-200 text-black px-3 py-1.5 rounded-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-mono text-xs font-bold"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={item.sku_amazon}
                          onChange={(e) => handleUpdate(item.id_produto_tiny, 'sku_amazon', e.target.value)}
                          placeholder="Ex: AMZ5544"
                          className="w-full bg-white border border-slate-200 text-black px-3 py-1.5 rounded-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-mono text-xs font-bold"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleSave(item)}
                          disabled={saving === item.id_produto_tiny}
                          className="p-2 bg-black hover:bg-slate-800 text-white rounded-none transition-colors disabled:opacity-50"
                          title="Salvar"
                        >
                          {saving === item.id_produto_tiny ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
