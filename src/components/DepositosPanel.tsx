import type { Deposito } from '../types/tiny';

interface DepositosPanelProps {
  depositos: Deposito[];
  estoqueTotal: number;
  compact?: boolean; // versão compacta para dentro do card
}

export function DepositosPanel({ depositos, estoqueTotal, compact = false }: DepositosPanelProps) {
  if (!depositos || depositos.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 italic font-mono">
        <span className="w-1.5 h-1.5 rounded-none bg-slate-700 inline-block" />
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
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[10px] font-black bg-white/10 text-white border border-white/20 uppercase tracking-tighter"
            title={`${dep.nome}: ${dep.saldo} un.`}
          >
            <span className="w-1 h-3 bg-white flex-shrink-0" />
            {dep.nome}
            <span className="font-bold ml-0.5">{dep.saldo}</span>
          </span>
        ))}
      </div>
    );
  }

  // Versão expandida (modal ou painel lateral)
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 font-mono">
        Distribuição por depósito
      </p>
      {depositos.map((dep, i) => {
        const pct = estoqueTotal > 0 ? Math.round((dep.saldo / estoqueTotal) * 100) : 0;
        const colorClass = dep.saldo === 0
          ? 'bg-slate-700'
          : dep.saldo <= 10
          ? 'bg-rose-500'
          : 'bg-emerald-500';

        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-none flex-shrink-0 ${colorClass}`} />
                <span className="text-slate-300 font-medium">{dep.nome}</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-white font-bold tabular-nums">{dep.saldo}</span>
                <span className="text-slate-500 text-xs w-9 text-right font-mono">{pct}%</span>
              </div>
            </div>
            {/* barra de progresso */}
            <div className="h-1.5 bg-slate-800 rounded-none overflow-hidden">
              <div
                className={`h-full rounded-none transition-all duration-500 ${colorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      {/* totalizador */}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800 text-sm font-bold">
        <span className="text-slate-500 uppercase text-[10px] tracking-widest font-mono">Total</span>
        <span className="text-white tabular-nums">{estoqueTotal} un.</span>
      </div>
    </div>
  );
}
