import type { Deposito } from '../types/tiny';

interface DepositosPanelProps {
  depositos: Deposito[];
  estoqueTotal: number;
  compact?: boolean; // versão compacta para dentro do card
}

export function DepositosPanel({ depositos, estoqueTotal, compact = false }: DepositosPanelProps) {
  if (!depositos || depositos.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 italic">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
        Sem depósitos cadastrados
      </div>
    );
  }

  if (compact) {
    // Versão inline para o card de produto
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {depositos.map((dep, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
            title={`${dep.nome}: ${dep.saldo} un.`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            {dep.nome}
            <span className="font-semibold ml-0.5">{dep.saldo}</span>
          </span>
        ))}
      </div>
    );
  }

  // Versão expandida (modal ou painel lateral)
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Distribuição por depósito
      </p>
      {depositos.map((dep, i) => {
        const pct = estoqueTotal > 0 ? Math.round((dep.saldo / estoqueTotal) * 100) : 0;
        const colorClass = dep.saldo === 0
          ? 'bg-gray-200'
          : dep.saldo <= 10
          ? 'bg-amber-400'
          : 'bg-emerald-400';

        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colorClass}`} />
                <span className="text-gray-700 font-medium">{dep.nome}</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-gray-900 font-semibold tabular-nums">{dep.saldo}</span>
                <span className="text-gray-400 text-xs w-9 text-right">{pct}%</span>
              </div>
            </div>
            {/* barra de progresso */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      {/* totalizador */}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 text-sm font-semibold">
        <span className="text-gray-500">Total</span>
        <span className="text-gray-900 tabular-nums">{estoqueTotal} un.</span>
      </div>
    </div>
  );
}
