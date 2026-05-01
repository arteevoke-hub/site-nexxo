import React, { useState } from 'react';
import { Calendar, Bell, Sparkles } from 'lucide-react';
import { ProdutosAEnviar } from './ProdutosAEnviar';

export function PainelControle() {
  const [activeMetric, setActiveMetric] = useState('Total Vendido');

  const metrics = [
    { label: 'Total Vendido', value: '-' },
    { label: 'Taxa de Conversão', value: '-' },
    { label: 'ROI', value: '-' },
    { label: 'CAC', value: '-' },
    { label: 'Número de Pedidos', value: '0' },
    { label: 'Ticket médio do Pedido', value: '-' },
    { label: 'Investimento em Marketing', value: '-' },
    { label: 'Lucro Líquido', value: '-' },
    { label: 'CPA', value: '-' },
    { label: 'Clientes', value: '0' },
  ];

  return (
    <div className="flex-1 overflow-auto bg-[#f4f7fa]">
      {/* Header do Painel */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-black rounded-none"></div>
          <h1 className="text-xl font-bold text-slate-800">Painel de Controle</h1>
          <select className="ml-4 border-none bg-slate-100 text-slate-700 text-sm font-semibold py-1.5 px-3 rounded-full cursor-pointer focus:ring-0">
            <option>UNIDADE ATIVA</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden text-sm">
            <div className="px-3 py-2 border-r border-slate-200 text-slate-600 flex items-center gap-2">
              <Calendar size={14} />
              01/04/2026 - 25/04/2026
            </div>
            <div className="px-3 py-2 text-slate-600 flex items-center gap-2 bg-slate-50">
              por
              <select className="border-none bg-transparent font-semibold text-slate-700 py-0 pl-1 pr-4 focus:ring-0">
                <option>Dia</option>
              </select>
            </div>
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-black rounded-none border border-white"></span>
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* IA Banner */}
        <div className="bg-white border border-slate-200 p-4 rounded-none flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2 text-black font-black text-xs uppercase tracking-widest">
            <Sparkles size={16} />
            Analisar Protocolos com Agente IA
          </div>
          <ChevronDownIcon />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button className="px-4 py-1.5 bg-white border border-slate-300 text-slate-800 text-[10px] font-black uppercase tracking-widest rounded-none hover:bg-black hover:text-white transition-all">Marketplace</button>
          <button className="px-4 py-1.5 bg-white border border-slate-300 text-slate-800 text-[10px] font-black uppercase tracking-widest rounded-none hover:bg-black hover:text-white transition-all">E-commerce</button>
        </div>

        {/* Top Section: Metrics and Main Chart */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Metrics Grid */}
          <div className="w-full lg:w-[400px] shrink-0 bg-white border border-slate-200 p-5 rounded-none shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-1">Resumo</h2>
            <p className="text-xs text-slate-500 mb-4">*Selecione o indicador e acompanhe na tabela ao lado</p>
            
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setActiveMetric(m.label)}
                  className={`p-3 text-left rounded-none border transition-all ${
                    activeMetric === m.label 
                    ? 'border-black bg-slate-50 shadow-sm' 
                    : 'border-slate-100 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`text-lg font-black mb-1 ${activeMetric === m.label ? 'text-black' : 'text-slate-300'}`}>
                    {m.value}
                  </div>
                  <div className={`text-[10px] font-black uppercase tracking-tight ${activeMetric === m.label ? 'text-black' : 'text-slate-500'}`}>
                    {m.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Chart Placeholder */}
          <div className="flex-1 bg-white border border-slate-200 p-5 rounded-none shadow-sm flex flex-col min-h-[400px]">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-4 h-4 bg-black rounded-none"></div>
              <span className="text-sm font-semibold text-slate-700">{activeMetric}</span>
            </div>
            
            {/* Chart Area */}
            <div className="flex-1 border-b border-l border-slate-100 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border-t border-slate-50 w-full h-0"></div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm font-medium">
                Gráfico de {activeMetric}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: secondary charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* UTM Chart */}
          <div className="bg-white border border-slate-200 p-5 rounded-none shadow-sm min-h-[300px] flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-bold text-slate-800">Vendas por</span>
              <select className="border-none bg-slate-50 text-slate-700 text-sm font-semibold py-1 px-3 rounded-md cursor-pointer focus:ring-0">
                <option>UTM</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-4 h-4 bg-black rounded-none"></div>
              <span className="text-xs font-semibold text-slate-500">Vendas</span>
            </div>
            <div className="flex-1 border-b border-l border-slate-100 flex items-center justify-center text-slate-300 text-sm font-medium">
              Gráfico de Vendas
            </div>
          </div>

          {/* Campaign Chart */}
          <div className="bg-white border border-slate-200 p-5 rounded-none shadow-sm min-h-[300px] flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-sm font-bold text-slate-800">Investimento por Desempenho de Campanha</h2>
              <button className="text-slate-400 hover:text-slate-600">
                <InfoIcon />
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-4 mb-8 text-[11px] font-semibold text-slate-500">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-none bg-slate-200"></span> Baixo</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-none bg-slate-400"></span> Médio</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-none bg-black"></span> Alto</div>
            </div>

            <div className="flex-1 flex items-center justify-center">
              {/* Fake Donut Chart */}
              <div className="relative w-48 h-48 rounded-full border-[24px] border-black border-r-slate-200 border-b-slate-400 border-l-slate-400 shadow-inner">
              </div>
            </div>
          </div>

        </div>

        {/* ===== SEÇÃO: PRODUTOS À ENVIAR ===== */}
        <ProdutosAEnviar />

      </div>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4"/>
      <path d="M12 8h.01"/>
    </svg>
  );
}
