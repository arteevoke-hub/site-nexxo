import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Plus, 
  Printer, 
  Clock, 
  Hash, 
  Package, 
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ItemRemessa {
  id: string;
  remessa_id: string;
  produto_id: string;
  qtd_enviar: number;
  qtd_feitos?: number;
  qtd_falta?: number;
  check_pronto?: boolean;
  sku_tiny_snapshot?: string;
  sku_marketplace_snapshot?: string;
  produtos?: {
    nome: string;
    sku: string;
    url_imagem: string;
    id_tiny: string;
  };
}

interface Remessa {
  id: string;
  numero_envio: string;
  plataforma: string;
  status: string;
  data_envio: string;
  horario_coleta: string;
  volume_caixas: number;
  unidade: string;
  folder_link?: string;
  calendar_link?: string;
  sequencial?: number;
}

interface Props {
  id: string;
  onBack: () => void;
}

export function RemessaFullDetail({ id, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [integrating, setIntegrating] = useState(false);
  const [integratingStep, setIntegratingStep] = useState('');
  const [remessa, setRemessa] = useState<Partial<Remessa>>({
    numero_envio: '',
    plataforma: 'MERCADO LIVRE',
    status: 'pendente',
    data_envio: new Date().toISOString().split('T')[0],
    horario_coleta: '20:00',
    volume_caixas: 1,
    unidade: localStorage.getItem('nexxo_selected_store') || 'MEIKE'
  });
  const [itens, setItens] = useState<ItemRemessa[]>([]);

  useEffect(() => {
    if (id !== 'new') {
      loadData();
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadData = async () => {
    try {
      const { data: rData, error: rErr } = await supabase.from('remessas_full').select('*').eq('id', id).single();
      if (rErr) throw rErr;
      setRemessa(rData);

      const { data: iData, error: iErr } = await supabase.from('remessa_full_itens').select('*, produtos(*)').eq('remessa_id', id);
      if (iErr) throw iErr;
      setItens(iData || []);
    } catch (err: any) {
      console.error('Erro ao carregar:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIntegrating(true);
      setIntegratingStep('Salvando dados...');

      let finalId = id;
      if (id === 'new') {
        const { data, error } = await supabase.from('remessas_full').insert([remessa]).select().single();
        if (error) throw error;
        finalId = data.id;
      } else {
        const { error } = await supabase.from('remessas_full').update(remessa).eq('id', id);
        if (error) throw error;
      }

      setIntegratingStep('Integrando com Google Drive & Agenda...');
      const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
      const res = await fetch(`/api/ml/integrate/${finalId}`, {
        method: 'POST',
        headers: { 'x-nexxo-store': store }
      });
      const resData = await res.json();
      
      if (!res.ok) throw new Error(resData.error || 'Erro na integração');

      setIntegratingStep('Finalizado!');
      setTimeout(() => {
        setIntegrating(false);
        loadData();
      }, 1500);
    } catch (err: any) {
      alert('Erro ao integrar: ' + err.message);
      setIntegrating(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Excluir item?')) return;
    try {
      await supabase.from('remessa_full_itens').delete().eq('id', itemId);
      setItens(prev => prev.filter(i => i.id !== itemId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-12 text-center font-black animate-pulse uppercase tracking-[0.3em]">Carregando Arquivos...</div>;

  const isML = remessa.plataforma?.includes('MERCADO');
  const isShopee = remessa.plataforma?.includes('SHOPEE');

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA]">
      {/* Header Fixo */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4 no-print sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 transition-all rounded-none border border-transparent hover:border-slate-300">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none">
              {id === 'new' ? 'Nova Remessa' : `Remessa #${remessa.sequencial || '...'}`}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Industrial Dispatch Interface V4.0</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 md:px-6 py-3 bg-white border-2 border-slate-900 text-slate-900 font-black text-xs md:text-sm uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-md active:scale-95"
          >
            <Printer size={18} /> <span className="hidden md:inline">Imprimir PDF</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={integrating}
            className="flex items-center gap-2 px-4 md:px-8 py-3 bg-slate-900 text-white font-black text-xs md:text-sm uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {integrating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{integratingStep}</span>
              </>
            ) : (
              <>
                <Save size={18} /> <span>Salvar & Integrar</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-[1200px] mx-auto space-y-6 md:space-y-8">
          
          {/* Informações Principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-4 md:p-6 shadow-sm border border-slate-200">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nº Envio Marketplace</label>
              <div className="flex items-center gap-3">
                <Hash className="text-slate-300" size={24} />
                <input 
                  type="text" 
                  value={remessa.numero_envio} 
                  onChange={(e) => setRemessa({...remessa, numero_envio: e.target.value})}
                  className="text-xl md:text-2xl font-black w-full outline-none text-slate-900"
                  placeholder="000000"
                />
              </div>
            </div>

            <div className="bg-white p-4 md:p-6 shadow-sm border border-slate-200">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Data de Envio</label>
              <div className="flex items-center gap-3">
                <Clock className="text-slate-300" size={24} />
                <input 
                  type="date" 
                  value={remessa.data_envio} 
                  onChange={(e) => setRemessa({...remessa, data_envio: e.target.value})}
                  className="text-xl font-black w-full outline-none text-slate-900 bg-transparent"
                />
              </div>
            </div>

            <div className="bg-white p-4 md:p-6 shadow-sm border border-slate-200">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Volumes</label>
              <div className="flex items-center gap-3">
                <Package className="text-slate-300" size={24} />
                <input 
                  type="number" 
                  value={remessa.volume_caixas} 
                  onChange={(e) => setRemessa({...remessa, volume_caixas: parseInt(e.target.value)})}
                  className="text-2xl font-black w-full outline-none text-slate-900"
                />
              </div>
            </div>

            <div className="bg-white p-4 md:p-6 shadow-sm border border-slate-200">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Plataforma</label>
              <select 
                value={remessa.plataforma}
                onChange={(e) => setRemessa({...remessa, plataforma: e.target.value})}
                className="text-lg font-black w-full outline-none text-slate-900 bg-transparent uppercase"
              >
                <option value="MERCADO LIVRE">MERCADO LIVRE</option>
                <option value="SHOPEE">SHOPEE</option>
                <option value="AMAZON">AMAZON</option>
              </select>
            </div>
          </div>

          {/* Links de Integração (Mobile Friendly) */}
          {(remessa.folder_link || remessa.calendar_link) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
              {remessa.folder_link && (
                <a href={remessa.folder_link} target="_blank" className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500 flex items-center justify-center text-white"><ExternalLink size={20}/></div>
                    <span className="text-xs font-black text-indigo-900 uppercase">Acessar Pasta Google Drive</span>
                  </div>
                  <ChevronRight className="text-indigo-400" />
                </a>
              )}
              {remessa.calendar_link && (
                <a href={remessa.calendar_link} target="_blank" className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 flex items-center justify-center text-white"><ExternalLink size={20}/></div>
                    <span className="text-xs font-black text-emerald-900 uppercase">Evento no Calendário</span>
                  </div>
                  <ChevronRight className="text-emerald-400" />
                </a>
              )}
            </div>
          )}

          {/* Lista de Produtos - TABLE FOR DESKTOP / CARDS FOR MOBILE */}
          <div className="bg-white border border-slate-200 shadow-xl">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter">Itens da Remessa</h3>
              <span className="text-[10px] font-bold bg-slate-100 px-3 py-1 text-slate-500 rounded-full">{itens.length} SKU(s)</span>
            </div>

            <div className="p-0">
              {/* Desktop Table Header */}
              <div className="hidden md:grid grid-cols-9 gap-4 bg-slate-50 text-[10px] font-black text-slate-500 border-b border-slate-200 py-3 px-6 uppercase tracking-widest">
                <div className="col-span-1">IMG</div>
                <div className="col-span-2">Descrição / Código</div>
                <div className="col-span-1">SKU</div>
                <div className="text-center">À ENVIAR</div>
                <div className="text-center">FEITOS</div>
                <div className="text-center">FALTA</div>
                <div className="text-center">CHECK</div>
                <div className="text-center no-print">AÇÃO</div>
              </div>

              <div className="divide-y divide-slate-100">
                {itens.map((item) => (
                  <div key={item.id} className="group">
                    {/* MOBILE CARD VIEW */}
                    <div className="md:hidden p-4 space-y-4">
                      <div className="flex gap-4">
                        <img src={item.produtos?.url_imagem} className="w-16 h-16 object-cover border border-slate-200" alt="" />
                        <div className="flex-1">
                          <h4 className="text-[10px] font-black uppercase leading-tight">{item.produtos?.nome}</h4>
                          <p className="text-[9px] font-bold text-orange-600 mt-1">SKU: {item.sku_tiny_snapshot || item.produtos?.sku}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 p-2 text-center border border-slate-200">
                          <p className="text-[7px] font-black text-slate-400 uppercase">Enviar</p>
                          <p className="text-lg font-black">{item.qtd_enviar}</p>
                        </div>
                        <div className="bg-slate-50 p-2 text-center border border-slate-200">
                          <p className="text-[7px] font-black text-slate-400 uppercase">Feitos</p>
                          <input type="text" defaultValue={item.qtd_feitos} className="w-full text-center bg-transparent font-black text-lg text-emerald-600 outline-none" />
                        </div>
                        <div className="bg-slate-50 p-2 text-center border border-slate-200">
                          <p className="text-[7px] font-black text-slate-400 uppercase">Falta</p>
                          <input type="text" defaultValue={item.qtd_falta} className="w-full text-center bg-transparent font-black text-lg text-rose-600 outline-none" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 no-print">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" className="w-6 h-6 border-2 border-slate-300 rounded-none text-black focus:ring-black" />
                          <span className="text-[10px] font-black text-slate-500">PRONTO</span>
                        </div>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-rose-500 p-2"><Trash2 size={18}/></button>
                      </div>
                    </div>

                    {/* DESKTOP TABLE ROW */}
                    <div className="hidden md:grid grid-cols-9 gap-4 items-center py-4 px-6 hover:bg-slate-50 transition-all">
                      <div className="col-span-1">
                        <img src={item.produtos?.url_imagem} className="w-12 h-12 object-cover border-2 border-slate-200" alt="" />
                      </div>
                      <div className="col-span-2">
                        <h4 className="text-[11px] font-black uppercase leading-tight text-slate-900">{item.produtos?.nome}</h4>
                        <p className="text-[9px] text-slate-400 mt-1">ID: {item.produtos?.id_tiny}</p>
                      </div>
                      <div className="col-span-1 text-[10px] font-black text-orange-600">{item.sku_tiny_snapshot || item.produtos?.sku}</div>
                      <div className="text-center text-xl font-black text-slate-900">{item.qtd_enviar}</div>
                      <div className="text-center">
                        <input type="text" defaultValue={item.qtd_feitos} className="w-10 h-10 border-2 border-slate-200 rounded-none text-center font-black text-lg outline-none focus:border-black" />
                      </div>
                      <div className="text-center">
                        <input type="text" defaultValue={item.qtd_falta} className="w-10 h-10 border-2 border-slate-200 rounded-none text-center font-black text-lg text-rose-600 outline-none focus:border-rose-600" />
                      </div>
                      <div className="flex justify-center">
                        <input type="checkbox" className="w-6 h-6 border-2 border-slate-300 rounded-none text-black focus:ring-black cursor-pointer" />
                      </div>
                      <div className="text-center no-print">
                        <button onClick={() => handleDeleteItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rodapé de Assinatura (Apenas Impressão) */}
          <div className="hidden print:flex justify-between items-end mt-20 pt-10">
            <div className="w-64 border-t-2 border-black pt-2">
              <p className="text-[10px] font-black uppercase">Responsável Expedição</p>
            </div>
            <div className="w-64 border-t-2 border-black pt-2 text-right">
              <p className="text-[10px] font-black uppercase">Assinatura Motorista</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
