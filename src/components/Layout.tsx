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
  Bot
} from 'lucide-react';
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
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
          active ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className={active ? 'text-white' : 'text-slate-400'} />
          <span className="text-sm font-medium">{label}</span>
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
    className={`px-3 py-1.5 text-xs font-medium rounded-md text-left transition-colors ${
      active ? 'text-sky-400 bg-sky-400/10' : 'text-slate-500 hover:text-slate-300'
    }`}
  >
    {label}
  </button>
);

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export const Layout = ({ children, activeTab, setActiveTab }: LayoutProps) => {
  const [expandedMenu, setExpandedMenu] = useState<string | null>('Produtos');

  const toggleMenu = (menu: string) => {
    setExpandedMenu(expandedMenu === menu ? null : menu);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 text-white">
        <div className="p-6 flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-400 rounded-lg flex items-center justify-center">
            <span className="text-slate-900 font-bold text-xl">P</span>
          </div>
          <span className="text-xl font-bold text-sky-400 tracking-wider">PRAX.AI</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">Sua Lojas</div>
          <SidebarItem icon={Store} label="Minhas Lojas" />
          
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider my-4 px-3">IA</div>
          <SidebarItem icon={Bot} label="Assistente IA" />

          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider my-4 px-3">Painéis</div>
          
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Painel de Controle" 
            active={activeTab === 'Dashboard'}
            onClick={() => setActiveTab('Dashboard')}
          />
          
          <SidebarItem 
            icon={BarChart3} 
            label="Marketing" 
            hasSubmenu 
            expanded={expandedMenu === 'Marketing'}
            onClick={() => toggleMenu('Marketing')}
          >
            <SubItem label="Resumo" />
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
            <SubItem label="Resumo" />
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
            <SubItem label="Resumo" active={activeTab === 'resumo'} onClick={() => setActiveTab('resumo')} />
            <SubItem label="Lista" active={activeTab === 'lista'} onClick={() => setActiveTab('lista')} />
            <SubItem label="Estoque" active={activeTab === 'estoque'} onClick={() => setActiveTab('estoque')} />
          </SidebarItem>

          <SidebarItem icon={BadgeDollarSign} label="Financeiro" hasSubmenu />
          <SidebarItem icon={Target} label="Metas" />
          <SidebarItem icon={LinkIcon} label="Conexões" />
          <SidebarItem icon={FileText} label="Faturamento" />
          <SidebarItem icon={CreditCard} label="Planos" />
          <SidebarItem icon={Settings} label="Configurações" hasSubmenu />
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
              LR
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-semibold text-slate-100 truncate">Leandro</div>
              <div className="text-[10px] text-slate-500 truncate">sac.onnstore@gmail.com</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
};
