import { Package, AlertTriangle, XCircle, Warehouse } from 'lucide-react';

interface StatsBarProps {
  totalProdutos: number;
  totalEstoque: number;
  produtosBaixo: number;
  produtosZerados: number;
  filtro: string;
  setFiltro: (v: any) => void;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  active?: boolean;
  onClick?: () => void;
  accent?: string;
}

function StatCard({ icon, label, value, active, onClick, accent = 'blue' }: StatCardProps) {
  const accentMap: Record<string, string> = {
    blue: 'border-blue-400 bg-blue-50 text-blue-700',
    amber: 'border-amber-400 bg-amber-50 text-amber-700',
    red: 'border-red-400 bg-red-50 text-red-700',
    emerald: 'border-emerald-400 bg-emerald-50 text-emerald-700',
  };
  const activeClass = active ? `border-2 ${accentMap[accent]}` : 'border border-gray-100 bg-white text-gray-600';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 hover:shadow-sm text-left w-full ${activeClass}`}
    >
      <div className={`flex-shrink-0 ${active ? '' : 'text-gray-400'}`}>{icon}</div>
      <div>
        <p className={`text-xs font-medium ${active ? '' : 'text-gray-500'}`}>{label}</p>
        <p className="text-lg font-bold leading-tight tabular-nums">{value}</p>
      </div>
    </button>
  );
}

export function StatsBar({ totalProdutos, totalEstoque, produtosBaixo, produtosZerados, filtro, setFiltro }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        icon={<Package size={20} />}
        label="Total de produtos"
        value={totalProdutos}
        active={filtro === 'todos'}
        onClick={() => setFiltro('todos')}
        accent="blue"
      />
      <StatCard
        icon={<Warehouse size={20} />}
        label="Unidades em estoque"
        value={totalEstoque.toLocaleString('pt-BR')}
        active={filtro === 'disponivel'}
        onClick={() => setFiltro('disponivel')}
        accent="emerald"
      />
      <StatCard
        icon={<AlertTriangle size={20} />}
        label="Estoque baixo (≤10)"
        value={produtosBaixo}
        active={filtro === 'baixo'}
        onClick={() => setFiltro('baixo')}
        accent="amber"
      />
      <StatCard
        icon={<XCircle size={20} />}
        label="Sem estoque"
        value={produtosZerados}
        active={filtro === 'zerado'}
        onClick={() => setFiltro('zerado')}
        accent="red"
      />
    </div>
  );
}
