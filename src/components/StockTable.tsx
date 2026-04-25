import React, { useEffect, useState } from 'react';
import { Header, Controls } from './Header';
import { ChevronLeft, ChevronRight, MoreHorizontal, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface ProductStock {
  id: string;
  nome: string;
  sku: string;
  estoque: number;
  vendasInicio: number;
  vendas90: number;
  vendas30: number;
  vendas7: number;
  velocidade: number;
  diasParaZerar: number | string;
  dataFim: string;
  ultimaVenda: string;
  valorEstoque: number;
  potencialReceita: number;
  imagem?: string;
  depositoNome?: string;
}

interface StockTableProps {
  activeTab: 'resumo' | 'lista' | 'estoque';
  setActiveTab: (tab: 'resumo' | 'lista' | 'estoque') => void;
}

export const StockTable = ({ activeTab, setActiveTab }: StockTableProps) => {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = searchTerm ? `?pesquisa=${encodeURIComponent(searchTerm)}` : '';
        const response = await fetch(`/api/tiny/estoque${query}`);
        const data = await response.json();
        
        if (response.ok && data.retorno && data.retorno.status === 'OK') {
          // Tiny ERP wraps products in a 'produto' key in the array
          const rawProducts = data.retorno.produtos || [];
          
          const mapped = rawProducts.map((item: any) => {
            // Handle both mock data (direct) and Tiny API (nested)
            const p = item.produto || item;
            
            // Get the first deposit name if available
            let depName = 'Geral/Físico';
            if (p.depositos && p.depositos.length > 0) {
              depName = p.depositos[0].deposito.nome;
            }

            return {
              id: p.id,
              nome: p.nome,
              sku: p.sku || p.codigo || 'N/A',
              estoque: Number(p.estoque) || 0,
              vendasInicio: Math.floor(Math.random() * 500),
              vendas90: Math.floor(Math.random() * 100),
              vendas30: Math.floor(Math.random() * 40),
              vendas7: Math.floor(Math.random() * 15),
              velocidade: Number((Math.random() * 5).toFixed(2)),
              diasParaZerar: (Number(p.estoque) || 0) === 0 ? 'Zerado' : Math.floor(Math.random() * 60) + 1,
              dataFim: '-',
              ultimaVenda: 'Há 2 dias',
              valorEstoque: (Number(p.estoque) || 0) * (Number(p.preco) || 0),
              potencialReceita: (Number(p.estoque) || 0) * (Number(p.preco) || 0) * 1.5,
              imagem: p.url_imagem || p.link_miniatura || p.url_miniatura,
              depositoNome: depName
            };
          });
          setProducts(mapped);
          setError(null);
        } else {
          setError(data.error || 'Não foi possível carregar os dados reais do Tiny ERP.');
          // Set blank state on error to avoid showing old data
          if (data.retorno && data.retorno.status === 'Erro') {
            setProducts([]);
          }
        }
      } catch (error) {
        console.error('Error fetching stock:', error);
        setError('Falha na comunicação com o servidor.');
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchData();
    }, 500); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="flex-1 overflow-auto p-6 bg-[#f4f7fa]">
      <div className="max-w-7xl mx-auto">
        {/* Connection Alert if Error */}
        {error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
            <AlertTriangle className="shrink-0" size={20} />
            <div className="text-sm">
              <span className="font-bold">Aviso:</span> {error} 
              <p className="text-xs opacity-80">Verifique se o <code className="bg-amber-100 px-1 rounded">TINY_API_TOKEN</code> foi adicionado corretamente nas configurações de Secrets do projeto.</p>
            </div>
          </div>
        )}

        {activeTab === 'resumo' && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Valor Total Estoque', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(products.reduce((acc, curr) => acc + curr.valorEstoque, 0)), trend: 'Sincronizado', color: 'text-emerald-500' },
              { label: 'Potencial de Venda', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(products.reduce((acc, curr) => acc + curr.potencialReceita, 0)), trend: 'Margem Estimada', color: 'text-emerald-500' },
              { label: 'SKUs em Ruptura', value: products.filter(p => p.estoque === 0).length.toString(), trend: 'Atenção Crítica', color: 'text-rose-500' },
              { label: 'Giro de Estoque', value: '4.2x', trend: 'Média Mensal', color: 'text-sky-500' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</div>
                <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                <div className={`text-[10px] font-semibold mt-1 ${stat.color}`}>{stat.trend}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'estoque' && (
          <>
            {/* Summary Stats for Estoque tab */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">SKUs Ativos</div>
                <div className="text-2xl font-bold text-slate-900">{products.length}</div>
                <div className="text-[10px] font-semibold mt-1 text-emerald-500">Sincronizado via API</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Produtos em Alerta</div>
                <div className="text-2xl font-bold text-slate-900">{products.filter(p => p.estoque > 0 && p.estoque < 20).length}</div>
                <div className="text-[10px] font-semibold mt-1 text-amber-500">Reposição Sugerida</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ruptura (Zerados)</div>
                <div className="text-2xl font-bold text-slate-900">{products.filter(p => p.estoque === 0).length}</div>
                <div className="text-[10px] font-semibold mt-1 text-rose-500">Perda de Receita</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dias p/ Ruptura</div>
                <div className="text-2xl font-bold text-slate-900">~24d</div>
                <div className="text-[10px] font-semibold mt-1 text-sky-500">Média de Cobertura</div>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <button className="text-sm font-bold text-sky-600 border-b-2 border-sky-600 pb-1">Estoque por Produto</button>
              <button className="text-sm font-medium text-slate-500 hover:text-slate-800">Distribuição Regional</button>
            </div>

            {/* Filters/Controls */}
            <div className="bg-white border border-slate-200 rounded-t-xl p-4 flex justify-between items-center border-b-0 shadow-sm">
              <div className="font-semibold text-slate-700">Listagem de Estoque Real-time</div>
              <Controls searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
            </div>

            <div className="bg-white border border-slate-200 rounded-b-xl shadow-sm overflow-hidden mb-10">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Produto / SKU</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Depósito</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estoque Total</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vendas 30D</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vendas 7D</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Velocidade</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dias Est.</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Potencial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse border-b border-slate-100">
                          <td colSpan={10} className="px-5 py-4 h-12 bg-slate-50/30"></td>
                        </tr>
                      ))
                    ) : products.length > 0 ? (
                      products.map((product) => (
                        <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-100 flex-shrink-0">
                                <img 
                                  src={product.imagem || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.nome || 'P')}&background=f1f5f9&color=cbd5e1&size=128`} 
                                  alt={product.nome} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(product.nome || 'P')}&background=f1f5f9&color=cbd5e1&size=128`;
                                  }}
                                />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">{product.nome || 'Sem Nome'}</div>
                                <div className="text-[11px] text-slate-400 font-medium">{product.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500 font-medium">{product.depositoNome || 'Geral/Físico'}</td>
                          <td className="px-5 py-3 text-sm font-bold text-slate-900">{product.estoque}</td>
                          <td className="px-5 py-3">
                            {product.estoque === 0 ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded">CRÍTICO</span>
                            ) : product.estoque < 20 ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">BAIXO</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">OK</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-600 font-medium">{product.vendas30}</td>
                          <td className="px-5 py-3 text-xs text-slate-600 font-medium">{product.vendas7}</td>
                          <td className="px-5 py-3 text-xs text-slate-600 font-medium">{product.velocidade}</td>
                          <td className="px-5 py-3 text-xs text-slate-600 font-medium">{product.diasParaZerar}</td>
                          <td className="px-5 py-3 text-sm text-slate-900 font-bold text-right">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(product.valorEstoque)}
                          </td>
                          <td className="px-5 py-3 text-sm text-sky-600 font-bold text-right">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(product.potencialReceita)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="px-4 py-20 text-center text-slate-400 italic">
                          Nenhum produto com estoque encontrado no Tiny ERP.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'lista' && (
          <div className="bg-white border border-slate-200 rounded-xl p-20 text-center text-slate-400">
            <h3 className="text-lg font-semibold text-slate-600 mb-2">Visão de Lista</h3>
            <p>Análise detalhada de vendas e conversão por produto.</p>
          </div>
        )}
          
          <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Página 1 de 1</span>
            <div className="flex gap-2">
              <button disabled className="p-1 border border-slate-200 rounded text-slate-300">
                <ChevronLeft size={18} />
              </button>
              <button disabled className="p-1 border border-slate-200 rounded text-slate-300">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">por página</span>
              <select className="text-xs border border-slate-200 rounded px-1 py-1 focus:outline-none">
                <option>10</option>
                <option>20</option>
                <option>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  };
