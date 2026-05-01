import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Play, Square, User, Package, Clock, CheckCircle } from 'lucide-react';

export function ProducaoKiosk() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [ordens, setOrdens] = useState<any[]>([]);
  
  const [selectedFunc, setSelectedFunc] = useState('');
  const [selectedOrdem, setSelectedOrdem] = useState<any>(null);
  
  const [isProducing, setIsProducing] = useState(false);
  const [secondsGasto, setSecondsGasto] = useState(0);
  const [qtdConcluida, setQtdConcluida] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: funcs } = await supabase.from('funcionarios').select('*').eq('ativo', true);
      setFuncionarios(funcs || []);

      const { data: ords } = await supabase.from('ordem_producao')
        .select('*, produtos(nome)')
        .in('status', ['PENDENTE', 'EM_PRODUCAO']);
      setOrdens(ords || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStart = async () => {
    if (!selectedFunc || !selectedOrdem) return alert("Selecione funcionário e ordem.");
    
    // Atualiza status no banco se necessário
    if (selectedOrdem.status === 'PENDENTE') {
      await supabase.from('ordem_producao').update({ status: 'EM_PRODUCAO', id_funcionario: selectedFunc }).eq('id', selectedOrdem.id);
    }

    setIsProducing(true);
    setSecondsGasto(selectedOrdem.tempo_gasto_segundos || 0);
    
    timerRef.current = setInterval(() => {
      setSecondsGasto(s => s + 1);
    }, 1000);
  };

  const handleStop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsProducing(false);

    // Save progress without concluding order
    await supabase.from('ordem_producao').update({ tempo_gasto_segundos: secondsGasto }).eq('id', selectedOrdem.id);
  };

  const handleConclude = async () => {
    if (qtdConcluida <= 0) return alert("Digite a quantidade produzida.");
    if (timerRef.current) clearInterval(timerRef.current);
    setIsProducing(false);

    try {
      // Atualizar banco Supabase
      const newTotal = (selectedOrdem.quantidade_produzida || 0) + qtdConcluida;
      const novoStatus = newTotal >= selectedOrdem.quantidade_planejada ? 'CONCLUIDA' : 'EM_PRODUCAO';
      
      await supabase.from('ordem_producao').update({ 
        quantidade_produzida: newTotal,
        tempo_gasto_segundos: secondsGasto,
        status: novoStatus,
        data_fim: novoStatus === 'CONCLUIDA' ? new Date().toISOString() : null
      }).eq('id', selectedOrdem.id);

      alert(`Sucesso! ${qtdConcluida} kits registrados. A ordem está aguardando o lançamento de estoque pelo Gestor.`);
      
      // Limpa tela
      setQtdConcluida(0);
      setSelectedOrdem(null);
      loadData();

    } catch (err) {
      console.error(err);
      alert("Erro ao concluir produção.");
    }
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 bg-slate-900 text-white flex flex-col items-center justify-center p-6 h-full">
      <div className="max-w-2xl w-full bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
        
        <h1 className="text-3xl font-black text-center mb-8 tracking-tight text-indigo-400">Terminal de Produção</h1>

        {!isProducing ? (
          <div className="space-y-6">
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400 flex items-center gap-2"><User size={16}/> Operador</label>
              <select 
                className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-xl focus:border-indigo-500 transition-colors"
                value={selectedFunc}
                onChange={e => setSelectedFunc(e.target.value)}
              >
                <option value="">Selecione o seu nome...</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400 flex items-center gap-2"><Package size={16}/> Ordem a Produzir</label>
              <select 
                className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-xl focus:border-indigo-500 transition-colors"
                value={selectedOrdem?.id || ''}
                onChange={e => setSelectedOrdem(ordens.find(o => o.id === e.target.value))}
              >
                <option value="">Selecione a Ordem...</option>
                {ordens.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.produtos?.nome} ({o.quantidade_planejada - (o.quantidade_produzida||0)} faltam)
                  </option>
                ))}
              </select>
            </div>

            <button 
              onClick={handleStart}
              disabled={!selectedFunc || !selectedOrdem}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black text-2xl py-6 rounded-xl flex items-center justify-center gap-3 transition-colors mt-8"
            >
              <Play size={28} /> INICIAR PRODUÇÃO
            </button>

          </div>
        ) : (
          <div className="flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-300">
            
            <div className="text-center">
              <div className="text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">Produzindo agora</div>
              <div className="text-2xl font-bold text-indigo-300">{selectedOrdem?.produtos?.nome}</div>
            </div>

            <div className="bg-slate-900 border-2 border-indigo-500/30 rounded-full w-64 h-64 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.2)]">
              <Clock size={32} className="text-indigo-400 mb-2 animate-pulse" />
              <div className="text-5xl font-mono font-black text-white">{formatTime(secondsGasto)}</div>
            </div>

            <div className="w-full grid grid-cols-2 gap-4">
              <button 
                onClick={handleStop}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Square size={20} /> PAUSAR
              </button>
              
              <button 
                onClick={() => {
                  const qtd = prompt("Quantos kits você finalizou nesta leva?", "10");
                  if (qtd && !isNaN(parseInt(qtd))) {
                    setQtdConcluida(parseInt(qtd));
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2"
              >
                <CheckCircle size={20} /> INFORMAR KITS
              </button>
            </div>

            {qtdConcluida > 0 && (
              <div className="w-full bg-indigo-900/50 p-6 rounded-xl border border-indigo-500 flex justify-between items-center">
                <div>
                  <div className="text-indigo-200 text-sm">Pronto para oficializar:</div>
                  <div className="text-3xl font-black">{qtdConcluida} KITS</div>
                </div>
                <button 
                  onClick={handleConclude}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-6 rounded-lg"
                >
                  FINALIZAR ORDEM
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
