import { useEffect, useState } from 'react';
import { X, Package, ExternalLink } from 'lucide-react';
import type { Produto } from '../types/tiny';
import { DepositosPanel } from './DepositosPanel';

interface ProductModalProps {
  produto: Produto | null;
  onClose: () => void;
}

export function ProductModal({ produto, onClose }: ProductModalProps) {
  const [imgError, setImgError] = useState(false);

  // Reset imgError quando produto muda
  useEffect(() => { setImgError(false); }, [produto?.id]);

  // Fechar com Escape
  useEffect(() => {
    if (!produto) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [produto, onClose]);

  if (!produto) return null;

  const temImagem = produto.url_imagem && !imgError;
  const estoqueColor = produto.estoque === 0
    ? 'text-red-600'
    : produto.estoque <= 10
    ? 'text-amber-600'
    : 'text-emerald-600';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header com imagem */}
        <div className="relative">
          {temImagem ? (
            <img
              src={produto.url_imagem}
              alt={produto.nome}
              className="w-full h-56 object-cover rounded-t-2xl"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-40 bg-gray-50 rounded-t-2xl flex items-center justify-center">
              <Package size={48} strokeWidth={1} className="text-gray-300" />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-1.5 hover:bg-white transition shadow-sm"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-5">
          {/* Nome e SKU */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{produto.nome}</h2>
            {produto.sku && (
              <p className="text-sm text-gray-400 font-mono mt-1">SKU: {produto.sku}</p>
            )}
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Estoque total</p>
              <p className={`text-2xl font-bold tabular-nums ${estoqueColor}`}>
                {produto.estoque}
              </p>
              <p className="text-xs text-gray-400">unidades</p>
            </div>
            {(produto.preco ?? 0) > 0 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">Preço</p>
                <p className="text-xl font-bold text-gray-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco ?? 0)}
                </p>
                {(produto.preco_promocional ?? 0) > 0 && (produto.preco_promocional ?? 0) < (produto.preco ?? 0) && (
                  <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                    Promo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco_promocional ?? 0)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Depósitos expandidos */}
          <div className="bg-gray-50 rounded-xl p-4">
            <DepositosPanel
              depositos={produto.depositos}
              estoqueTotal={produto.estoque}
              compact={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
