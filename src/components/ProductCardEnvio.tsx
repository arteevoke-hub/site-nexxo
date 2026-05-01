import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ProdutoEnvio {
  id_produto_tiny: number | null;
  nome_produto: string;
  qtd_ml: number;
  qtd_shopee: number;
  qtd_amazon: number;
  total_geral: number;
  url_imagem?: string;
  sku?: string;
  estoque_meike?: number; // saldo vivo do depósito Meikê via Tiny ERP
}

interface ProductCardEnvioProps {
  produto: ProdutoEnvio;
}

export function ProductCardEnvio({ produto }: ProductCardEnvioProps) {
  const [imgError, setImgError] = useState(false);

  const estoqueMeike = produto.estoque_meike ?? 0;
  const precisaProduzir = estoqueMeike < produto.total_geral;
  const temImagem = !!produto.url_imagem && !imgError;

  // Cor para o valor de cada linha de estoque
  const stockColor = (val: number) => {
    if (val === 0) return 'text-rose-500'; 
    if (val > 0 && val < produto.total_geral) return 'text-amber-500'; 
    return 'text-emerald-500'; 
  };

  return (
    <div className="bg-[#181a25] border border-slate-800 shadow-xl hover:bg-slate-800/50 transition-all duration-200 flex flex-col font-sans rounded-none group">
      {/* Header: imagem + nome + SKU */}
      <div className="flex items-start gap-3 p-3 border-b border-slate-800/50">
        <div className="w-14 h-14 shrink-0 bg-slate-950 border border-slate-800 overflow-hidden rounded-none">
          {temImagem ? (
            <img
              src={produto.url_imagem}
              alt={produto.nome_produto}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-700 text-[9px] uppercase font-black tracking-widest">
              IMG
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-black text-white leading-tight uppercase line-clamp-2 tracking-tight group-hover:text-indigo-400 transition-colors">
            {produto.nome_produto}
          </h3>
          {produto.sku && (
            <p className="text-[10px] text-amber-500 font-mono mt-0.5 font-bold truncate">
              {produto.sku}
            </p>
          )}
        </div>

        {/* Badge PRODUZIR */}
        {precisaProduzir && (
          <div className="shrink-0 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-none">
            <AlertTriangle size={9} />
            PRODUZIR
          </div>
        )}
      </div>

      {/* Quantidades por canal */}
      <div className="px-3 pt-3 pb-1">
        <div className="grid grid-cols-4 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
          <span>Qntd</span>
          <span>Shopee</span>
          <span>ML</span>
          <span>Amazon</span>
        </div>
        <div className="grid grid-cols-4 text-[22px] font-black text-white leading-none tracking-tighter">
          <span className="text-indigo-400">{produto.total_geral}</span>
          <span>{produto.qtd_shopee || 0}</span>
          <span>{produto.qtd_ml || 0}</span>
          <span>{produto.qtd_amazon || 0}</span>
        </div>
      </div>

      {/* Estoque */}
      <div className="px-3 pt-3 pb-3 mt-auto">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1 mb-2">
          SITUAÇÃO DE ESTOQUE
        </div>
        <div className="space-y-0.5 text-[11px] font-semibold">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-500 uppercase text-[9px] font-bold">
              Depósito {localStorage.getItem('nexxo_selected_store') === 'ONN' ? 'Onn Store' : 'Meikê'}
            </span>
            <span className={`font-black text-[13px] font-mono ${stockColor(estoqueMeike)}`}>
              {estoqueMeike}
            </span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-500 uppercase text-[9px] font-bold">Full Amazon | FBA</span>
            <span className={`font-black text-[13px] font-mono ${stockColor(produto.qtd_amazon || 0)}`}>
              {produto.qtd_amazon || 0}
            </span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-500 uppercase text-[9px] font-bold">Full ML</span>
            <span className={`font-black text-[13px] font-mono ${stockColor(produto.qtd_ml || 0)}`}>
              {produto.qtd_ml || 0}
            </span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-500 uppercase text-[9px] font-bold">Full Shopee</span>
            <span className={`font-black text-[13px] font-mono ${stockColor(produto.qtd_shopee || 0)}`}>
              {produto.qtd_shopee || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
