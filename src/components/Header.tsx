import React, { useEffect, useState } from 'react';
import { Search, Filter, Download, Calendar, Bell, ChevronDown } from 'lucide-react';

interface HeaderProps {
  title: string;
  storeName?: string;
  activeTab: 'resumo' | 'lista' | 'estoque';
  setActiveTab: (tab: 'resumo' | 'lista' | 'estoque') => void;
}

export const Header = ({ title, storeName = 'Tiny ERP', activeTab, setActiveTab }: HeaderProps) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
      <div className="flex items-center gap-10">
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        
        {/* Navigation Tabs in Header */}
        <div className="flex items-center gap-6 self-end h-16 pt-2">
          <button 
            onClick={() => setActiveTab('resumo')}
            className={`h-full px-4 text-sm font-semibold transition-colors relative flex items-center ${activeTab === 'resumo' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Resumo
            {activeTab === 'resumo' && <motion.div layoutId="header-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600" />}
          </button>
          <button 
            onClick={() => setActiveTab('lista')}
            className={`h-full px-4 text-sm font-semibold transition-colors relative flex items-center ${activeTab === 'lista' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Lista
            {activeTab === 'lista' && <motion.div layoutId="header-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600" />}
          </button>
          <button 
            onClick={() => setActiveTab('estoque')}
            className={`h-full px-4 text-sm font-semibold transition-colors relative flex items-center ${activeTab === 'estoque' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Estoque
            {activeTab === 'estoque' && <motion.div layoutId="header-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-xs font-semibold">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          Conectado: {storeName}
        </div>
        <div className="text-[13px] text-slate-500">Sincronizado há 2 min</div>
        
        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative ml-4">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
      </div>
    </header>
  );
};

interface ControlsProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export const Controls = ({ searchTerm, setSearchTerm }: ControlsProps) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex gap-2">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por nome do produto" 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <Filter size={16} />
          Filtros
          <ChevronRight size={14} className="ml-1" />
        </button>
      </div>
      
      <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
        <Download size={16} />
        Baixar como CSV
      </button>
    </div>
  );
};

const motion = { div: (props: any) => <div {...props} /> }; // Simple fallback or use motion if needed

const ChevronRight = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6"/>
  </svg>
);
