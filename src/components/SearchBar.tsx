import { Search, X, Loader2 } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export function SearchBar({ value, onChange, loading = false, placeholder = 'Buscar produto, SKU...' }: SearchBarProps) {
  return (
    <div className="relative flex items-center w-full">
      {/* Ícone esquerdo */}
      <div className="absolute left-3 text-gray-400 pointer-events-none">
        {loading
          ? <Loader2 size={16} className="animate-spin text-blue-500" />
          : <Search size={16} />
        }
      </div>

      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-gray-200 rounded-xl
                   placeholder:text-gray-400 text-gray-900
                   focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                   transition-all duration-150"
      />

      {/* Botão limpar */}
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Limpar busca"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
