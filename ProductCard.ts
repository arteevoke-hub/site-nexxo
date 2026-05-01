import { useState } from 'react';
import { Package, ChevronDown, ChevronUp, Send } from 'lucide-react';
import type { Produto } from '../types/tiny';
import { DepositosPanel } from './DepositosPanel';

// Interface estendida para incluir a demanda de remessas do banco de dados
interface ProductCardProps {
  produto: Produto;
  demandas?: {
    ml: number;
    shopee: number;
    amazon: number;
    total: number;
  };
  onClick?: (produto: Produto) => void;
}

function StockBadge({ estoque, demandaTotal }: { estoque: number; demandaTotal: number }) {
  // Alerta de Produção: Se a demanda de envios for maior que o estoque no Depósito Meikê[cite: 1]
  const precisaProduzir = demandaTotal > estoque;

  if (precisaProduzir) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white animate-pulse">
        PRODUZIR: Faltam {demandaTotal - estoque} un.
      </span>
    );
  }

  if (estoque === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
        Sem Estoque
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
      {estoque} un. no Meikê
    </span>
  );
}

export function ProductCard({ produto, demandas, onClick }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const [depositosAberto, setDepositosAberto] = useState(false);

  const temImagem = produto.url_imagem && !imgError;
  const temDepositos = produto.depositos && produto.depositos.length > 0;
  
  // Soma fictícia ou real vinda da query de agregação[cite: 1]
  const totalEnviando = demandas?.total || 0;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer group"
      onClick={() => onClick?.(produto)}
    >
      {/* Imagem e Badge de Produção */}
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
            <span className="text-xs">Sem imagem</span>
          </div>
        )}
        
        <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
          <StockBadge estoque={produto.estoque} demandaTotal={totalEnviando} />
        </div>
      </div>

      {/* Conteúdo Técnico */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight uppercase">
            {produto.nome}
          </h3>
          <p className="text-[10px] text-gray-400 mt-1 font-mono tracking-tighter">SKU: {produto.sku}</p>
        </div>

        {/* Seção de Remessas (O Coração do Projeto)[cite: 1] */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex items-center gap-2 mb-2 text-gray-600">
            <Send size={14} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Produtos à Enviar</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold uppercase">ML</span>
              <span className="text-sm font-black text-amber-500">{demandas?.ml || 0}</span>
            </div>
            <div className="flex flex-col border-x border-gray-200">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Shopee</span>
              <span className="text-sm font-black text-orange-600">{demandas?.shopee || 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Amazon</span>
              <span className="text-sm font-black text-gray-700">{demandas?.amazon || 0}</span>
            </div>
          </div>
          
          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-500">TOTAL DEMANDA:</span>
            <span className="text-xs font-black text-gray-900">{totalEnviando} un.</span>
          </div>
        </div>

        {/* Depósitos do Tiny (API) */}
        {temDepositos && (
          <div className="mt-auto">
            <button
              className="w-full flex items-center justify-between py-2 px-1 text-[11px] font-bold text-gray-500 border-t border-gray-50 hover:text-black"
              onClick={e => {
                e.stopPropagation();
                setDepositosAberto(v => !v);
              }}
            >
              <span>{produto.depositos.length} DEPÓSITOS (TINY)</span>
              {depositosAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {depositosAberto && (
              <div className="mt-1 pb-2" onClick={e => e.stopPropagation()}>
                <DepositosPanel
                  depositos={produto.depositos}
                  estoqueTotal={produto.estoque}
                  compact={true}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}