export interface Deposito {
  nome: string;
  saldo: number;
}

export interface Produto {
  id: string;
  nome: string;
  sku?: string;
  codigo?: string;
  estoque: number;
  preco?: number;
  preco_promocional?: number;
  url_imagem?: string;
  situacao?: string;
  depositos: Deposito[];
}

export type FiltroEstoque = 'todos' | 'disponivel' | 'baixo' | 'zerado';
export type OrdenacaoProduto = 'nome' | 'estoque_asc' | 'estoque_desc' | 'preco_asc' | 'preco_desc';
