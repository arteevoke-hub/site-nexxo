import { useState } from 'react';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';
import type { Produto } from '../types/tiny';
import { DepositosPanel } from './DepositosPanel';

interface ProductCardProps {
  produto: Produto;
  onClick?: (produto: Produto) => void;
}

function StockBadge({ estoque }: { estoque: number }) {
  if (estoque === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
        Zerado
      </span>
    );
  }
  if (estoque <= 10) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        Baixo · {estoque}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
      {estoque} un.
    </span>
  );
}

export function ProductCard({ produto, onClick }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const [depositosAberto, setDepositosAberto] = useState(false);

  const temImagem = produto.url_imagem && !imgError;
  const temDepositos = produto.depositos && produto.depositos.length > 0;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer group"
      onClick={() => onClick?.(produto)}
    >
      {/* Imagem */}
      <div className="relative h-44 bg-gray-50 flex items-center justify-center overflow-hidden">
        {temImagem ? (
          <img
            src={produto.url_imagem}
            alt={produto.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-300">
            <Package size={40} strokeWidth={1} />
            <span className="text-xs text-gray-400">Sem imagem</span>
          </div>
        )}
        {/* Badge de status sobreposto */}
        <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
          <StockBadge estoque={produto.estoque} />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Nome + SKU */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
            {produto.nome}
          </h3>
          {produto.sku && (
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{produto.sku}</p>
          )}
        </div>

        {/* Preço */}
        {(produto.preco ?? 0) > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-gray-900">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco ?? 0)}
            </span>
            {(produto.preco_promocional ?? 0) > 0 && (produto.preco_promocional ?? 0) < (produto.preco ?? 0) && (
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full">
                Promo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco_promocional ?? 0)}
              </span>
            )}
          </div>
        )}

        {/* Depósitos compactos (sempre visíveis) */}
        {temDepositos && (
          <div className="mt-auto pt-2 border-t border-gray-50">
            <button
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 transition-colors"
              onClick={e => {
                e.stopPropagation();
                setDepositosAberto(v => !v);
              }}
            >
              <span className="font-medium">
                {produto.depositos.length} depósito{produto.depositos.length > 1 ? 's' : ''}
              </span>
              {depositosAberto
                ? <ChevronUp size={14} />
                : <ChevronDown size={14} />
              }
            </button>

            {depositosAberto && (
              <div className="mt-2" onClick={e => e.stopPropagation()}>
                <DepositosPanel
                  depositos={produto.depositos}
                  estoqueTotal={produto.estoque}
                  compact={false}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
