import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, ArrowRight, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Package, Check, Clock, AlertOctagon, X } from 'lucide-react';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Remessa {
  id: string;
  plataforma: string;
  numero_envio: string;
  data_envio: string;
  volume_total: string;
  volume_caixas: string;
  horario_coleta: string;
  sequencial: number | null;
  status: string;
  created_at: string;
}

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
  estoque_meike: number;
  depositos?: { nome: string; saldo: number }[];
  saldo_total?: number;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const ARCHIVED = ['concluido', 'cancelado'];
const TABS = ['Todas', 'Mercado Livre', 'Shopee', 'Amazon', 'Arquivados'] as const;
type Tab = typeof TABS[number];

function plataformaBadge(plataforma: string) {
  if (plataforma?.toLowerCase().includes('mercado'))
    return { label: 'Mercado Livre', dot: 'bg-yellow-400', bg: 'bg-yellow-50 text-yellow-800 border-yellow-200' };
  if (plataforma?.toLowerCase().includes('shopee'))
    return { label: 'Shopee', dot: 'bg-orange-400', bg: 'bg-orange-50 text-orange-800 border-orange-200' };
  if (plataforma?.toLowerCase().includes('amazon'))
    return { label: 'Amazon', dot: 'bg-slate-400', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
  return { label: plataforma || '-', dot: 'bg-indigo-400', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
}


function fmtDate(str: string) {
  if (!str) return '-';
  const d = new Date(str + (str.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── MINI CALENDAR ────────────────────────────────────────────────────────────
function MiniCalendar({ remessas }: { remessas: Remessa[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const monthName = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const shipDays = new Set(
    remessas
      .filter(r => r.data_envio)
      .map(r => {
        const d = new Date(r.data_envio + (r.data_envio.includes('T') ? '' : 'T00:00:00'));
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
  );

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="bg-white border border-gray-200 rounded-none p-4 w-64 shrink-0 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={14} /></button>
        <span className="text-xs font-bold text-slate-700 capitalize">{monthName}</span>
        <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={14} /></button>
      </div>
      <div className="grid grid-cols-7 text-[9px] font-bold text-slate-400 text-center mb-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 text-center mb-0.5">
          {week.map((day, di) => {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const hasShip = day !== null && shipDays.has(`${year}-${month}-${day}`);
            return (
              <div
                key={di}
                className={`text-[10px] h-6 flex items-center justify-center rounded-full font-semibold
                  ${!day ? '' : isToday ? 'bg-slate-900 text-white' : hasShip ? 'bg-yellow-400 text-slate-900' : 'text-slate-600 hover:bg-gray-100 cursor-pointer'}
                `}
              >
                {day}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── CALENDAR LIST ────────────────────────────────────────────────────────────
function CalendarioEnvios({ remessas }: { remessas: Remessa[] }) {
  const sorted = [...remessas]
    .filter(r => r.data_envio)
    .sort((a, b) => new Date(a.data_envio).getTime() - new Date(b.data_envio).getTime());

  function dotColor(plataforma: string) {
    if (plataforma?.toLowerCase().includes('mercado')) return 'bg-yellow-400';
    if (plataforma?.toLowerCase().includes('shopee')) return 'bg-orange-400';
    if (plataforma?.toLowerCase().includes('amazon')) return 'bg-slate-500';
    return 'bg-indigo-400';
  }

  function fmtDateLong(str: string) {
    const d = new Date(str + (str.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' }).toUpperCase();
  }

  function prefixo(plataforma: string, seq: number | null) {
    const p = plataforma?.toLowerCase();
    let prefix = 'FULL';
    if (p?.includes('mercado')) prefix = 'FULL ML';
    else if (p?.includes('shopee')) prefix = 'FULL SHOPEE';
    else if (p?.includes('amazon')) prefix = 'FULL AMZ';
    const num = seq ? String(seq).padStart(2, '0') : '??';
    return prefix + ' | ' + num;
  }

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-5">
        CALENDÁRIO DE ENVIOS
      </h2>
      <div className="flex gap-6">
        {/* Lista de eventos */}
        <div className="flex-1 space-y-1.5">
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum envio programado.</p>
          ) : (
            sorted.map(r => (
              <div key={r.id} className="flex items-center gap-3 text-xs">
                <span className="text-[10px] text-slate-400 font-mono w-36 shrink-0">
                  {fmtDateLong(r.data_envio)}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor(r.plataforma)}`} />
                <span className="text-[10px] text-slate-500 w-20 shrink-0">
                  {r.horario_coleta ? `${r.horario_coleta}` : '8 – 9pm'}
                </span>
                <span className="font-bold text-slate-800 truncate">
                  {prefixo(r.plataforma, r.sequencial)} | #{r.numero_envio}
                </span>
              </div>
            ))
          )}
        </div>
        {/* Mini calendário */}
        <MiniCalendar remessas={remessas} />
      </div>
    </section>
  );
}

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────
function ProductCardEnvio({ produto }: { produto: ProdutoEnvio }) {
  const [imgErr, setImgErr] = useState(false);
  const precisaProduzir = produto.estoque_meike < produto.total_geral;

  const [creatingOrder, setCreatingOrder] = useState(false);

  const handleProduzir = async () => {
    const faltam = produto.total_geral - produto.estoque_meike;
    if (faltam <= 0) return;
    if (!produto.id_produto_tiny) return alert("Produto não mapeado corretamente.");
    
    if (!confirm(`Deseja gerar uma Ordem de Produção de ${faltam} unidades para este item?`)) return;

    setCreatingOrder(true);
    try {
      const { error } = await supabase.from('ordem_producao').insert([{
        id_produto_fabricado: produto.id_produto_tiny,
        quantidade_planejada: faltam,
        status: 'PENDENTE'
      }]);
      if (error) throw error;
      alert(`Sucesso! Ordem de Produção de ${faltam} un. criada na Gestão de Produção.`);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar ordem');
    } finally {
      setCreatingOrder(false);
    }
  };

  const valColor = (v: number) => {
    if (v === 0) return 'text-red-500';
    if (v < produto.total_geral) return 'text-orange-500';
    return 'text-emerald-600';
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm flex flex-col group hover:shadow-xl transition-all duration-300 rounded-none overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 border-b border-slate-50">
        <div className="w-16 h-16 shrink-0 bg-slate-50 overflow-hidden rounded-none border border-slate-100">
          {produto.url_imagem && !imgErr ? (
            <img src={produto.url_imagem} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={() => setImgErr(true)} loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
              <Package size={24} strokeWidth={1} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] font-extrabold text-slate-900 leading-tight uppercase line-clamp-2">
            {produto.nome_produto}
          </h3>
          {produto.sku && (
            <p className="text-[10px] text-orange-500 font-mono mt-0.5 truncate font-semibold">
              {produto.sku}
            </p>
          )}
        </div>
        {precisaProduzir && (
          <button 
            onClick={handleProduzir}
            disabled={creatingOrder}
            className="shrink-0 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-none shadow-sm transition-all transform active:scale-95 disabled:opacity-50"
          >
            {creatingOrder ? <RefreshCw size={10} className="animate-spin" /> : <AlertTriangle size={10} />}
            PRODUZIR
          </button>
        )}
      </div>

      {/* Qtds */}
      <div className="px-3 pt-3 pb-1">
        <div className="grid grid-cols-4 text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
          <span>Shopee</span><span>ML</span><span>Amazon</span><span className="text-right">Qntd Total</span>
        </div>
        <div className="grid grid-cols-4 text-[22px] font-black text-slate-900 leading-none">
          <span>{produto.qtd_shopee}</span>
          <span>{produto.qtd_ml}</span>
          <span>{produto.qtd_amazon}</span>
          <span className="text-right text-indigo-600 pl-4">{produto.total_geral}</span>
        </div>
      </div>

      {/* Estoque */}
      <div className="px-3 pt-4 pb-3 mt-auto bg-slate-50/50 rounded-none border-t border-slate-100">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest pb-1 mb-2 flex justify-between items-center">
          <span>DEPÓSITOS TINY</span>
          <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Total: {produto.saldo_total ?? 0}</span>
        </div>
        <div className="space-y-1.5 text-[11px]">
          {(produto.depositos || []).map((d) => (
            <div key={d.nome} className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0">
              <span className="text-slate-600 font-semibold truncate flex-1 mr-2">{d.nome}</span>
              <span className={`font-black text-[13px] ${valColor(d.saldo)}`}>{d.saldo}</span>
            </div>
          ))}
          {(!produto.depositos || produto.depositos.length === 0) && (
            <div className="text-slate-400 italic text-[10px] py-2">Nenhum depósito encontrado</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PRODUTOS À ENVIAR & ITENS SEM ESTOQUE ────────────────────────────────────
interface InsumoFaltante {
  id: number;
  nome: string;
  sku: string;
  url_imagem?: string;
  necessidade: number;
  estoque_meike: number;
}

function ProdutosAEnviar() {
  const [pendentes, setPendentes] = useState<ProdutoEnvio[]>([]);
  const [insumosFaltantes, setInsumosFaltantes] = useState<InsumoFaltante[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const { data: viewData } = await supabase
        .from('vw_produtos_a_enviar')
        .select('*')
        .eq('status', 'pendente');

      if (!viewData || viewData.length === 0) {
        setPendentes([]);
        setInsumosFaltantes([]);
        return;
      }

      const ids = [...new Set(viewData.map((p: any) => Number(p.id_produto_tiny)).filter(Boolean))];
      let meta: Record<number, { url_imagem?: string; sku?: string }> = {};
      
      if (ids.length) {
        const { data: metaData } = await supabase
          .from('produtos')
          .select('id, url_imagem, sku')
          .in('id', ids);
        metaData?.forEach((p: any) => { meta[p.id] = { url_imagem: p.url_imagem, sku: p.sku }; });
      }

      const necessidadeInsumos: Record<number, { id: number; nome: string; sku: string; url_imagem?: string; total: number }> = {};
      
      const enrichedPendentes = await Promise.all(viewData.map(async (p: any) => {
        const m = p.id_produto_tiny ? meta[p.id_produto_tiny] : {};
        let estoque_meike = 0;
        
        if (p.id_produto_tiny) {
          try {
            const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
            const [rEst, rProd] = await Promise.all([
              fetch(`/api/tiny/estoque/${p.id_produto_tiny}`, { headers: { 'x-nexxo-store': store } }),
              fetch(`/api/tiny/produto/${p.id_produto_tiny}`, { headers: { 'x-nexxo-store': store } })
            ]);

            if (rEst.ok) {
              const d = await rEst.json();
              const internalDeposits = (d.depositos || []).filter((x: any) => 
                !x.nome?.toLowerCase().includes('full') && 
                !x.nome?.toLowerCase().includes('amazon') && 
                !x.nome?.toLowerCase().includes('fba')
              );
              estoque_meike = internalDeposits.reduce((acc: number, curr: any) => acc + curr.saldo, 0);
              
              return { 
                ...p, 
                url_imagem: m?.url_imagem, 
                sku: m?.sku, 
                estoque_meike,
                depositos: d.depositos || [],
                saldo_total: d.saldoTotal ?? 0
              };
            }

            if (rProd.ok) {
              const fullProd = await rProd.json();
              if (fullProd.componentes && fullProd.componentes.length > 0) {
                fullProd.componentes.forEach((comp: any) => {
                  const compId = Number(comp.componente.id);
                  const qtdNecessaria = Number(comp.componente.quantidade) * p.total_geral;
                  
                  if (!necessidadeInsumos[compId]) {
                    necessidadeInsumos[compId] = {
                      id: compId,
                      nome: comp.componente.nome,
                      sku: comp.componente.codigo,
                      total: 0
                    };
                  }
                  necessidadeInsumos[compId].total += qtdNecessaria;
                });
              }
            }
          } catch (err) {
            console.error("Erro ao carregar dados do produto:", p.nome_produto, err);
          }
        }
        return { ...p, url_imagem: m?.url_imagem, sku: m?.sku, estoque_meike };
      }));

      setPendentes(enrichedPendentes);

      const listaFaltantes: InsumoFaltante[] = [];
      const insumosIds = Object.keys(necessidadeInsumos);
      
      await Promise.all(insumosIds.map(async (idStr) => {
        const id = Number(idStr);
        const req = necessidadeInsumos[id];
        
        try {
          const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
          const rEst = await fetch(`/api/tiny/estoque/${id}`, { headers: { 'x-nexxo-store': store } });
          if (rEst.ok) {
            const dEst = await rEst.json();
            const internalStock = (dEst.depositos || []).filter((x: any) => 
              !x.nome?.toLowerCase().includes('full') && 
              !x.nome?.toLowerCase().includes('amazon') && 
              !x.nome?.toLowerCase().includes('shopee') && 
              !x.nome?.toLowerCase().includes('ml')
            ).reduce((acc: number, curr: any) => acc + curr.saldo, 0);
            
            if (internalStock < req.total) {
              const { data: inMeta } = await supabase.from('produtos').select('url_imagem').eq('id', id).maybeSingle();
              
              listaFaltantes.push({
                id,
                nome: req.nome,
                sku: req.sku,
                url_imagem: inMeta?.url_imagem,
                necessidade: req.total,
                estoque_meike: internalStock
              });
            }
          }
        } catch {}
      }));

      setInsumosFaltantes(listaFaltantes.sort((a, b) => (b.necessidade - b.estoque_meike) - (a.necessidade - a.estoque_meike)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-64 bg-white border border-slate-100 rounded-none animate-pulse flex flex-col p-4 gap-4">
          <div className="w-full h-32 bg-slate-50 rounded-xl" />
          <div className="h-4 bg-slate-50 rounded w-3/4" />
          <div className="h-4 bg-slate-50 rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-12">
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-3">
            <Package className="text-slate-400" size={32} />
            PRODUTOS À ENVIAR
            {pendentes.length > 0 && (
              <span className="text-xs font-bold text-white bg-slate-900 px-3 py-1 rounded-full tracking-widest ml-2">
                {pendentes.length}
              </span>
            )}
          </h2>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-none text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all hover:shadow-md disabled:opacity-40"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            ATUALIZAR ESTOQUES
          </button>
        </div>

        {pendentes.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-300 gap-4 bg-white border border-dashed border-slate-200 rounded-3xl">
            <Package size={64} strokeWidth={0.5} />
            <div className="text-center">
              <p className="text-lg font-black uppercase tracking-tight text-slate-400">Tudo limpo!</p>
              <p className="text-sm font-medium">Nenhum produto pendente de envio nesta remessa.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendentes.map(p => (
              <ProductCardEnvio key={`${p.id_produto_tiny}-${p.nome_produto}`} produto={p} />
            ))}
          </div>
        )}
      </section>

      {insumosFaltantes.length > 0 && (
        <section className="bg-red-50/30 border border-red-100 rounded-none p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-600 rounded-none flex items-center justify-center shadow-lg shadow-red-200">
                <AlertTriangle className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-red-600 leading-none">
                  ITENS SEM ESTOQUE
                </h2>
                <p className="text-red-400 text-sm font-bold uppercase tracking-widest mt-1">
                  Necessidade imediata para os kits desta remessa
                </p>
              </div>
            </div>
            <span className="text-sm font-black text-red-600 bg-red-100 px-4 py-2 rounded-none border border-red-200">
              {insumosFaltantes.length} INSUMO{insumosFaltantes.length !== 1 ? 'S' : ''} FALTANDO
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {insumosFaltantes.map(ins => (
              <div
                key={`insumo-${ins.id}`}
                className="group flex items-center gap-5 px-5 py-4 bg-white border border-red-100 rounded-none shadow-sm hover:border-red-400 transition-all hover:shadow-xl hover:-translate-y-1"
              >
                <div className="relative">
                  {ins.url_imagem ? (
                    <img src={ins.url_imagem} className="w-16 h-16 object-cover rounded-xl shrink-0 border border-slate-100 group-hover:scale-105 transition-transform" alt="" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-50 rounded-xl shrink-0 flex items-center justify-center border border-slate-100">
                      <Package size={24} className="text-slate-300" />
                    </div>
                  )}
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    !
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 truncate uppercase text-sm tracking-tight mb-0.5">{ins.nome}</p>
                  <p className="text-[10px] text-red-500 font-mono font-black bg-red-50 px-2 py-0.5 rounded-md inline-block">
                    {ins.sku}
                  </p>
                </div>

                <div className="text-right shrink-0 bg-red-50 px-4 py-2 rounded-none border border-red-100">
                  <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Faltam</p>
                  <p className="text-2xl font-black text-red-600 leading-none my-1">
                    {Math.ceil(ins.necessidade - ins.estoque_meike)}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">
                    Nec: {ins.necessidade}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── CONFIRM MODAL ───────────────────────────────────────────────────────────
function ConfirmModal({
  open, onConfirm, onCancel, title, description
}: { open: boolean; onConfirm: () => void; onCancel: () => void; title: string; description: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check size={20} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800">{title}</h3>
        </div>
        <p className="text-slate-600 text-sm mb-6">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm transition-colors"
          >
            Finalizar e Arquivar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── STATUS BUTTON (dropdown menu) ──────────────────────────────────────────
const STATUS_OPTIONS = [
  { key: 'pendente',  label: 'Em Andamento', dot: 'bg-yellow-400', text: 'text-yellow-700', bg: 'hover:bg-yellow-50' },
  { key: 'concluido', label: 'Finalizado',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'hover:bg-emerald-50' },
  { key: 'revisar',   label: 'Revisar Envio', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'hover:bg-red-50' },
] as const;

function StatusButton({ status, remessaId, onUpdated }: {
  status: string;
  remessaId: string;
  onUpdated: (id: string, newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const current = STATUS_OPTIONS.find(o => o.key === status?.toLowerCase())
    ?? STATUS_OPTIONS[0];

  const handleOptionClick = (key: string) => {
    setOpen(false);
    if (key === 'concluido') {
      setPendingStatus(key);
      setShowConfirm(true);
    } else {
      applyStatus(key);
    }
  };

  const applyStatus = async (newStatus: string) => {
    setSaving(true);
    try {
      await supabase.from('remessas_full').update({ status: newStatus }).eq('id', remessaId);
      onUpdated(remessaId, newStatus);
    } finally {
      setSaving(false);
      setShowConfirm(false);
      setPendingStatus(null);
    }
  };

  return (
    <>
      <ConfirmModal
        open={showConfirm}
        title="Finalizar e Arquivar Envio?"
        description="Este envio será marcado como Finalizado e movido para a aba Arquivados. Deseja continuar?"
        onConfirm={() => applyStatus(pendingStatus ?? 'concluido')}
        onCancel={() => { setShowConfirm(false); setPendingStatus(null); }}
      />

      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}

      <div className="relative inline-flex flex-col items-center gap-0.5">
        <button
          onClick={() => setOpen(o => !o)}
          disabled={saving}
          title="Alterar status"
          className={`w-5 h-5 rounded-full ${current.dot} ring-2 ring-transparent ring-offset-1 hover:ring-slate-300 transition-all hover:scale-125 active:scale-95 disabled:opacity-50 shadow-sm`}
        />
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight leading-none text-center whitespace-nowrap">
          {current.label}
        </span>

        {open && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[9999] bg-white border border-slate-900 rounded-none shadow-2xl w-44 py-0 overflow-hidden">
            <div className="px-3 pb-1.5 pt-2 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-0 bg-slate-50">
              Status
            </div>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => handleOptionClick(opt.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold transition-colors ${opt.bg} ${opt.key === status ? 'opacity-40 cursor-default' : ''}`}
              >
                <span className={`w-3 h-3 rounded-full shrink-0 ${opt.dot}`} />
                <span className={opt.text}>{opt.label}</span>
                {opt.key === status && <span className="ml-auto text-[9px] text-slate-400">atual</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── REMESSA TABLE ────────────────────────────────────────────────────────────
function RemessaTabela({
  remessas, onSelect, onStatusUpdate, loading
}: {
  remessas: Remessa[];
  onSelect: (id: string) => void;
  onStatusUpdate: (id: string, newStatus: string) => void;
  loading: boolean;
}) {
  if (loading) return <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>;
  if (!remessas.length) return <div className="p-8 text-center text-slate-400 text-sm">Nenhuma remessa encontrada.</div>;

  return (
    <table className="w-full text-left text-sm">
      <thead className="bg-[#1e212e] text-slate-400 font-semibold border-b border-slate-800">
        <tr>
          <th className="px-6 py-4">Plataforma</th>
          <th className="px-6 py-4">Nº Envio Meikê</th>
          <th className="px-6 py-4">Nº Envio MKTPLC</th>
          <th className="px-6 py-4">Status</th>
          <th className="px-6 py-4">Data</th>
          <th className="px-6 py-4 text-center">Unidades</th>
          <th className="px-6 py-4 text-center">Volume</th>
          <th className="px-6 py-4 text-right">Ação</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {remessas.map(r => {
          const badge = plataformaBadge(r.plataforma);
          return (
            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none text-[10px] font-black uppercase border ${badge.bg}`}>
                  <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
              </td>
              <td className="px-6 py-4">
                 <span className="bg-black text-white px-3 py-1 rounded-none text-[10px] font-black tracking-widest">
                    {r.sequencial ? String(r.sequencial).padStart(3, '0') : '---'}
                 </span>
              </td>
              <td className="px-6 py-4 font-mono text-black font-bold">#{r.numero_envio || '-'}</td>
              <td className="px-6 py-4 text-center">
                <StatusButton
                  status={r.status || 'pendente'}
                  remessaId={r.id}
                  onUpdated={onStatusUpdate}
                />
              </td>
              <td className="px-6 py-4 text-slate-400 text-xs font-bold uppercase">{fmtDate(r.data_envio)}</td>
              <td className="px-6 py-4 font-black text-black text-lg">{r.volume_total || '0'}</td>
              <td className="px-6 py-4 text-slate-400 font-bold">{r.volume_caixas || '0'}</td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => onSelect(r.id)} className="p-2 text-black hover:bg-black hover:text-white rounded-none transition-all">
                  <ArrowRight size={18} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function RemessaFullList({ onSelect }: { onSelect: (id: string | 'new') => void }) {
  const [remessas, setRemessas] = useState<Remessa[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('Todas');

  useEffect(() => { loadRemessas(); }, []);

  const loadRemessas = async () => {
    try {
      const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
      let query = supabase
        .from('remessas_full')
        .select('*');
      
      if (store === 'ONN') {
        query = query.eq('unidade', 'ONN');
      } else {
        // Para MEIKE, trazemos 'MEIKE' ou registros antigos (null)
        query = query.or(`unidade.eq.MEIKE,unidade.is.null`);
      }

      const { data, error } = await query.order('data_envio', { ascending: true });
      if (error) throw error;
      setRemessas(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRemessas = remessas.filter(r => {
    const archived = ARCHIVED.includes((r.status || '').toLowerCase());
    if (activeTab === 'Arquivados') return archived;
    if (archived) return false;
    if (activeTab === 'Todas') return true;
    return r.plataforma === activeTab;
  });

  const handleStatusUpdate = useCallback((id: string, newStatus: string) => {
    setRemessas(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  }, []);

  const activeRemessas = remessas.filter(r => !ARCHIVED.includes((r.status || '').toLowerCase()));

  return (
    <div className="flex-1 bg-white">
      <div className="max-w-6xl mx-auto px-8 py-12 space-y-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Controle Envios Full</h1>
            <p className="text-slate-500 text-sm">Gerencie remessas para Mercado Livre e Shopee.</p>
          </div>
          <button onClick={() => onSelect('new')} className="bg-black text-white px-6 py-3 rounded-none font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95">
            <Plus size={16} /> Nova Remessa
          </button>
        </div>

        <div className="bg-white border border-slate-100 overflow-hidden shadow-sm">
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-black bg-white' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab}
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
              </button>
            ))}
          </div>
          <RemessaTabela remessas={filteredRemessas} onSelect={onSelect} onStatusUpdate={handleStatusUpdate} loading={loading} />
        </div>

        <CalendarioEnvios remessas={activeRemessas} />
        <ProdutosAEnviar />
      </div>
    </div>
  );
}
