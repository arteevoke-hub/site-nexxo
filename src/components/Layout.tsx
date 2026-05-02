import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  ShoppingCart, 
  Users, 
  Box, 
  BadgeDollarSign, 
  Target, 
  Link as LinkIcon, 
  FileText, 
  CreditCard, 
  Settings, 
  ChevronRight,
  ChevronDown,
  Store,
  Bot,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  hasSubmenu?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

const SidebarItem = ({ icon: Icon, label, active, hasSubmenu, expanded, onClick, children }: SidebarItemProps) => {
  return (
    <div className="mb-1">
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-none transition-colors ${
          active ? 'bg-white text-black font-black' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className={active ? 'text-black' : 'text-slate-400'} />
          <span className="text-sm">{label}</span>
        </div>
        {hasSubmenu && (
          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        )}
      </button>
      <AnimatePresence>
        {expanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-9 mt-1 flex flex-col gap-1 border-l border-slate-700"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SubItem = ({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-bold rounded-none text-left transition-colors ${
      active ? 'text-white bg-slate-800 border-l-2 border-white' : 'text-slate-500 hover:text-slate-300'
    }`}
  >
    {label}
  </button>
);

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  view?: string;
  setView?: (view: any) => void;
  store: 'MEIKE' | 'ONN' | null;
}

export const Layout = ({ children, activeTab, setActiveTab, view = 'produtos', setView = () => {}, store }: LayoutProps) => {
  const [expandedMenu, setExpandedMenu] = useState<string | null>('Produtos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleMenu = (menu: string) => {
    setExpandedMenu(expandedMenu === menu ? null : menu);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] relative overflow-hidden">
      {/* Mobile Toggle Button - Floating and high visibility */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden fixed top-4 left-4 z-50 w-12 h-12 bg-slate-900 text-white rounded-xl shadow-2xl flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 h-full w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 text-white no-print transition-all duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isSidebarOpen 
          ? 'translate-x-0 opacity-100 visible' 
          : '-translate-x-full opacity-0 invisible md:translate-x-0 md:opacity-100 md:visible'}
      `}>
        {/* Header with Close Button for Mobile */}
        <div className="p-6 flex flex-col items-center justify-center relative">
          {isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          )}
          <span className="text-3xl font-black text-white tracking-[0.1em] uppercase italic" style={{ fontFamily: 'sans-serif' }}>
            {store === 'ONN' ? 'ONN STORE' : 'MEIKÊ'}
          </span>
          <div className="h-0.5 w-12 bg-white mt-1"></div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">Sua Lojas</div>
          <SidebarItem icon={Store} label="Minhas Lojas" />
          
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider my-4 px-3">IA</div>
          <SidebarItem 
            icon={Bot} 
            label="Agente IA" 
            active={view === 'agente'}
            onClick={() => { setView('agente'); setExpandedMenu(null); setIsSidebarOpen(false); }}
          />

          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider my-4 px-3">Painéis</div>
          
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Painel de Controle" 
            active={view === 'painel'}
            onClick={() => { setView('painel'); setExpandedMenu(null); setIsSidebarOpen(false); }}
          />
          
          <SidebarItem 
            icon={BarChart3} 
            label="Marketing" 
            hasSubmenu 
            expanded={expandedMenu === 'Marketing'}
            onClick={() => toggleMenu('Marketing')}
          >
            <SubItem label="Resumo" active={view === 'marketing'} onClick={() => { setView('marketing'); setIsSidebarOpen(false); }} />
            <SubItem label="Campanhas" />
            <SubItem label="ROAS por Região" />
          </SidebarItem>

          <SidebarItem 
            icon={ShoppingCart} 
            label="Pedidos" 
            hasSubmenu
            expanded={expandedMenu === 'Pedidos'}
            onClick={() => toggleMenu('Pedidos')}
          >
            <SubItem label="Resumo" active={view === 'pedidos'} onClick={() => { setView('pedidos'); setIsSidebarOpen(false); }} />
            <SubItem label="Aprovação" />
            <SubItem label="Regiões" />
          </SidebarItem>

          <SidebarItem 
            icon={Users} 
            label="Clientes" 
            hasSubmenu
            expanded={expandedMenu === 'Clientes'}
            onClick={() => toggleMenu('Clientes')}
          >
            <SubItem label="Resumo" />
            <SubItem label="LTV e CAC" />
          </SidebarItem>

          <SidebarItem 
            icon={Box} 
            label="Produtos" 
            active={expandedMenu === 'Produtos'}
            hasSubmenu
            expanded={expandedMenu === 'Produtos'}
            onClick={() => toggleMenu('Produtos')}
          >
            <SubItem label="Resumo" active={view === 'produtos' && activeTab === 'resumo'} onClick={() => { setView('produtos'); setActiveTab('resumo'); setIsSidebarOpen(false); }} />
            <SubItem label="Lista" active={view === 'produtos' && activeTab === 'lista'} onClick={() => { setView('produtos'); setActiveTab('lista'); setIsSidebarOpen(false); }} />
            <SubItem label="Estoque" active={view === 'produtos' && activeTab === 'estoque'} onClick={() => { setView('produtos'); setActiveTab('estoque'); setIsSidebarOpen(false); }} />
          </SidebarItem>

          <SidebarItem 
            icon={LinkIcon} 
            label="Envios & Produção" 
            active={expandedMenu === 'Producao'}
            hasSubmenu
            expanded={expandedMenu === 'Producao'}
            onClick={() => toggleMenu('Producao')}
          >
            <SubItem label="Dicionário de SKUs" active={view === 'dicionario'} onClick={() => { setView('dicionario'); setIsSidebarOpen(false); }} />
            <SubItem label="Gestão de Produção" active={view === 'producao-dash'} onClick={() => { setView('producao-dash'); setIsSidebarOpen(false); }} />
            <SubItem label="Portal Freelancer" active={view === 'freelancer-dash'} onClick={() => { setView('freelancer-dash'); setIsSidebarOpen(false); }} />
            <SubItem label="Montagem Kits (Totem)" active={view === 'producao-montagem'} onClick={() => { setView('producao-montagem'); setIsSidebarOpen(false); }} />
          </SidebarItem>

          <SidebarItem 
            icon={Box} 
            label="FULL" 
            active={expandedMenu === 'Full'}
            hasSubmenu
            expanded={expandedMenu === 'Full'}
            onClick={() => toggleMenu('Full')}
          >
            <SubItem label="Resumo" active={view === 'full-resumo'} onClick={() => { setView('full-resumo'); setIsSidebarOpen(false); }} />
            <SubItem label="Controle de Envio" active={view === 'remessa-list' || view === 'remessa-detail'} onClick={() => { setView('remessa-list'); setIsSidebarOpen(false); }} />
            <SubItem label="Nova Remessa" active={view === 'full-new'} onClick={() => { setView('full-new'); setIsSidebarOpen(false); }} />
          </SidebarItem>

          <SidebarItem 
            icon={BadgeDollarSign} 
            label="Financeiro" 
            hasSubmenu 
            expanded={expandedMenu === 'Financeiro'}
            onClick={() => toggleMenu('Financeiro')}
          >
             <SubItem label="Resumo" active={view === 'financeiro'} onClick={() => { setView('financeiro'); setIsSidebarOpen(false); }} />
             <SubItem label="Custos" />
          </SidebarItem>
          <SidebarItem icon={Target} label="Metas" />
          <SidebarItem icon={LinkIcon} label="Conexões" />
          <SidebarItem icon={FileText} label="Faturamento" />
          <SidebarItem icon={CreditCard} label="Planos" />
          <SidebarItem icon={Settings} label="Configurações" hasSubmenu />
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-3 p-2 bg-slate-800/50 border border-slate-800 rounded-none cursor-default group">
            <div className="w-8 h-8 rounded-none flex items-center justify-center text-xs font-black text-black shadow-lg bg-white">
              {store === 'ONN' ? 'OS' : 'MK'}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-black text-slate-100 truncate uppercase tracking-tighter">OPERADOR</div>
              <div className="text-[9px] text-slate-500 truncate uppercase font-bold tracking-widest">{store === 'ONN' ? 'UNIDADE ONN' : 'UNIDADE MEIKÊ'}</div>
            </div>
          </div>
          
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-3 px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-none transition-colors text-xs font-black uppercase tracking-widest"
          >
            <LogOut size={16} />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col w-full">
        {children}
      </main>
    </div>
  );
};
