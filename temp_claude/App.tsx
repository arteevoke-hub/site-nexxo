import { useState } from 'react';
import { LayoutGrid, Bot, RefreshCw, Trash2 } from 'lucide-react';
import { useTinyERP } from './hooks/useTinyERP';
import { ProductCard } from './components/ProductCard';
import { DepositosPanel } from './components/DepositosPanel';
import { SearchBar } from './components/SearchBar';
import { StatsBar } from './components/StatsBar';
import { ProductModal } from './components/ProductModal';
import { AgenteIA } from './components/AgenteIA';
import type { Produto, OrdenacaoProduto } from './types/tiny';
import { ChevronDown, List, AlertCircle } from 'lucide-react';

// ── Skeleton ──
function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-5 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

// ── Row view ──
function ProductRow({ produto, onClick }: { produto: Produto; onClick: () => void }) {
  const cor = produto.estoque === 0
    ? 'text-red-600 bg-red-50'
    : produto.estoque <= 10
    ? 'text-amber-700 bg-amber-50'
    : 'text-emerald-700 bg-emerald-50';

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm cursor-pointer transition-all" onClick={onClick}>
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0 flex items-center justify-center">
        {produto.url_imagem
          ? <img src={produto.url_imagem} alt={produto.nome} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : <span className="text-gray-300 text-xs">—</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{produto.nome}</p>
        {produto.sku && <p className="text-xs text-gray-400 font-mono">{produto.sku}</p>}
      </div>
      <div className="hidden sm:flex min-w-0 w-48">
        <DepositosPanel depositos={produto.depositos} estoqueTotal={produto.estoque} compact />
      </div>
      {(produto.preco ?? 0) > 0 && (
        <div className="hidden md:block text-right w-24">
          <p className="text-sm font-semibold text-gray-900 tabular-nums">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco ?? 0)}
          </p>
        </div>
      )}
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums flex-shrink-0 ${cor}`}>
        {produto.estoque === 0 ? 'Zerado' : `${produto.estoque} un.`}
      </span>
    </div>
  );
}

// ── Aba Estoque ──
function AbaEstoque() {
  const {
    loading, error, isMock, isCached, lastUpdated,
    totalProdutos, totalEstoque, produtosBaixo, produtosZerados,
    busca, setBusca, filtro, setFiltro,
    ordenacao, setOrdenacao, produtosFiltrados,
    recarregar, limparCache,
  } = useTinyERP();

  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const ordenacaoOpts: { value: OrdenacaoProduto; label: string }[] = [
    { value: 'nome', label: 'Nome (A–Z)' },
    { value: 'estoque_asc', label: 'Estoque ↑' },
    { value: 'estoque_desc', label: 'Estoque ↓' },
    { value: 'preco_asc', label: 'Preço ↑' },
    { value: 'preco_desc', label: 'Preço ↓' },
  ];

  return (
    <div className="space-y-5">
      <StatsBar
        totalProdutos={totalProdutos}
        totalEstoque={totalEstoque}
        produtosBaixo={produtosBaixo}
        produtosZerados={produtosZerados}
        filtro={filtro}
        setFiltro={setFiltro}
      />

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex-1">
          <SearchBar value={busca} onChange={setBusca} loading={loading} placeholder="Buscar por nome, SKU ou código..." />
        </div>
        <div className="relative flex-shrink-0">
          <select
            value={ordenacao}
            onChange={e => setOrdenacao(e.target.value as OrdenacaoProduto)}
            className="appearance-none pl-3 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            {ordenacaoOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white flex-shrink-0">
          <button onClick={() => setViewMode('grid')} className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`} title="Grade">
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`} title="Lista">
            <List size={16} />
          </button>
        </div>
      </div>

      {!loading && !error && (
        <p className="text-xs text-gray-400">
          {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''}
          {filtro !== 'todos' && ` · filtro: ${filtro}`}
          {busca && ` · busca: "${busca}"`}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erro ao carregar produtos</p>
            <p className="mt-0.5 text-red-600">{error}</p>
            <button onClick={recarregar} className="mt-2 text-xs underline font-medium">Tentar novamente</button>
          </div>
        </div>
      )}

      {loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)}
        </div>
      )}

      {!loading && !error && produtosFiltrados.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {produtosFiltrados.map(p => <ProductCard key={p.id} produto={p} onClick={setProdutoSelecionado} />)}
        </div>
      )}

      {!loading && !error && produtosFiltrados.length > 0 && viewMode === 'list' && (
        <div className="flex flex-col gap-2">
          {produtosFiltrados.map(p => <ProductRow key={p.id} produto={p} onClick={() => setProdutoSelecionado(p)} />)}
        </div>
      )}

      {!loading && !error && produtosFiltrados.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium text-gray-500">Nenhum produto encontrado</p>
          {busca && <button onClick={() => setBusca('')} className="mt-2 text-sm text-blue-500 underline">Limpar busca</button>}
        </div>
      )}

      <ProductModal produto={produtoSelecionado} onClose={() => setProdutoSelecionado(null)} />
    </div>
  );
}

// ─── App principal com navegação por abas ────
type Aba = 'estoque' | 'agente';

export default function App() {
  const [aba, setAba] = useState<Aba>('estoque');

  const { loading, isMock, isCached, lastUpdated, recarregar, limparCache } = useTinyERP();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-0 flex items-center gap-0">

          {/* Logo */}
          <div className="flex items-center gap-2 pr-6 py-3 border-r border-gray-100">
            <span className="text-base font-bold text-gray-900 tracking-tight">Meikê</span>
            {isMock && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Demo</span>}
            {isCached && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-500">Cache</span>}
          </div>

          {/* Abas de navegação */}
          <nav className="flex flex-1 px-4 gap-1">
            <button
              onClick={() => setAba('estoque')}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                aba === 'estoque'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid size={15} />
              Estoque
            </button>
            <button
              onClick={() => setAba('agente')}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                aba === 'agente'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bot size={15} />
              Agente IA
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-semibold">novo</span>
            </button>
          </nav>

          {/* Ações do header */}
          <div className="flex items-center gap-2 pl-4 border-l border-gray-100 py-3">
            {lastUpdated && (
              <span className="text-xs text-gray-400 hidden md:inline">
                {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={() => limparCache()} title="Limpar cache" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Trash2 size={15} />
            </button>
            <button onClick={recarregar} title="Recarregar" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      {aba === 'estoque' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <AbaEstoque />
        </main>
      )}

      {aba === 'agente' && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 h-[calc(100vh-57px)]">
          <AgenteIA />
        </main>
      )}
    </div>
  );
}
