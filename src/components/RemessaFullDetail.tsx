import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Printer, Save, PackageSearch, Plus, FileText, RefreshCw, Camera, Loader2, Box, Calendar, Trash2, FileUp } from 'lucide-react';

// Função para extrair apenas o Título Pai (antes do primeiro hífen)
const extractParentTitle = (fullTitle: string) => {
  if (!fullTitle) return "PRODUTO SEM TÍTULO";
  // Divide a string no " - " e pega a primeira parte, removendo espaços extras
  return fullTitle.split(' - ')[0].trim(); 
};

interface RemessaFullDetailProps {
  id: string;
  onBack: () => void;
}

export function RemessaFullDetail({ id, onBack }: RemessaFullDetailProps) {
  const isNew = id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [integrating, setIntegrating] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [remessa, setRemessa] = useState<any>({
    plataforma: 'MERCADO LIVRE',
    numero_envio: '',
    unidade: '',
    codigo_coleta: '',
    volume_total: '',
    volume_caixas: '',
    motorista: '',
    placa: '',
    data_envio: new Date().toISOString().split('T')[0],
    horario_coleta: '',
    check_etiqueta_volume: false,
    check_nota_fiscal: false,
    check_autorizacao: false,
    check_foto_video: false
  });
  const [itens, setItens] = useState<any[]>([]);
  const [sequencial, setSequencial] = useState<number | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<any[]>([]);
  
  const isML = remessa.plataforma === 'MERCADO LIVRE';
  const isShopee = remessa.plataforma === 'SHOPEE';
  const isAmazon = remessa.plataforma === 'AMAZON';

  useEffect(() => {
    if (!isNew) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: rem, error: errRem } = await supabase.from('remessas_full').select('*').eq('id', id).single();
      if (errRem) throw errRem;
      setRemessa(rem);

      const { data: its, error: errIts } = await supabase
        .from('remessa_itens')
        .select('*, produtos(*)')
        .eq('id_remessa', id)
        .order('ordem');
      if (errIts) throw errIts;

      const loadedItens = its || [];

      // Passo Extra: Garantir que os SKUs de marketplace sejam carregados (evitando falhas de join complexo)
      const prodIds = loadedItens.map(i => i.id_produto_tiny).filter(Boolean);
      if (prodIds.length > 0) {
        const { data: mappings } = await supabase
          .from('skus_marketplace')
          .select('*')
          .in('id_produto_tiny', prodIds);
        
        if (mappings && mappings.length > 0) {
          const mappedItens = loadedItens.map(item => {
            const mapping = mappings.find(m => String(m.id_produto_tiny) === String(item.id_produto_tiny));
            if (mapping) {
              return {
                ...item,
                produtos: {
                  ...(item.produtos || {}),
                  skus_marketplace: [mapping]
                }
              };
            }
            return item;
          });
          setItens(mappedItens);
        } else {
          setItens(loadedItens);
        }
      } else {
        setItens(loadedItens);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showAddModal && searchTerm === '') {
      handleSearchProduct();
    }
  }, [showAddModal]);

  const handleDeleteRow = async (itemId: any) => {
    if (confirm('Deseja realmente excluir este item da remessa?')) {
      if (typeof itemId === 'number' || !itemId.toString().startsWith('temp-')) {
        try {
          const { error } = await supabase.from('remessa_itens').delete().eq('id', itemId);
          if (error) throw error;
        } catch (err) {
          console.error('Erro ao excluir do banco:', err);
          alert('Erro ao excluir item do banco de dados.');
          return;
        }
      }
      setItens(itens.filter(i => i.id !== itemId));
    }
  };

  const handleAddProduct = (prod: any) => {
    const isAlreadyIn = itens.find(i => i.id_produto_tiny === prod.id);
    if (isAlreadyIn) {
      alert('Este produto já está na remessa!');
      return;
    }

    const sm = prod.skus_marketplace?.[0] || {};
    const skuMarketplace = isML ? sm.sku_mercadolivre : isShopee ? sm.sku_shopee : sm.sku_amazon;

    const newItem = {
      id: `temp-${Date.now()}`,
      id_produto_tiny: prod.id,
      grupo_nome: prod.nome,
      sku_tiny_snapshot: prod.sku,
      sku_marketplace_snapshot: skuMarketplace,
      qtd_enviar: 1,
      produtos: prod
    };

    setItens([...itens, newItem]);
    setShowAddModal(false);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingPdf(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('/api/ml/parse-pdf', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) throw new Error('Erro ao processar PDF');
      
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const newItensList = [...itens];
        for (const pdfItem of data.items) {
           const { data: prodData } = await supabase.from('produtos').select('*, skus_marketplace(*)').eq('sku', pdfItem.sku).single();
           if (prodData) {
             const isAlreadyIn = newItensList.find(i => i.id_produto_tiny === prodData.id);
             if (!isAlreadyIn) {
               const sm = prodData.skus_marketplace?.[0] || {};
               const skuMarketplace = isML ? sm.sku_mercadolivre : isShopee ? sm.sku_shopee : sm.sku_amazon;
               newItensList.push({
                 id: `temp-${Date.now()}-${pdfItem.sku}`,
                 id_produto_tiny: prodData.id,
                 grupo_nome: prodData.nome,
                 sku_tiny_snapshot: prodData.sku,
                 sku_marketplace_snapshot: skuMarketplace,
                 qtd_enviar: pdfItem.quantity,
                 produtos: prodData
               });
             }
           }
        }
        setItens(newItensList);
        alert(`${data.items.length} SKUs identificados no PDF.`);
      } else {
        alert('Nenhum item identificado no PDF.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao ler PDF. Verifique o formato do arquivo.');
    } finally {
      setParsingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleSearchProduct = async () => {
    // Busca apenas produtos acabados (que COMECEM com * no nome no Tiny)
    let query = supabase
      .from('produtos')
      .select('id, nome, sku, url_imagem, tipo, skus_marketplace(sku_mercadolivre, sku_shopee, sku_amazon)')
      .like('nome', '*%'); // Rigoroso: Começa com asterisco

    const term = searchTerm.trim().replace(/^\*/, '');
    if (term) {
      query = query.or(`nome.ilike.*%${term}%,sku.ilike.%${term}%`);
    }

    const { data, error } = await query.limit(40);
    
    if (error) {
      console.error('Erro na busca:', error);
      return;
    }

    if (data && data.length > 0) {
      // Passo Extra: Garantir SKUs no resultado da busca
      const prodIds = data.map(p => p.id);
      const { data: mappings } = await supabase
        .from('skus_marketplace')
        .select('*')
        .in('id_produto_tiny', prodIds);

      const enrichedData = data.map(prod => {
        const mapping = mappings?.find(m => String(m.id_produto_tiny) === String(prod.id));
        return {
          ...prod,
          skus_marketplace: mapping ? [mapping] : []
        };
      });
      setSearchResult(enrichedData);
    } else {
      setSearchResult([]);
    }
  };



  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !remessa.id) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('id_remessa', remessa.id);

    try {
      const res = await fetch('/api/google/upload-file', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Falha no upload');
      
      const data = await res.json();
      alert('Foto/Vídeo enviado com sucesso para o Google Drive!');
      setRemessa((prev: any) => ({ ...prev, check_foto_video: true }));
      
      // Salva a remessa para persistir o check
      await supabase.from('remessas_full').update({ check_foto_video: true }).eq('id', remessa.id);
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar arquivo para o Google Drive.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
      const remessaWithUnit = { ...remessa, unidade: store };
      
      if (isNew) {
        const { data: newRem, error: errRem } = await supabase.from('remessas_full').insert([remessaWithUnit]).select().single();
        if (errRem) throw errRem;
        
        // Save items
        const itensToSave = itens.map(i => ({
          id_remessa: newRem.id,
          id_produto_tiny: i.id_produto_tiny,
          grupo_nome: i.grupo_nome,
          sku_tiny_snapshot: i.sku_tiny_snapshot,
          sku_marketplace_snapshot: i.sku_marketplace_snapshot,
          qtd_enviar: i.qtd_enviar
        }));
        if (itensToSave.length > 0) {
          await supabase.from('remessa_itens').insert(itensToSave);
        }
        alert('Remessa criada com sucesso!');
        await handleIntegrate(newRem.id); // Automático
        onBack();
      } else {
        const { error } = await supabase.from('remessas_full').update(remessa).eq('id', id);
        if (error) throw error;
        // Basic MVP logic for saving items (only new ones for now)
        const newItens = itens.filter(i => String(i.id).startsWith('temp-')).map(i => ({
          id_remessa: id,
          id_produto_tiny: i.id_produto_tiny,
          grupo_nome: i.grupo_nome,
          sku_tiny_snapshot: i.sku_tiny_snapshot,
          sku_marketplace_snapshot: i.sku_marketplace_snapshot,
          qtd_enviar: i.qtd_enviar
        }));
        if (newItens.length > 0) {
          await supabase.from('remessa_itens').insert(newItens);
        }
        alert('Salvo com sucesso!');
        await handleIntegrate(id); // Automático
        loadData();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIntegrate = async (idToUse?: string) => {
    const finalId = idToUse || id;
    if (finalId === 'new') {
      console.log("Ignorando integração automática para 'new' temporariamente até ter o ID.");
      return;
    }
    
    // Antes de integrar, GARANTE que a remessa está salva com os dados atuais da tela (como o sequencial editado)
    setIsSaving(true);
    try {
      const { error: saveErr } = await supabase.from('remessas_full').update(remessa).eq('id', finalId);
      if (saveErr) throw saveErr;
    } catch (err) {
      console.error("Erro ao salvar antes de integrar:", err);
      // Prossegue mesmo assim, mas avisa
    } finally {
      setIsSaving(false);
    }

    setIntegrating(true);
    try {
      const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
      const res = await fetch(`/api/ml/integrate/${finalId}`, { 
        method: 'POST',
        headers: {
          'x-nexxo-store': store
        }
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro na integração');
        alert(data.message + (data.warning ? '\n\n' + data.warning : ''));
        loadData();
      } else {
        const text = await res.text();
        console.error('Resposta não-JSON:', text);
        alert('Erro no servidor (não retornou JSON). Verifique o console do backend.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao integrar: ' + err.message);
    } finally {
      setIntegrating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };





  return (
    <div className="flex-1 bg-slate-200 h-screen overflow-hidden flex no-print">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { 
            box-shadow: none !important; 
            margin: 0 !important; 
            width: 100% !important;
            height: auto !important;
          }
          body { background: white !important; }
          .quebrar-pagina { page-break-before: always; }
        }
      `}</style>

      {/* Modal Adicionar Produto */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center no-print p-4">
          <div className="bg-white border border-black rounded-none shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-xl font-black text-black uppercase tracking-tighter">Adicionar Produto</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Selecione um produto acabado para o envio</p>
              </div>
              <button 
                onClick={() => { setShowAddModal(false); setSearchResult([]); setSearchTerm(''); }} 
                className="w-10 h-10 flex items-center justify-center hover:bg-black hover:text-white transition-colors text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Barra de Busca */}
            <div className="p-6 bg-white border-b border-slate-100">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <PackageSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="BUSCAR POR NOME OU SKU..."
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-200 focus:border-black rounded-none pl-12 pr-4 py-3.5 text-black font-bold placeholder-slate-300 outline-none transition-all text-xs uppercase"
                    onKeyDown={e => e.key === 'Enter' && handleSearchProduct()}
                  />
                </div>
                <button 
                  onClick={handleSearchProduct} 
                  className="bg-black hover:bg-slate-800 text-white px-8 py-3.5 rounded-none font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                >
                  Buscar
                </button>
              </div>
            </div>

            {/* Resultados em Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
              {!searchResult || searchResult.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                   <PackageSearch size={64} strokeWidth={1} className="mb-4 opacity-20" />
                   <p className="font-bold uppercase tracking-widest text-sm">Nenhum produto encontrado...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResult.map(prod => {
                    const sm = prod.skus_marketplace?.[0] || {};
                    return (
                      <div 
                        key={prod.id} 
                        className="group bg-white border border-slate-200 p-4 rounded-none flex gap-4 hover:border-black hover:shadow-xl transition-all cursor-pointer relative"
                        onClick={() => handleAddProduct(prod)}
                      >
                        <div className="w-20 h-20 bg-slate-50 rounded-none overflow-hidden border border-slate-100 shrink-0">
                          {prod.url_imagem ? (
                            <img src={prod.url_imagem} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-200"><Box size={32} /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-slate-800 uppercase line-clamp-1 group-hover:text-black transition-colors">{prod.nome}</h4>
                          <p className="text-[10px] text-orange-500 font-mono font-bold mb-2">SKU TINY: {prod.sku}</p>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {sm.sku_mercadolivre && (
                              <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded text-[9px] font-black">
                                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span> ML: {sm.sku_mercadolivre}
                              </div>
                            )}
                            {sm.sku_shopee && (
                              <div className="flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded text-[9px] font-black">
                                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span> SHP: {sm.sku_shopee}
                              </div>
                            )}
                            {sm.sku_amazon && (
                              <div className="flex items-center gap-1 bg-slate-50 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-black">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> AMZ: {sm.sku_amazon}
                              </div>
                            )}
                            {!sm.sku_mercadolivre && !sm.sku_shopee && !sm.sku_amazon && (
                              <span className="text-[9px] text-slate-400 font-bold italic">Sem SKUs vinculados</span>
                            )}
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                           <div className="bg-black text-white p-1.5 rounded-none shadow-lg">
                              <Plus size={16} />
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Total de {searchResult.length} produtos encontrados
            </div>
          </div>
        </div>
      )}

      {/* ÁREA DA PRANCHETA (CENTRAL) */}
      <div className="flex-1 overflow-auto p-8 flex justify-center bg-slate-300/50 no-print-bg">
        <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print-area relative flex flex-col">
          
          {/* Top Bar Colorida */}
          <div className="h-6 w-full flex">
            {isML ? (
              <>
                <div className="h-full bg-[#fce904] flex-1"></div>
                <div className="h-full bg-[#4ba85c] w-32"></div>
              </>
            ) : isShopee ? (
              <div className="h-full bg-[#ee4d2d] flex-1"></div>
            ) : (
              <div className="h-full bg-[#232f3e] flex-1"></div> // Amazon
            )}
          </div>

          <div className="p-10 pt-12 text-slate-800 flex-1">
            {/* HEADER DO PDF */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-black tracking-tighter text-slate-700">Controle <br/><span className="text-slate-900">Envios</span></h1>
                {isML ? (
                  <div className="flex items-center gap-2">
                     <span className="text-4xl font-black italic text-[#f58421]">Full</span>
                     <span className="text-3xl font-black text-[#f58421]">⚡</span>
                  </div>
                ) : isShopee ? (
                  <span className="text-4xl font-black italic text-[#ee4d2d]">Shopee</span>
                ) : (
                  <span className="text-4xl font-black italic text-[#232f3e]">Amazon</span>
                )}
              </div>

              {isML && (
                <div className="flex items-center gap-2 h-16">
                   <img src="https://http2.mlstatic.com/static/org-img/homes-img/mercado-livre-logo-m.png" alt="Mercado Livre" className="h-10 object-contain mix-blend-multiply" />
                   <div className="w-16 h-16 bg-[#4ba85c] text-white font-black text-3xl flex items-center justify-center rounded-sm ml-4">
                    <input 
                      type="number" 
                      value={remessa.sequencial || ''} 
                      onChange={e => setRemessa({...remessa, sequencial: parseInt(e.target.value) || 0})}
                      className="bg-transparent w-full text-center focus:outline-none"
                    />
                   </div>
                </div>
              )}
              {isShopee && (
                <div className="flex items-center gap-4">
                  <img src="https://logodownload.org/wp-content/uploads/2021/03/shopee-logo-1.png" alt="Shopee" className="h-10 object-contain mix-blend-multiply" />
                  <div className="w-16 h-16 bg-[#ee4d2d] text-white font-black text-2xl flex items-center justify-center rounded-none">
                    S<input 
                      type="number" 
                      value={remessa.sequencial || ''} 
                      onChange={e => setRemessa({...remessa, sequencial: parseInt(e.target.value) || 0})}
                      className="bg-transparent w-10 text-center focus:outline-none"
                    />
                  </div>
                </div>
              )}
              {isAmazon && (
                <div className="flex items-center gap-4">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" alt="Amazon" className="h-6 object-contain mix-blend-multiply" />
                  <div className="w-16 h-16 bg-[#232f3e] text-white font-black text-2xl flex items-center justify-center rounded-none">
                    A<input 
                      type="number" 
                      value={remessa.sequencial || ''} 
                      onChange={e => setRemessa({...remessa, sequencial: parseInt(e.target.value) || 0})}
                      className="bg-transparent w-10 text-center focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-6 text-[11px] font-bold uppercase border-b-2 border-slate-300 pb-4 mb-8">
              <div className="space-y-4">
                <div>
                <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                  <Calendar size={10} className="text-slate-400"/> DATA ENVIO
                </div>
                <div className="flex items-center gap-2 border-b border-slate-300">
                  <input type="date" value={remessa.data_envio} onChange={e => setRemessa({...remessa, data_envio: e.target.value})} className="text-2xl font-black w-full focus:border-black p-0 rounded-none bg-transparent outline-none"/>
                  <RefreshCw size={20} className="text-slate-300"/>
                </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">HORÁRIO {isML ? 'COLETA' : 'AGENDADO'}</div>
                  <div className="flex items-center text-lg font-black border-b border-slate-300">
                    <input type="text" value={remessa.horario_coleta} onChange={e => setRemessa({...remessa, horario_coleta: e.target.value})} className="w-full text-center bg-transparent focus:outline-none"/>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[9px] text-slate-500 mb-1 font-black leading-none truncate w-full">
                    {isML ? 'NÚMERO DO ENVIO' : isShopee ? 'Nº ENVIO SHOPEE' : 'ID REMESSA AMZ'}
                  </div>
                  <input type="text" value={remessa.numero_envio} onChange={e => setRemessa({...remessa, numero_envio: e.target.value})} className="text-lg font-bold w-full border-b border-slate-300 focus:outline-none bg-transparent"/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">UNIDADE</div>
                    <input type="text" value={remessa.unidade} onChange={e => setRemessa({...remessa, unidade: e.target.value})} className="text-lg font-bold w-full border-b border-slate-300 focus:outline-none bg-transparent"/>
                  </div>
                  {(isML || isAmazon) && (
                    <div>
                      <div className="text-[10px] text-slate-500 mb-1">{isML ? 'CÓDIGO COLETA' : 'REF. AMAZON'}</div>
                      <input type="text" value={remessa.codigo_coleta} onChange={e => setRemessa({...remessa, codigo_coleta: e.target.value})} className="text-lg font-bold w-full border-b border-slate-300 focus:outline-none bg-transparent"/>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">UNIDADES</div>
                    <input type="text" value={remessa.volume_total} onChange={e => setRemessa({...remessa, volume_total: e.target.value})} className="text-2xl font-black text-black w-full border-b border-slate-300 focus:outline-none bg-transparent text-center h-8"/>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">VOLUME (CAIXAS)</div>
                    <input type="text" value={remessa.volume_caixas} onChange={e => setRemessa({...remessa, volume_caixas: e.target.value})} className="text-2xl font-black text-black w-full border-b border-slate-300 focus:outline-none bg-transparent text-center h-8"/>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[9px] text-slate-500">RETIRADA <br/> MOTORISTA</span>
                    <input type="text" value={remessa.motorista} onChange={e => setRemessa({...remessa, motorista: e.target.value})} className="flex-1 border-b border-slate-300 focus:outline-none bg-transparent"/>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[9px] text-slate-500">PLACA</span>
                    <input type="text" value={remessa.placa} onChange={e => setRemessa({...remessa, placa: e.target.value})} className="flex-1 border-b border-slate-300 focus:outline-none bg-transparent"/>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-2 rounded-none border border-slate-200">
                <div className="text-[10px] text-slate-700 mb-2 font-black">IMPRESSÃO</div>
                <div className="space-y-1.5 text-[9px] font-semibold text-slate-600">
                  <label className="flex items-center justify-between cursor-pointer">
                    ETIQUETA VOLUME
                    <input type="checkbox" checked={remessa.check_etiqueta_volume} onChange={e => setRemessa({...remessa, check_etiqueta_volume: e.target.checked})} className="w-4 h-4 text-black rounded-none border-slate-300"/>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    NOTA FISCAL
                    <input type="checkbox" checked={remessa.check_nota_fiscal} onChange={e => setRemessa({...remessa, check_nota_fiscal: e.target.checked})} className="w-4 h-4 text-black rounded-none border-slate-300"/>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    AUTORIZAÇÃO ENTRADA
                    <input type="checkbox" checked={remessa.check_autorizacao} onChange={e => setRemessa({...remessa, check_autorizacao: e.target.checked})} className="w-4 h-4 text-black rounded-none border-slate-300"/>
                  </label>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      FOTO/VÍDEO DAS CAIXAS
                      <input type="checkbox" checked={remessa.check_foto_video} onChange={e => setRemessa({...remessa, check_foto_video: e.target.checked})} className="w-3.5 h-3.5 text-black rounded-none border-slate-300"/>
                    </label>
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isUploading || !remessa.id}
                      className="text-[7px] bg-slate-900 hover:bg-slate-700 text-white px-1.5 py-0.5 rounded-full transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      {isUploading ? <Loader2 size={8} className="animate-spin" /> : <Camera size={8} />}
                      {isUploading ? 'ENVIANDO...' : 'ABRIR CÂMERA'}
                    </button>
                    <input type="file" accept="image/*,video/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-10">
              
              {Object.entries(
                itens
                  .filter((item) => {
                    const nome = item.produtos?.nome || item.grupo_nome || '';
                    return nome.startsWith('*') && (item.qtd_enviar > 0);
                  })
                  .reduce((acc, item) => {
                    const nomeBase = item.produtos?.nome || item.grupo_nome || 'SEM TÍTULO';
                    const group = extractParentTitle(nomeBase);
                    if (!acc[group]) acc[group] = [];
                    acc[group].push(item);
                    return acc;
                  }, {} as Record<string, any[]>)
              ).map(([parentTitle, variations]) => (
                <div key={parentTitle} className={`grupo-produto flex flex-col w-full mb-8 ${parentTitle.includes('PINK 01') ? 'quebrar-pagina' : ''}`}>
                  
                  <div className="w-full bg-[#8A4958] text-white font-black uppercase py-2.5 px-8 rounded-none mb-4 shadow-md tracking-widest text-sm flex justify-between items-center">
                    <span>{parentTitle}</span>
                    <span className="text-[10px] opacity-70">GRUPO DE ENVIO</span>
                  </div>

                  <div className="grid grid-cols-9 gap-4 text-[10px] font-black text-slate-500 border-b-2 border-slate-200 pb-2 mb-2 px-4 uppercase tracking-tighter">
                     <div className="col-span-1">KIT</div>
                     <div className="col-span-2 text-left">cod ML / Descrição</div>
                     <div className="col-span-1">SKU</div>
                     <div className="text-center">À ENVIAR</div>
                     <div className="text-center">FEITOS</div>
                     <div className="text-center">FALTA</div>
                     <div className="text-center">CHECK</div>
                     <div className="text-center no-print">AÇÃO</div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {variations.map((item, index) => {
                      const produto = item.produtos || {};
                      const skuMarketplace = produto.skus_marketplace?.[0] || {};
                      
                      const skuStr = item.sku_tiny_snapshot || '';
                      const p1 = skuStr.length > 5 ? skuStr.slice(0, skuStr.length - 5) : skuStr;
                      const p2 = skuStr.length > 5 ? skuStr.slice(-5) : '';
                      
                      const codMarketplace = isML 
                        ? (skuMarketplace.sku_mercadolivre || item.sku_marketplace_snapshot || null)
                        : isShopee 
                          ? (skuMarketplace.sku_shopee || item.sku_marketplace_snapshot || null)
                          : (skuMarketplace.sku_amazon || item.sku_marketplace_snapshot || null);
                      const hasCod = !!codMarketplace;

                      const fullTitle = produto.nome || item.grupo_nome || 'Produto sem nome';

                      return (
                        <div key={item.id} className="grid grid-cols-9 gap-4 items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                           <div className="col-span-1 flex items-center">
                              {produto.url_imagem ? (
                                <img src={produto.url_imagem} alt="Img" className="w-12 h-12 rounded-none border-2 border-slate-200 p-0.5 object-cover bg-white shadow-sm" />
                              ) : (
                                <div className="w-12 h-12 rounded-none border-2 border-slate-200 flex items-center justify-center bg-slate-100 text-[8px] text-slate-400">SEM IMG</div>
                              )}
                           </div>
                           
                           <div className="col-span-2 flex flex-col gap-1">
                              <span className="text-[9px] font-black leading-tight text-slate-800 uppercase line-clamp-2">
                                {fullTitle}
                              </span>
                              
                              <div className="flex items-center gap-1.5 mt-0.5">
                                 {isML ? (
                                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <circle cx="12" cy="12" r="12" fill="#FFE600"/>
                                      <path d="M7 13.5C7 13.5 8.5 11 12 11C15.5 11 17 13.5 17 13.5" stroke="#2D3277" strokeWidth="2" strokeLinecap="round"/>
                                   </svg>
                                  ) : isShopee ? (
                                    <div className="w-3.5 h-3.5 bg-[#ee4d2d] rounded-sm flex items-center justify-center text-[8px] text-white font-bold">S</div>
                                  ) : (
                                    <div className="w-3.5 h-3.5 bg-[#232f3e] rounded-sm flex items-center justify-center text-[8px] text-white font-bold">A</div>
                                  )}

                                 {hasCod ? (
                                   <span className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-black text-slate-600 tracking-wider">
                                      {codMarketplace}
                                   </span>
                                 ) : (
                                   <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200 text-[9px] font-black italic uppercase animate-pulse">Pendente</span>
                                 )}
                              </div>
                           </div>

                           <div className="col-span-1 flex flex-col text-[10px] font-bold text-slate-400 leading-none">
                              <span className="text-[8px]">{p1}</span>
                              <span className={`text-[15px] font-black tracking-tighter ${hasCod ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {p2}
                              </span>
                           </div>

                           <div className="text-center font-black text-xl text-slate-900">
                             <input type="number" value={item.qtd_enviar} onChange={(e) => { const newQty = parseInt(e.target.value) || 0; setItens(prev => prev.map(it => it.id === item.id ? { ...it, qtd_enviar: newQty } : it)); }} className="w-12 h-12 bg-slate-50 border-2 border-slate-100 rounded-none text-center font-black text-2xl text-black focus:border-black outline-none transition-all" />
                           </div>

                           <div className="text-center">
                               <input type="text" defaultValue={item.qtd_feitos || ''} className="w-10 h-10 border-2 border-slate-200 rounded-lg text-center text-black font-black text-lg focus:border-black focus:ring-0 bg-white" />
                           </div>
                           <div className="text-center">
                              <input type="text" defaultValue={item.qtd_falta || ''} className="w-10 h-10 border-2 border-slate-200 rounded-lg text-center text-rose-600 font-black text-lg focus:border-rose-500 focus:ring-0 bg-white" />
                           </div>
                           <div className="text-center">
                               <input type="checkbox" defaultChecked={item.check_pronto} className="w-5 h-5 rounded border-2 border-slate-300 text-black focus:ring-black cursor-pointer" />
                           </div>
                           <div className="text-center no-print">
                               <button 
                                 onClick={() => handleDeleteRow(item.id)}
                                 className="text-slate-300 hover:text-rose-600 transition-colors"
                                 title="Remover item"
                               >
                                 <Trash2 size={16} />
                               </button>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {itens.filter(i => (i.produtos?.nome || i.grupo_nome || '').startsWith('*') && (i.qtd_enviar === 0 || !i.qtd_enviar)).length > 0 && (
                <div className="mt-12 border-t-2 border-dashed border-slate-200 pt-8">
                  <h3 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                    <span className="w-2 h-8 bg-rose-500 rounded-none"></span>
                    ITENS SEM ESTOQUE
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {itens
                      .filter(i => (i.produtos?.nome || i.grupo_nome || '').startsWith('*') && (i.qtd_enviar === 0 || !i.qtd_enviar))
                      .map(item => (
                        <div key={item.id} className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-none border border-slate-100 opacity-60 grayscale hover:grayscale-0 transition-all">
                          {item.produtos?.url_imagem ? (
                            <img src={item.produtos.url_imagem} alt="Sem estoque" className="w-10 h-10 rounded-none object-cover border border-slate-200 shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-none bg-slate-200 flex items-center justify-center text-[8px] text-slate-400">N/A</div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-700 leading-tight uppercase line-clamp-1">
                              {item.produtos?.nome || item.grupo_nome}
                            </span>
                            <span className="text-[8px] text-rose-500 font-bold">ESGOTADO NO TINY</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-end mt-16 pt-8 pb-4">
                <div className="w-48">
                  <div className="border-t border-slate-800 pt-1 text-[10px] font-black uppercase tracking-wider text-slate-600">Assinatura<br/>Motorista</div>
                </div>
                <div className="w-48 text-right">
                  <div className="border-t border-slate-800 pt-1 text-[10px] font-black uppercase tracking-wider text-slate-600">Documento<br/>RG ou CPF</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <aside className="w-80 bg-slate-900 text-white p-6 no-print flex flex-col gap-8 shadow-2xl z-20 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={18}/> Voltar
          </button>
          <div className="flex bg-slate-800 p-1 rounded-none border border-slate-700">
            {['MERCADO LIVRE', 'SHOPEE', 'AMAZON'].map(plt => (
              <button
                key={plt}
                onClick={() => setRemessa({ ...remessa, plataforma: plt })}
                className={`px-2 py-1 rounded-none text-[9px] font-black uppercase transition-all ${
                  remessa.plataforma === plt 
                    ? 'bg-white text-black' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {plt.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-black tracking-tighter uppercase italic text-white">Fluxo de Envio</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-none bg-white text-black flex items-center justify-center font-black shrink-0 shadow-lg shadow-white/10">1</div>
              <div className="flex-1">
                <h3 className="font-black text-sm uppercase mb-2">Informações Iniciais</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed">Confira os dados básicos da remessa e o sequencial diário.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-none bg-slate-800 border border-slate-700 flex items-center justify-center font-black shrink-0">2</div>
              <div className="flex-1">
                <h3 className="font-black text-sm uppercase mb-2">Produtos e SKUs</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed">Adicione produtos acabados e verifique os SKUs de marketplace.</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="mt-3 flex-1 bg-white text-black py-2 rounded-none font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14}/> Item
                  </button>
                  {isML && (
                    <button 
                      onClick={() => pdfInputRef.current?.click()}
                      className="mt-3 flex-1 bg-indigo-600 text-white py-2 rounded-none font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"
                    >
                      {parsingPdf ? <RefreshCw size={14} className="animate-spin" /> : <FileUp size={14}/>}
                      PDF ML
                    </button>
                  )}
                  <input type="file" accept=".pdf" ref={pdfInputRef} className="hidden" onChange={handlePdfUpload} />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black shrink-0">3</div>
              <div className="flex-1">
                <h3 className="font-black text-sm uppercase mb-2">Finalização</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed">Salve os dados e integre para atualizar os estoques no Tiny.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-8 border-t border-slate-800 flex flex-col gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving || integrating}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            SALVAR REMESSA
          </button>

          <button 
            onClick={() => handleIntegrate()}
            disabled={integrating || isSaving || isNew}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {integrating ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {integrating ? 'INTEGRANDO...' : 'INTEGRAR AGORA'}
          </button>

          <button 
            onClick={handlePrint}
            className="w-full bg-slate-800 hover:bg-white hover:text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs border border-slate-700 transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            <Printer size={18}/> IMPRIMIR PDF
          </button>
        </div>
      </aside>
    </div>
  );
}
