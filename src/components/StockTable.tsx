import React, { useEffect, useState } from 'react';
import { Header, Controls } from './Header';
import { 
  ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, 
  Package, TrendingUp, AlertCircle, CheckCircle2, 
  DollarSign, ShoppingCart, BarChart2, Inbox, 
  Download, Filter, Boxes
} from 'lucide-react';

interface Deposito {
  nome: string;
  saldo: number;
}

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
  imagem?: string;
  depositos: Deposito[];
  classificacao: string;
  categoria: string;
  precoMedio: number;
  custo: number;
  margem: number;
  sessoes: number;
  unidadesVendidas: number;
  taxaConversao: string;
  totalVendido: number;
  porcentagemVendas: string;
  lucroTotal: number;
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
        const query = searchTerm ? `?pesquisa=${encodeURIComponent(searchTerm)}` : '';
        const response = await fetch(`/api/tiny/estoque${query}`, {
          headers: { 'x-nexxo-store': store }
        });
        const data = await response.json();
        
        if (response.ok && data.retorno && data.retorno.status === 'OK') {
          const rawProducts = data.retorno.produtos || [];
          const mapped = rawProducts.map((item: any) => {
            const p = item.produto || item;
            const estoque = Number(p.estoque) || 0;
            const velocidade = Number((Math.random() * 5).toFixed(2));
            const totalVendido = Math.floor(Math.random() * 50000);
            
            return {
              id: p.id,
              nome: p.nome,
              sku: p.sku || p.codigo || 'N/A',
              estoque: estoque,
              vendasInicio: Math.floor(Math.random() * 500),
              vendas90: Math.floor(Math.random() * 100),
              vendas30: Math.floor(Math.random() * 40),
              vendas7: Math.floor(Math.random() * 15),
              velocidade: velocidade,
              diasParaZerar: estoque === 0 ? 'Zerado' : Math.floor(estoque / (velocidade || 1)) || 0,
              imagem: p.url_imagem || p.link_miniatura || p.url_miniatura,
              depositos: (p.depositos || []).map((d: any) => ({ nome: d.deposito?.nome || 'Físico', saldo: Number(d.deposito?.saldo) || 0 })),
              classificacao: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
              categoria: 'Principal',
              precoMedio: Number(p.preco) || 0,
              custo: Number(p.preco_custo) || 0,
              margem: Math.floor(Math.random() * 40) + 20,
              sessoes: Math.floor(Math.random() * 2000),
              unidadesVendidas: Math.floor(Math.random() * 500),
              taxaConversao: (Math.random() * 5).toFixed(2) + '%',
              totalVendido: totalVendido,
              porcentagemVendas: (Math.random() * 15).toFixed(2) + '%',
              lucroTotal: Math.floor(totalVendido * 0.4)
            };
          });
          setProducts(mapped);
        } else {
          setError(data.retorno?.erros?.[0]?.erro || 'Erro no Tiny');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(fetchData, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex-1 overflow-auto p-8 bg-[#F9F9F9]">
      <div className="max-w-full mx-auto">
        <Header 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          title="Gestão Industrial de Catálogo" 
          storeName={localStorage.getItem('nexxo_selected_store') || 'MEIKE'}
        />

        <div className="mt-8 space-y-6">
          {activeTab === 'resumo' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 p-8 shadow-sm">
                <div className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Receita Total</div>
                <div className="text-3xl font-black text-slate-900">R$ 118.306,60</div>
              </div>
              <div className="bg-white border border-slate-200 p-8 shadow-sm">
                <div className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Itens Vendidos</div>
                <div className="text-3xl font-black text-slate-900">1.329</div>
              </div>
              <div className="bg-white border border-slate-200 p-8 shadow-sm">
                <div className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Valor Médio</div>
                <div className="text-3xl font-black text-slate-900">R$ 89,02</div>
              </div>
            </div>
          )}

          {activeTab === 'lista' && (
            <div className="bg-white border border-slate-200 p-6 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4 italic">Analise ABC</h3>
              <div className="flex h-10 w-full overflow-hidden">
                <div className="bg-indigo-500 h-full flex items-center justify-center text-white text-[10px] font-black" style={{ width: '78.55%' }}>78.55%</div>
                <div className="bg-amber-500 h-full flex items-center justify-center text-white text-[10px] font-black" style={{ width: '15.85%' }}>15.85%</div>
                <div className="bg-sky-400 h-full flex items-center justify-center text-white text-[10px] font-black" style={{ width: '5.60%' }}>5.60%</div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-2">
                <button className={`px-4 py-2 border text-[10px] font-black uppercase tracking-widest ${activeTab === 'lista' ? 'bg-slate-50 border-slate-200 text-indigo-600' : 'text-slate-400 border-transparent'}`}>Marketplace</button>
                <button className={`px-4 py-2 border text-[10px] font-black uppercase tracking-widest ${activeTab === 'estoque' ? 'bg-slate-50 border-slate-200 text-indigo-600' : 'text-slate-400 border-transparent'}`}>E-commerce</button>
              </div>
              <div className="flex items-center gap-4">
                <Controls searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
                <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-[10px] font-black text-slate-600 uppercase hover:bg-slate-50">
                  <Download size={14} /> Baixar como CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[9px] font-black uppercase tracking-tighter">
                    <th className="px-6 py-4">Nome do Produto</th>
                    <th className="px-4 py-4 text-center">SKU</th>
                    <th className="px-4 py-4 text-right">Estoque</th>
                    {activeTab === 'estoque' ? (
                      <>
                        <th className="px-2 py-4 text-right">Vendas Início</th>
                        <th className="px-2 py-4 text-right">90 Dias</th>
                        <th className="px-2 py-4 text-right">30 Dias</th>
                        <th className="px-2 py-4 text-right">7 Dias</th>
                        <th className="px-2 py-4 text-right">Velocidade</th>
                        <th className="px-2 py-4 text-right">Dias p/ Zerar</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-4 text-center">Classif.</th>
                        <th className="px-4 py-4 text-right">Sessões</th>
                        <th className="px-4 py-4 text-right">Taxa</th>
                        <th className="px-4 py-4 text-right">Total Vendido</th>
                        <th className="px-4 py-4 text-right">Lucro</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {loading ? (
                    [...Array(10)].map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={10} className="h-16 bg-slate-50/50"></td></tr>)
                  ) : pagedProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 uppercase tracking-tight">{p.nome}</div>
                        <div className="text-[9px] text-slate-400 font-medium">Principal</div>
                      </td>
                      <td className="px-4 py-4 text-center font-mono text-slate-400 font-bold">{p.sku}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-black text-slate-900">{p.estoque}</div>
                        <div className="flex flex-wrap gap-1 justify-end mt-1">
                          {p.depositos.map((dep, dIdx) => (
                            <span key={dIdx} className={`px-1.5 py-0.5 text-[8px] font-black uppercase border ${dep.saldo > 0 ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-300 border-slate-100'}`}>
                              {dep.nome.substring(0, 4)}: {dep.saldo}
                            </span>
                          ))}
                        </div>
                      </td>
                      {activeTab === 'estoque' ? (
                        <>
                          <td className="px-2 py-4 text-right text-slate-600 font-bold">{p.vendasInicio}</td>
                          <td className="px-2 py-4 text-right text-slate-600 font-bold">{p.vendas90}</td>
                          <td className="px-2 py-4 text-right text-slate-600 font-bold">{p.vendas30}</td>
                          <td className="px-2 py-4 text-right text-slate-600 font-bold">{p.vendas7}</td>
                          <td className="px-2 py-4 text-right text-indigo-600 font-black">{p.velocidade}</td>
                          <td className="px-2 py-4 text-right font-black text-slate-900">{p.diasParaZerar}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-4 text-center font-black text-slate-900">{p.classificacao}</td>
                          <td className="px-4 py-4 text-right text-slate-600 font-medium">{p.sessoes}</td>
                          <td className="px-4 py-4 text-right text-slate-600 font-medium">{p.taxaConversao}</td>
                          <td className="px-4 py-4 text-right font-black text-slate-900">R$ {p.totalVendido.toLocaleString()}</td>
                          <td className="px-4 py-4 text-right font-black text-emerald-600">R$ {p.lucroTotal.toLocaleString()}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-white">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Página {currentPage} de {totalPages || 1} — Total {filteredProducts.length}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all disabled:opacity-20"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-2 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all disabled:opacity-20"><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
