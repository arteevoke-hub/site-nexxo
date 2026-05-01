import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Loader2, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, Sparkles,
  Package, RefreshCw, Trash2
} from 'lucide-react';

// ─── Tipos ───────────────────────────────────
interface MensagemTexto {
  tipo: 'texto';
  role: 'user' | 'assistant';
  conteudo: string;
  timestamp: Date;
}

interface MensagemFerramenta {
  tipo: 'ferramenta';
  nome: string;
  input: any;
  resultado?: string;
  sucesso?: boolean;
  id: string;
  timestamp: Date;
}

type Mensagem = MensagemTexto | MensagemFerramenta;

// Mapa de nomes amigáveis para as ferramentas
const NOMES_FERRAMENTAS: Record<string, string> = {
  buscar_produtos: 'Buscando produtos no Tiny',
  obter_produto: 'Obtendo detalhes do produto',
  criar_produto_com_variacoes: 'Criando produto com variações',
  criar_kit: 'Criando kit/combo',
  atualizar_produto: 'Atualizando produto',
  duplicar_como_variacoes: 'Duplicando produto como variações',
};

const ICONES_FERRAMENTAS: Record<string, string> = {
  buscar_produtos: '🔍',
  obter_produto: '📋',
  criar_produto_com_variacoes: '✨',
  criar_kit: '📦',
  atualizar_produto: '✏️',
  duplicar_como_variacoes: '🔁',
};

// ─── Sugestões de prompts ────────────────────
const SUGESTOES = [
  'Busca todos os produtos de camiseta',
  'Cria variações P, M, G e GG do produto ID 123',
  'Monta um kit "Kit Verão" com os produtos 100, 200 e 300',
  'Mostra os detalhes do produto ID 456',
  'Atualiza o preço do produto 789 para R$99,90',
];

// ─── Componente de ferramenta ────────────────
function CartaoFerramenta({ msg }: { msg: MensagemFerramenta }) {
  const [aberto, setAberto] = useState(false);
  const nome = NOMES_FERRAMENTAS[msg.nome] ?? msg.nome;
  const icone = ICONES_FERRAMENTAS[msg.nome] ?? '⚙️';
  const concluido = msg.resultado !== undefined;

  return (
    <div className={`
      rounded-xl border text-sm overflow-hidden
      ${msg.sucesso === false
        ? 'border-red-200 bg-red-50'
        : concluido
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-blue-200 bg-blue-50 animate-pulse'
      }
    `}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => concluido && setAberto(v => !v)}
      >
        <span className="text-base">{icone}</span>
        <span className="flex-1 font-medium text-gray-700">{nome}</span>
        {!concluido && <Loader2 size={14} className="animate-spin text-blue-500" />}
        {msg.sucesso === true && <CheckCircle2 size={14} className="text-emerald-600" />}
        {msg.sucesso === false && <XCircle size={14} className="text-red-500" />}
        {concluido && (aberto ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />)}
      </div>

      {aberto && concluido && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-200">
          {/* Input */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2 mb-1">Parâmetros</p>
            <pre className="text-xs bg-white/70 rounded-lg p-2 overflow-x-auto text-gray-700 leading-relaxed">
              {JSON.stringify(msg.input, null, 2)}
            </pre>
          </div>
          {/* Resultado */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Resultado</p>
            <pre className="text-xs bg-white/70 rounded-lg p-2 overflow-x-auto text-gray-700 leading-relaxed whitespace-pre-wrap">
              {msg.resultado}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────
export function AgenteIA() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Histórico para a API (apenas mensagens de texto)
  const historicoAPI = () =>
    mensagens
      .filter(m => m.tipo === 'texto')
      .map(m => ({
        role: (m as MensagemTexto).role,
        content: (m as MensagemTexto).conteudo,
      }));

  const enviar = async (texto?: string) => {
    const conteudo = (texto ?? input).trim();
    if (!conteudo || carregando) return;
    setInput('');
    setErro(null);

    const msgUsuario: MensagemTexto = {
      tipo: 'texto',
      role: 'user',
      conteudo,
      timestamp: new Date(),
    };

    setMensagens(prev => [...prev, msgUsuario]);
    setCarregando(true);

    const historico = [
      ...historicoAPI(),
      { role: 'user', content: conteudo },
    ];

    try {
      const res = await fetch('/api/agente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: historico }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Erro HTTP ${res.status}`);
      }

      // Lê o stream SSE
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // Mapa de ferramentas em andamento por ID
      const ferramentasEmAndamento: Record<string, string> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const linhas = buffer.split('\n');
        buffer = linhas.pop() ?? '';

        for (const linha of linhas) {
          if (!linha.startsWith('data: ')) continue;
          try {
            const evento = JSON.parse(linha.slice(6));

            switch (evento.tipo) {
              case 'texto':
                setMensagens(prev => {
                  const ultima = prev[prev.length - 1];
                  // Acumula texto na última mensagem do assistente se já existir
                  if (ultima?.tipo === 'texto' && ultima.role === 'assistant') {
                    return [
                      ...prev.slice(0, -1),
                      { ...ultima, conteudo: ultima.conteudo + evento.conteudo },
                    ];
                  }
                  return [...prev, {
                    tipo: 'texto',
                    role: 'assistant',
                    conteudo: evento.conteudo,
                    timestamp: new Date(),
                  }];
                });
                break;

              case 'ferramenta_inicio':
                ferramentasEmAndamento[evento.id] = evento.id;
                setMensagens(prev => [...prev, {
                  tipo: 'ferramenta',
                  nome: evento.nome,
                  input: evento.input,
                  id: evento.id,
                  timestamp: new Date(),
                }]);
                break;

              case 'ferramenta_resultado':
                setMensagens(prev =>
                  prev.map(m =>
                    m.tipo === 'ferramenta' && m.id === evento.id
                      ? { ...m, resultado: evento.resultado, sucesso: evento.sucesso }
                      : m
                  )
                );
                break;

              case 'erro':
                setErro(evento.mensagem);
                break;
            }
          } catch {
            // linha inválida, ignora
          }
        }
      }
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao conectar com o agente.');
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const limparChat = () => {
    setMensagens([]);
    setErro(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  // ─── Render ───────────────────────────────
  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-80px)] bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Agente IA — Tiny ERP</h2>
            <p className="text-xs text-gray-400">Fale e eu executo no Tiny automaticamente</p>
          </div>
        </div>
        <button
          onClick={limparChat}
          title="Limpar conversa"
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {/* Estado inicial vazio */}
        {mensagens.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <Package size={32} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Pronto para trabalhar no Tiny</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Me diga o que fazer — posso buscar produtos, criar variações, montar kits e muito mais.
              </p>
            </div>
            {/* Sugestões */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGESTOES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => enviar(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensagens */}
        {mensagens.map((msg, i) => {
          if (msg.tipo === 'ferramenta') {
            return (
              <div key={i} className="max-w-2xl mx-auto w-full">
                <CartaoFerramenta msg={msg} />
              </div>
            );
          }

          const isUser = msg.role === 'user';
          return (
            <div key={i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} max-w-2xl mx-auto w-full`}>
              {/* Avatar */}
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
                ${isUser
                  ? 'bg-gray-200'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
                }
              `}>
                {isUser
                  ? <User size={14} className="text-gray-600" />
                  : <Bot size={14} className="text-white" />
                }
              </div>

              {/* Balão */}
              <div className={`
                px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[80%] whitespace-pre-wrap
                ${isUser
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                }
              `}>
                {msg.conteudo}
              </div>
            </div>
          );
        })}

        {/* Indicador de digitação */}
        {carregando && mensagens[mensagens.length - 1]?.tipo !== 'ferramenta' && (
          <div className="flex gap-3 max-w-2xl mx-auto w-full">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="max-w-2xl mx-auto w-full flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <XCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Erro</p>
              <p className="text-red-600 mt-0.5">{erro}</p>
            </div>
          </div>
        )}

        <div ref={fimRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Busca camisetas e cria variação P, M e G para cada uma..."
            rows={2}
            disabled={carregando}
            className="flex-1 resize-none px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl
                       placeholder:text-gray-400 text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                       disabled:opacity-50 transition-all leading-relaxed"
          />
          <button
            onClick={() => enviar()}
            disabled={!input.trim() || carregando}
            className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center transition-all flex-shrink-0 mb-0.5"
          >
            {carregando
              ? <Loader2 size={16} className="text-white animate-spin" />
              : <Send size={16} className="text-white" />
            }
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
