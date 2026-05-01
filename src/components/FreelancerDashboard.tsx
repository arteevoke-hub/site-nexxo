import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Play, Square, Package, DollarSign, Calendar, LogOut } from 'lucide-react';

export function FreelancerDashboard() {
  const [funcionarioId, setFuncionarioId] = useState<string>('');
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [meusDados, setMeusDados] = useState<any>(null);
  
  const [pontoAtivo, setPontoAtivo] = useState<any>(null);
  const [resumoSemana, setResumoSemana] = useState({ kits: 0, valor: 0, minutos: 0 });

  useEffect(() => {
    loadFuncionarios();
  }, []);

  useEffect(() => {
    if (funcionarioId) {
      loadDashboard();
    }
  }, [funcionarioId]);

  const loadFuncionarios = async () => {
    const { data } = await supabase.from('funcionarios').select('*').eq('ativo', true);
    setFuncionarios(data || []);
  };

  const loadDashboard = async () => {
    const me = funcionarios.find(f => f.id === funcionarioId);
    setMeusDados(me);

    // Carregar ponto do dia
    const hoje = new Date().toISOString().split('T')[0];
    const { data: pontos } = await supabase
      .from('ponto_funcionarios')
      .select('*')
      .eq('id_funcionario', funcionarioId)
      .eq('data_trabalho', hoje)
      .order('created_at', { ascending: false })
      .limit(1);

    if (pontos && pontos.length > 0 && !pontos[0].saida) {
      setPontoAtivo(pontos[0]);
    } else {
      setPontoAtivo(null);
    }

    // Carregar resumo da produção da semana (Simulação para MVP)
    // Na real: buscar na ordem_producao com id_funcionario
    const { data: ordens } = await supabase
      .from('ordem_producao')
      .select('*')
      .eq('id_funcionario', funcionarioId)
      .eq('status', 'CONCLUIDA');
      
    if (ordens) {
      const kitsSemana = ordens.reduce((acc, curr) => acc + (curr.quantidade_produzida || 0), 0);
      const totalValor = ordens.reduce((acc, curr) => {
        const valorPorUnidade = (curr.custo_total || 0) / (curr.quantidade_planejada || 1);
        return acc + ((curr.quantidade_produzida || 0) * valorPorUnidade);
      }, 0);
      setResumoSemana({ kits: kitsSemana, valor: totalValor, minutos: 1240 }); // Mock minutos
    }
  };

  const handleBaterPonto = async () => {
    try {
      if (pontoAtivo) {
        // Finalizar expediente
        const saida = new Date();
        const entrada = new Date(pontoAtivo.entrada);
        const diffMs = saida.getTime() - entrada.getTime();
        const minutos = Math.floor(diffMs / 60000);

        await supabase.from('ponto_funcionarios')
          .update({ saida: saida.toISOString(), minutos_trabalhados: minutos })
          .eq('id', pontoAtivo.id);
          
        alert('Expediente finalizado com sucesso!');
      } else {
        // Iniciar expediente
        await supabase.from('ponto_funcionarios').insert([{
          id_funcionario: funcionarioId,
          entrada: new Date().toISOString(),
          data_trabalho: new Date().toISOString().split('T')[0]
        }]);
        alert('Expediente iniciado! Bom trabalho!');
      }
      loadDashboard();
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar ponto.');
    }
  };

  if (!funcionarioId) {
    return (
      <div className="flex-1 bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full border border-slate-700">
          <h2 className="text-2xl font-black text-white text-center mb-6">Portal do Freelancer</h2>
          <p className="text-slate-400 text-center mb-8">Selecione seu perfil para acessar sua área de trabalho.</p>
          <select 
            className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-xl text-white focus:border-indigo-500 transition-colors"
            onChange={e => setFuncionarioId(e.target.value)}
          >
            <option value="">Quem é você?</option>
            {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0f111a] text-slate-200 overflow-auto">
      
      {/* Top Navbar Pessoal */}
      <div className="bg-[#181a25] border-b border-slate-800 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xl font-black shadow-[0_0_15px_rgba(79,70,229,0.5)]">
            {meusDados?.nome?.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Olá, {meusDados?.nome}</h1>
            <p className="text-sm text-slate-400">Portal de Montagem</p>
          </div>
        </div>
        <button 
          onClick={() => setFuncionarioId('')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <LogOut size={18} /> Sair
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-8 space-y-8">
        
        {/* Relógio de Ponto */}
        <div className="bg-gradient-to-br from-[#1e212e] to-[#181a25] border border-slate-800 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
          <div>
            <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
              <Clock className="text-indigo-400" /> Controle de Ponto
            </h2>
            <p className="text-slate-400">
              {pontoAtivo 
                ? `Você está trabalhando desde as ${new Date(pontoAtivo.entrada).toLocaleTimeString().slice(0,5)}.`
                : 'Você ainda não iniciou o seu expediente de hoje.'}
            </p>
          </div>
          
          <button 
            onClick={handleBaterPonto}
            className={`px-8 py-4 rounded-2xl font-black text-xl shadow-lg transition-all flex items-center gap-3 ${
              pontoAtivo 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            }`}
          >
            {pontoAtivo ? <><Square size={24}/> FINALIZAR EXPEDIENTE</> : <><Play size={24}/> INICIAR EXPEDIENTE</>}
          </button>
        </div>

        {/* Resumo da Semana */}
        <h3 className="text-xl font-bold text-white mt-12 mb-4">Meus Ganhos na Semana</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#181a25] border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <Package size={32} className="text-indigo-400 mb-3" />
            <div className="text-sm font-medium text-slate-400 mb-1">Kits Montados</div>
            <div className="text-4xl font-black text-white">{resumoSemana.kits}</div>
          </div>
          
          <div className="bg-[#181a25] border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <DollarSign size={32} className="text-emerald-400 mb-3" />
            <div className="text-sm font-medium text-slate-400 mb-1">Valor Acumulado</div>
            <div className="text-4xl font-black text-white">R$ {resumoSemana.valor.toFixed(2).replace('.',',')}</div>
          </div>

          <div className="bg-[#181a25] border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <Calendar size={32} className="text-amber-400 mb-3" />
            <div className="text-sm font-medium text-slate-400 mb-1">Horas Trabalhadas</div>
            <div className="text-4xl font-black text-white">{Math.floor(resumoSemana.minutos / 60)}h</div>
          </div>
        </div>

      </div>

    </div>
  );
}
