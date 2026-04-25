import { useState, useEffect, useCallback, useRef } from 'react';
import type { Produto, FiltroEstoque, OrdenacaoProduto } from '../types/tiny';

interface UseTinyERPReturn {
  produtos: Produto[];
  loading: boolean;
  error: string | null;
  isMock: boolean;
  isCached: boolean;
  totalProdutos: number;
  totalEstoque: number;
  produtosZerados: number;
  produtosBaixo: number;
  busca: string;
  setBusca: (v: string) => void;
  filtro: FiltroEstoque;
  setFiltro: (v: FiltroEstoque) => void;
  ordenacao: OrdenacaoProduto;
  setOrdenacao: (v: OrdenacaoProduto) => void;
  produtosFiltrados: Produto[];
  recarregar: () => void;
  limparCache: () => Promise<void>;
  lastUpdated: Date | null;
}

const LIMITE_ESTOQUE_BAIXO = 10;

export function useTinyERP(): UseTinyERPReturn {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Busca com debounce
  const [busca, setBuscaRaw] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setBusca = useCallback((valor: string) => {
    setBuscaRaw(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBuscaDebounced(valor.trim());
    }, 400); // 400ms debounce — evita chamada a cada tecla
  }, []);

  const [filtro, setFiltro] = useState<FiltroEstoque>('todos');
  const [ordenacao, setOrdenacao] = useState<OrdenacaoProduto>('nome');
  const [recarregarKey, setRecarregarKey] = useState(0);

  const recarregar = useCallback(() => {
    setRecarregarKey(k => k + 1);
  }, []);

  const limparCache = useCallback(async () => {
    try {
      await fetch('/api/tiny/cache/clear', { method: 'POST' });
      recarregar();
    } catch {
      // silencioso
    }
  }, [recarregar]);

  // Busca na API
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = buscaDebounced
      ? `/api/tiny/estoque?pesquisa=${encodeURIComponent(buscaDebounced)}`
      : '/api/tiny/estoque';

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;

        if (data?.error) {
          setError(data.error);
          return;
        }

        const rawProdutos: any[] = data?.retorno?.produtos ?? [];
        const parsed: Produto[] = rawProdutos.map((item: any) => {
          // O server.ts envolve em { produto: { ... } }
          const p = item?.produto ?? item;
          return {
            id: String(p.id ?? ''),
            nome: p.nome ?? 'Sem nome',
            sku: p.sku ?? p.codigo ?? '',
            codigo: p.codigo ?? '',
            estoque: parseFloat(p.estoque ?? '0') || 0,
            preco: parseFloat(p.preco ?? '0') || 0,
            preco_promocional: parseFloat(p.preco_promocional ?? '0') || 0,
            url_imagem: p.url_imagem ?? '',
            situacao: p.situacao ?? 'A',
            depositos: Array.isArray(p.depositos) ? p.depositos : [],
          };
        });

        setProdutos(parsed);
        setIsMock(!!data?.retorno?._mock);
        setIsCached(!!data?._cached);
        setLastUpdated(new Date());
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message ?? 'Erro ao conectar com o servidor.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [buscaDebounced, recarregarKey]);

  // Filtro + ordenação (no cliente, sem nova chamada à API)
  const produtosFiltrados: Produto[] = produtos
    .filter(p => {
      if (filtro === 'disponivel') return p.estoque > LIMITE_ESTOQUE_BAIXO;
      if (filtro === 'baixo') return p.estoque > 0 && p.estoque <= LIMITE_ESTOQUE_BAIXO;
      if (filtro === 'zerado') return p.estoque === 0;
      return true;
    })
    .sort((a, b) => {
      switch (ordenacao) {
        case 'estoque_asc': return a.estoque - b.estoque;
        case 'estoque_desc': return b.estoque - a.estoque;
        case 'preco_asc': return (a.preco ?? 0) - (b.preco ?? 0);
        case 'preco_desc': return (b.preco ?? 0) - (a.preco ?? 0);
        default: return a.nome.localeCompare(b.nome, 'pt-BR');
      }
    });

  // Métricas
  const totalEstoque = produtos.reduce((acc, p) => acc + p.estoque, 0);
  const produtosZerados = produtos.filter(p => p.estoque === 0).length;
  const produtosBaixo = produtos.filter(p => p.estoque > 0 && p.estoque <= LIMITE_ESTOQUE_BAIXO).length;

  return {
    produtos,
    loading,
    error,
    isMock,
    isCached,
    totalProdutos: produtos.length,
    totalEstoque,
    produtosZerados,
    produtosBaixo,
    busca,
    setBusca,
    filtro,
    setFiltro,
    ordenacao,
    setOrdenacao,
    produtosFiltrados,
    recarregar,
    limparCache,
    lastUpdated,
  };
}
