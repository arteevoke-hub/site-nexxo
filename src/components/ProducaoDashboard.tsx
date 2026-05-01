import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Play, CheckCircle, Clock, Users, DollarSign, Activity, Package } from 'lucide-react';

export function ProducaoDashboard() {
  const [ordens, setOrdens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrdens();
  }, []);

  const loadOrdens = async () => {
    setLoading(true);
    
    // Lista OFICIAL de Kits para Montagem baseada na planilha
    const kitsMocks = [
      { id: 9001, nome: 'Kit 11 - Simples', sku: 'kit_11_simples', tipo: 'K', valor_mao_de_obra: 0.55 },
      { id: 9002, nome: 'Kit 11 - Presente', sku: 'kit_11_presente', tipo: 'K', valor_mao_de_obra: 0.95 },
      { id: 9003, nome: 'Kit 15 - Simples', sku: 'kit_15_simples', tipo: 'K', valor_mao_de_obra: 0.65 },
      { id: 9004, nome: 'Kit 15 - Presente', sku: 'kit_15_presente', tipo: 'K', valor_mao_de_obra: 1.10 },
      { id: 9005, nome: 'Kit 20 - Simples', sku: 'kit_20_simples', tipo: 'K', valor_mao_de_obra: 0.85 },
      { id: 9006, nome: 'Kit 20 - Presente', sku: 'kit_20_presente', tipo: 'K', valor_mao_de_obra: 1.30 },
      { id: 9007, nome: 'Kit Porán - Simples', sku: 'kit_poran_simples', tipo: 'K', valor_mao_de_obra: 0.60, url_imagem: 'https://cdn.awsli.com.br/600x450/2536/2536830/produto/251347012/6127110191-239i2b3r0z.jpg' },
      { id: 999991, nome: 'Kit Porán | MELANCIA - Cartão Dia das Mães (Presente)', sku: 'poran_melancia_maes', tipo: 'K', valor_mao_de_obra: 0.90, url_imagem: 'https://cdn.awsli.com.br/600x450/2536/2536830/produto/251347012/6127110191-239i2b3r0z.jpg' },
      { id: 999992, nome: 'Kit Fatale | Cartão Presente Exclusivo', sku: 'fatale_cartao_presente', tipo: 'K', valor_mao_de_obra: 1.10 }
    ];

    try {
      // 1. Garantir que os Kits Oficiais existem no banco (Para não dar erro de chave estrangeira ao criar ordem)
      await supabase.from('produtos').upsert(kitsMocks, { onConflict: 'id' });

      // 2. Carregar as ordens
      const { data, error } = await supabase
        .from('ordem_producao')
        .select(`
          *,
          produtos ( nome, url_imagem, sku ),
          funcionarios ( nome )
        `)
        .order('data_inicio', { ascending: false });

      if (error) console.error("Erro ordem_producao:", error);
      setOrdens(data || []);
      
      // 3. O painel agora vai usar SOMENTE a lista oficial (limpando a poluição de produtos do Tiny)
      setProdutos(kitsMocks);
    } catch (err) {
      console.error(err);
      setProdutos(kitsMocks); // Fallback
    } finally {
      setLoading(false);
    }
  };

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isPrecosModalOpen, setIsPrecosModalOpen] = useState(false);
  const [ordemParaNecessidade, setOrdemParaNecessidade] = useState<any>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [newOrder, setNewOrder] = useState({ id_produto_fabricado: '', quantidade_planejada: 100 });
  const [savingOrder, setSavingOrder] = useState(false);

  const handleCreateOrder = async () => {
    if (!newOrder.id_produto_fabricado || newOrder.quantidade_planejada <= 0) return alert('Preencha os campos corretamente.');
    setSavingOrder(true);
    try {
      const selectedProduct = produtos.find(p => p.id.toString() === newOrder.id_produto_fabricado.toString());
      const valorMaoDeObra = selectedProduct?.valor_mao_de_obra || 0;

      const { error } = await supabase.from('ordem_producao').insert([{
        id_produto_fabricado: newOrder.id_produto_fabricado,
        quantidade_planejada: newOrder.quantidade_planejada,
        custo_total: valorMaoDeObra * newOrder.quantidade_planejada,
        status: 'PENDENTE'
      }]);
      if (error) throw error;
      alert('Ordem de Produção criada com sucesso!');
      setIsNewOrderModalOpen(false);
      loadOrdens();
    } catch (err) {
      console.error(err);
      alert('Erro ao criar ordem');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleUpdatePreco = async (id: number, valor: string) => {
    const num = parseFloat(valor.replace(',', '.'));
    if (isNaN(num)) return;
    
    setProdutos(prev => prev.map(p => p.id === id ? { ...p, valor_mao_de_obra: num } : p));
    await supabase.from('produtos').update({ valor_mao_de_obra: num }).eq('id', id);
  };

  // Mock de resumo de folha de pagamento para o MVP (Num cenário real isso viria de uma query agregada)
  const resumoPagamento = [
    { nome: 'Ana Silva', kits: 450, valor: 270.00 },
    { nome: 'Carlos Mendes', kits: 380, valor: 228.00 },
    { nome: 'João Pedro', kits: 520, valor: 312.00 }
  ];

  const [isLancarEstoqueModalOpen, setIsLancarEstoqueModalOpen] = useState(false);
  const [ordemParaLancar, setOrdemParaLancar] = useState<any>(null);
  const [depositoSelecionado, setDepositoSelecionado] = useState('Depósito Meikê');

  const handleLancarEstoque = async () => {
    if (!ordemParaLancar) return;
    try {
      // API call real que injeta estoque no Tiny
      const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
      const res = await fetch('/api/tiny/producao', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-nexxo-store': store
        },
        body: JSON.stringify({
          ordem_id: ordemParaLancar.id,
          deposito: depositoSelecionado,
          quantidade: ordemParaLancar.quantidade_produzida,
          sku: ordemParaLancar.produtos?.sku
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao lançar estoque');
      }

      await supabase.from('ordem_producao').update({ status: 'LANCADA' }).eq('id', ordemParaLancar.id);
      
      alert(`Sucesso! ${ordemParaLancar.quantidade_produzida} unidades injetadas no Tiny ERP!`);
      setIsLancarEstoqueModalOpen(false);
      setOrdemParaLancar(null);
      loadOrdens();
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao lançar estoque no Tiny: ${error.message}`);
    }
  };

  const handleUpdateStatus = async (ordem: any, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      
      // Se estiver marcando como concluída manualmente, preenche a quantidade produzida igual à planejada
      if (newStatus === 'CONCLUIDA') {
        updates.quantidade_produzida = ordem.quantidade_planejada;
        updates.data_fim = new Date().toISOString();
      }

      await supabase.from('ordem_producao').update(updates).eq('id', ordem.id);
      loadOrdens();
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDENTE': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'EM_PRODUCAO': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'CONCLUIDA': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'LANCADA': return 'bg-white/20 text-white border-white/30';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-200 p-8 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Activity className="text-white" size={28} />
              Gestão de Produção
            </h1>
            <p className="text-slate-400 mt-1">Acompanhe as ordens de montagem de Kits e a produtividade da equipe.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setIsPrecosModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-none transition-all border border-slate-700">
              <DollarSign size={18} />
              Tabela de Preços (Mão de Obra)
            </button>
            <button onClick={() => setIsNewOrderModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-200 text-black font-black rounded-none shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all">
              <Plus size={18} />
              Nova Ordem
            </button>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#181a25] border border-slate-800 rounded-none p-6 flex items-center gap-5 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <div className="w-14 h-14 bg-white/10 rounded-none border border-white/20 flex items-center justify-center text-white">
               <Play size={24} />
             </div>
             <div>
               <div className="text-slate-400 text-sm font-medium mb-1">Em Produção</div>
               <div className="text-3xl font-black text-white">{ordens.filter(o => o.status === 'EM_PRODUCAO').length}</div>
             </div>
          </div>
          <div className="bg-[#181a25] border border-slate-800 rounded-none p-6 flex items-center gap-5 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <div className="w-14 h-14 bg-white/10 rounded-none border border-white/20 flex items-center justify-center text-white">
               <CheckCircle size={24} />
             </div>
             <div>
               <div className="text-slate-400 text-sm font-medium mb-1">Kits Concluídos (Aguard. Estoque)</div>
               <div className="text-3xl font-black text-white">{ordens.filter(o => o.status === 'CONCLUIDA').length}</div>
             </div>
          </div>
          <div className="bg-[#181a25] border border-slate-800 rounded-none p-6 flex items-center gap-5 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <div className="w-14 h-14 bg-white/10 rounded-none border border-white/20 flex items-center justify-center text-white">
               <DollarSign size={24} />
             </div>
             <div>
               <div className="text-slate-400 text-sm font-medium mb-1">Custo de Mão de Obra</div>
               <div className="text-3xl font-black text-white">R$ 810,00</div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Table */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Ordens Ativas</h2>
            <div className="bg-[#181a25] border border-slate-800 rounded-none overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#1e212e] text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Produto</th>
                    <th className="px-6 py-4">Progresso</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Carregando ordens...</td></tr>
                  ) : ordens.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Nenhuma ordem de produção cadastrada.</td></tr>
                  ) : (
                    ordens.map(ordem => (
                      <tr key={ordem.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-200">
                          {ordem.produtos?.nome || 'Produto Desconhecido'}
                          {ordem.funcionarios?.nome && (
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <Users size={12}/> {ordem.funcionarios.nome}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-800 rounded-none overflow-hidden">
                              <div 
                                className="h-full bg-white rounded-full" 
                                style={{width: `${Math.min(100, ((ordem.quantidade_produzida || 0) / ordem.quantidade_planejada) * 100)}%`}}
                              ></div>
                            </div>
                            <span className="text-xs font-mono text-slate-400 w-12 text-right">
                              {ordem.quantidade_produzida || 0}/{ordem.quantidade_planejada}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-none border text-[10px] font-black tracking-wider ${getStatusColor(ordem.status)}`}>
                            {ordem.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setOrdemParaNecessidade(ordem)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-none transition-colors"
                              title="Ver Necessidade de Materiais"
                            >
                              <Package size={16} />
                            </button>
                            
                            {ordem.status === 'PENDENTE' && (
                              <button 
                                onClick={() => handleUpdateStatus(ordem, 'EM_PRODUCAO')}
                                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-none transition-colors"
                                title="Dar Andamento"
                              >
                                <Play size={16} />
                              </button>
                            )}
                            
                            {ordem.status === 'EM_PRODUCAO' && (
                              <button 
                                onClick={() => handleUpdateStatus(ordem, 'CONCLUIDA')}
                                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-none transition-colors"
                                title="Finalizar"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                            
                            {ordem.status === 'CONCLUIDA' && (
                              <button 
                                onClick={() => {
                                  setOrdemParaLancar(ordem);
                                  setIsLancarEstoqueModalOpen(true);
                                }}
                                className="text-xs bg-white hover:bg-slate-200 text-black px-3 py-1.5 rounded-none transition-colors shadow-lg font-black"
                              >
                                Lançar Estoque
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* HR Sidebar */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Fechamento (Semana)</h2>
            <div className="bg-[#181a25] border border-slate-800 rounded-none p-6 space-y-6">
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total a Pagar</span>
                <span className="text-lg font-black text-white">R$ 810,00</span>
              </div>

              <div className="space-y-4">
                {resumoPagamento.map((func, idx) => {
                  // Calcula proporção para barra
                  const max = Math.max(...resumoPagamento.map(r => r.valor));
                  const percentage = (func.valor / max) * 100;
                  
                  return (
                    <div key={idx} className="space-y-1.5 group">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-slate-200">{func.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">R$ {func.valor.toFixed(2)}</span>
                          <button 
                            className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-none opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => alert(`Lançamento de Contas a Pagar para ${func.nome} enviado ao Tiny ERP!`)}
                          >
                            Pagar (Tiny)
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-none overflow-hidden">
                          <div className="h-full bg-white/80 rounded-none" style={{width: `${percentage}%`}}></div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{func.kits} kits</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-none text-sm font-medium hover:bg-slate-800 transition-colors">
                  PDF
                </button>
                <button 
                  className="flex-[3] py-2.5 bg-white hover:bg-slate-200 text-black rounded-none text-sm font-bold transition-colors"
                  onClick={() => alert("Lançamento em lote enviado para Contas a Pagar do Tiny!")}
                >
                  Pagar Todos no Tiny ERP
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* MODAL NOVA ORDEM */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181a25] border border-slate-700 w-full max-w-4xl rounded-none p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <h2 className="text-xl font-bold text-white mb-6">Criar Nova Ordem de Produção</h2>
            
            <div className="flex-1 overflow-auto space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">Selecione o Kit / Produto</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {produtos.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => setNewOrder({...newOrder, id_produto_fabricado: p.id})}
                      className={`cursor-pointer border-2 rounded-none p-4 flex flex-col items-center text-center transition-all ${
                        newOrder.id_produto_fabricado === p.id 
                          ? 'border-white bg-white/10' 
                          : 'border-slate-800 bg-[#1e212e] hover:border-slate-600'
                      }`}
                    >
                      <div className="w-16 h-16 bg-white rounded-none mb-3 flex items-center justify-center overflow-hidden">
                        {p.url_imagem ? (
                          <img src={p.url_imagem} alt={p.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="text-slate-950" size={24} />
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-200 line-clamp-2">{p.nome}</div>
                      <div className="text-xs font-mono text-white mt-2">
                        R$ {(p.valor_mao_de_obra || 0).toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NECESSIDADE DE MATERIAIS */}
              {newOrder.id_produto_fabricado && newOrder.quantidade_planejada > 0 && (
                <div className="border border-slate-700 rounded-none p-4 bg-[#1e212e]">
                  <h3 className="text-white font-bold mb-3">Necessidade de Materiais</h3>
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="pb-2">Produto/Componente</th>
                        <th className="pb-2 text-right">Qtd Necessária</th>
                        <th className="pb-2 text-right">Estoque Atual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {(() => {
                        const product = produtos.find(p => p.id === newOrder.id_produto_fabricado);
                        let structure = product?.estrutura || [];
                        
                        // MOCK temporário para visualização baseada no SKU conforme o print
                        if (!structure || structure.length === 0 || typeof structure === 'string') {
                           if (product?.sku === '0186628343429' || product?.sku === 'poran_melancia_maes') {
                             structure = [
                               { nome: 'Body Splash Melancia | Poran', quantidade: 1, estoque_atual: 9 },
                               { nome: 'Hidratante Melancia | Poran', quantidade: 1, estoque_atual: 104 },
                               { nome: 'Sabonete Melancia | Poran', quantidade: 1, estoque_atual: 118 },
                               { nome: 'Esfoliante Melancia | Poran', quantidade: 1, estoque_atual: 90 },
                               { nome: 'EMBALAGEM CAIXA | CB | Combo', quantidade: 1, estoque_atual: -21 }
                             ];
                           } else if (product?.sku?.includes('fatale_cartao_presente') || product?.nome?.toLowerCase().includes('fatale')) {
                             structure = [
                               { nome: 'Hidratante Fatale', quantidade: 1, estoque_atual: 150 },
                               { nome: 'Body Splash Fatale', quantidade: 1, estoque_atual: 120 },
                               { nome: 'Caixa Presente Fatale', quantidade: 1, estoque_atual: 85 }
                             ];
                           }
                        }

                        if (structure && structure.length > 0) {
                          return structure.map((item: any, i: number) => (
                            <tr key={i}>
                              <td className="py-2 text-slate-300">{item.nome}</td>
                              <td className="py-2 text-right text-white font-mono">{item.quantidade * newOrder.quantidade_planejada}</td>
                              <td className="py-2 text-right text-slate-400 font-mono">
                                {item.estoque_atual < (item.quantidade * newOrder.quantidade_planejada) ? (
                                  <span className="text-white font-bold">{item.estoque_atual || 0}</span>
                                ) : (
                                  <span className="text-slate-400">{item.estoque_atual || 0}</span>
                                )}
                              </td>
                            </tr>
                          ));
                        } else {
                          return (
                            <tr>
                              <td colSpan={3} className="py-4 text-center text-slate-500">
                                (Kit sem estrutura cadastrada)
                                <br/><span className="text-xs text-white mt-1 inline-block">Nenhuma matéria-prima mapeada. Cuidado ao enviar para produção.</span>
                              </td>
                            </tr>
                          );
                        }
                      })()}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 w-64 mx-auto">
                <label className="block text-sm font-medium text-slate-400 mb-1 text-center">Quantidade Planejada</label>
                <input 
                  type="number"
                  min="1"
                  className="w-full bg-[#0f111a] border-2 border-slate-700 text-white rounded-none p-4 text-center text-2xl font-black focus:outline-none focus:border-white"
                  value={newOrder.quantidade_planejada}
                  onChange={e => setNewOrder({...newOrder, quantidade_planejada: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800">
              <button 
                onClick={() => setIsNewOrderModalOpen(false)}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-none font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateOrder}
                disabled={savingOrder || !newOrder.id_produto_fabricado}
                className="flex-1 px-4 py-3 bg-white hover:bg-slate-200 text-black rounded-none font-black transition-colors disabled:opacity-50 text-lg shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                {savingOrder ? 'Criando Ordem...' : 'Criar e Liberar para Montagem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LANÇAR ESTOQUE */}
      {isLancarEstoqueModalOpen && ordemParaLancar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181a25] border border-slate-700 w-full max-w-md rounded-none p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Lançar Estoque</h2>
            <p className="text-slate-400 text-sm mb-6">A ordem <span className="text-white font-bold">{ordemParaLancar.produtos?.nome}</span> foi concluída. Onde deseja alocar as {ordemParaLancar.quantidade_produzida} unidades montadas?</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Selecione o depósito de entrada</label>
                <select 
                  className="w-full bg-[#0f111a] border border-slate-700 text-white rounded-none p-3 focus:outline-none focus:border-white"
                  value={depositoSelecionado}
                  onChange={e => setDepositoSelecionado(e.target.value)}
                >
                  <option value="Depósito Meikê">Depósito Meikê</option>
                  <option value="Depósito Full Amazon | FBA">Depósito Full Amazon | FBA</option>
                  <option value="Depósito Full ML">Depósito Full ML</option>
                  <option value="Depósito Full Shopee">Depósito Full Shopee</option>
                  <option value="Estoque Lojas Físicas">Estoque Lojas Físicas</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsLancarEstoqueModalOpen(false)}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-none font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleLancarEstoque}
                className="flex-[2] px-4 py-2 bg-white hover:bg-slate-200 text-black rounded-none font-black transition-colors shadow-lg"
              >
                Confirmar Lançamento (Tiny)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NECESSIDADE DE MATERIAIS */}
      {ordemParaNecessidade && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181a25] border border-slate-700 w-full max-w-3xl rounded-none p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="text-white" />
                Necessidade de Materiais
              </h2>
              <button onClick={() => setOrdemParaNecessidade(null)} className="text-slate-500 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            
            <p className="text-slate-400 mb-6">
              Estrutura para montar <span className="text-white font-bold">{ordemParaNecessidade.quantidade_planejada} unidades</span> de <span className="text-white font-bold">{ordemParaNecessidade.produtos?.nome}</span>:
            </p>

            <div className="flex-1 overflow-auto bg-[#1e212e] rounded-none border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0f111a] text-slate-400 sticky top-0 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Produto / Componente</th>
                    <th className="px-4 py-3 text-right">Qtd. Necessária</th>
                    <th className="px-4 py-3 text-right">Estoque Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {(() => {
                    const product = produtos.find(p => p.id === ordemParaNecessidade.id_produto_fabricado);
                    let structure = product?.estrutura || [];
                    
                    if (!structure || structure.length === 0 || typeof structure === 'string') {
                        if (product?.sku === '0186628343429' || product?.sku === 'poran_melancia_maes') {
                          structure = [
                            { nome: 'Body Splash Melancia | Poran', quantidade: 1, estoque_atual: 9 },
                            { nome: 'Hidratante Melancia | Poran', quantidade: 1, estoque_atual: 104 },
                            { nome: 'Sabonete Melancia | Poran', quantidade: 1, estoque_atual: 118 },
                            { nome: 'Esfoliante Melancia | Poran', quantidade: 1, estoque_atual: 90 },
                            { nome: 'EMBALAGEM CAIXA | CB | Combo', quantidade: 1, estoque_atual: -21 }
                          ];
                        } else if (product?.sku?.includes('fatale_cartao_presente') || product?.nome?.toLowerCase().includes('fatale')) {
                          structure = [
                            { nome: 'Hidratante Fatale', quantidade: 1, estoque_atual: 150 },
                            { nome: 'Body Splash Fatale', quantidade: 1, estoque_atual: 120 },
                            { nome: 'Caixa Presente Fatale', quantidade: 1, estoque_atual: 85 }
                          ];
                        }
                    }

                    if (structure && structure.length > 0) {
                      return structure.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-800/20">
                          <td className="px-4 py-3 text-slate-300">{item.nome}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-mono font-bold">{item.quantidade * ordemParaNecessidade.quantidade_planejada}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            {item.estoque_atual < (item.quantidade * ordemParaNecessidade.quantidade_planejada) ? (
                              <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-1 rounded-none">{item.estoque_atual || 0}</span>
                            ) : (
                              <span className="text-slate-400">{item.estoque_atual || 0}</span>
                            )}
                          </td>
                        </tr>
                      ));
                    } else {
                      return (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                            Nenhuma estrutura de materiais mapeada para este produto.
                          </td>
                        </tr>
                      );
                    }
                  })()}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => {
                  alert("Imprimindo Necessidade de Materiais...");
                  setOrdemParaNecessidade(null);
                }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-none font-medium transition-colors"
              >
                Imprimir PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TABELA DE PREÇOS */}
      {isPrecosModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181a25] border border-slate-700 w-full max-w-2xl rounded-none p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <h2 className="text-xl font-bold text-white mb-2">Tabela de Preços (Mão de Obra)</h2>
            <p className="text-slate-400 text-sm mb-6">Defina o valor pago ao funcionário por cada unidade montada.</p>
            
            <div className="flex-1 overflow-auto border border-slate-800 rounded-none">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#1e212e] text-slate-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Produto / Kit</th>
                    <th className="px-4 py-3 w-40 text-right">Valor P/ Unidade (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {produtos.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/20">
                      <td className="px-4 py-3 text-slate-200">{p.nome}</td>
                      <td className="px-4 py-3">
                        <input 
                          type="text"
                          className="w-full bg-[#0f111a] border border-slate-700 text-emerald-400 text-right rounded-none p-2 focus:outline-none focus:border-emerald-500 font-mono"
                          defaultValue={(p.valor_mao_de_obra || 0).toFixed(2).replace('.', ',')}
                          onBlur={(e) => handleUpdatePreco(p.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setIsPrecosModalOpen(false)}
                className="px-6 py-2 bg-white hover:bg-slate-200 text-black rounded-none font-black transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
