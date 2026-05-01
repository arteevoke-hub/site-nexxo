import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Loader2, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, Sparkles,
  Package, RefreshCw, Trash2, Paperclip, FileSpreadsheet, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

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
      rounded-none border text-sm overflow-hidden
      ${msg.sucesso === false
        ? 'border-rose-500/30 bg-rose-500/5 text-rose-200'
        : concluido
        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
        : 'border-white/30 bg-white/5 animate-pulse text-white'
      }
    `}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => concluido && setAberto(v => !v)}
      >
        <span className="text-base">{icone}</span>
        <span className="flex-1 font-bold tracking-tight uppercase text-[10px]">{nome}</span>
        {!concluido && <Loader2 size={14} className="animate-spin text-blue-500" />}
        {msg.sucesso === true && <CheckCircle2 size={14} className="text-emerald-600" />}
        {msg.sucesso === false && <XCircle size={14} className="text-red-500" />}
        {concluido && (aberto ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />)}
      </div>

      {aberto && concluido && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-800">
          {/* Input */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2 mb-1">Parâmetros</p>
            <pre className="text-xs bg-slate-950/70 border border-slate-800 rounded-none p-2 overflow-x-auto text-slate-300 leading-relaxed font-mono">
              {JSON.stringify(msg.input, null, 2)}
            </pre>
          </div>
          {/* Resultado */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Resultado</p>
            <pre className="text-xs bg-slate-950/70 border border-slate-800 rounded-none p-2 overflow-x-auto text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
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
  const [anexo, setAnexo] = useState<{nome: string, csv: string} | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_csv(ws);
      setAnexo({ nome: file.name, csv: data });
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const downloadCSV = (csv: string) => {
    const startIdx = csv.indexOf('ID kit');
    const cleanCsv = startIdx >= 0 ? csv.substring(startIdx) : csv;
    
    const blob = new Blob([cleanCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'planilha_gerada_ia.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    const conteudoBase = (texto ?? input).trim();
    if ((!conteudoBase && !anexo) || carregando) return;
    setInput('');
    setErro(null);

    let conteudoEnvio = conteudoBase;
    let nomeAnexo = '';
    if (anexo) {
      conteudoEnvio += `\n\n[PLANILHA ANEXADA - ${anexo.nome}]\n\`\`\`csv\n${anexo.csv}\n\`\`\``;
      nomeAnexo = anexo.nome;
      setAnexo(null);
    }

    const msgUsuario: MensagemTexto = {
      tipo: 'texto',
      role: 'user',
      conteudo: conteudoBase || `[Planilha enviada: ${nomeAnexo}]`,
      timestamp: new Date(),
    };

    setMensagens(prev => [...prev, msgUsuario]);
    setCarregando(true);

    const historico = [
      ...historicoAPI(),
      { role: 'user', content: conteudoEnvio },
    ];

    try {
      const store = localStorage.getItem('nexxo_selected_store') || 'MEIKE';
      const res = await fetch('/api/agente', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-nexxo-store': store
        },
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
    <div className="flex flex-col h-full max-h-[calc(100vh-80px)] bg-slate-950">

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-none bg-white flex items-center justify-center">
            <Sparkles size={18} className="text-black" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Agente IA — Tiny ERP</h2>
            <p className="text-xs text-slate-500 font-mono">Processamento de Linguagem Natural Operacional</p>
          </div>
        </div>
        <button
          onClick={limparChat}
          title="Limpar conversa"
          className="p-2 rounded-none text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {/* Estado inicial vazio */}
        {mensagens.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
            <div className="w-16 h-16 rounded-none bg-white/10 border border-white/20 flex items-center justify-center">
              <Package size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Pronto para operar no Tiny ERP</h3>
              <p className="text-sm text-slate-400 max-w-sm font-mono uppercase text-[10px] tracking-widest">
                Interface de Automação por Voz e Texto
              </p>
            </div>
            {/* Sugestões */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGESTOES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => enviar(s)}
                  className="text-[10px] px-3 py-1.5 rounded-none border border-slate-800 bg-slate-900 text-slate-400 hover:border-white hover:text-white hover:bg-white/10 transition-all font-black uppercase tracking-tighter"
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
                w-8 h-8 rounded-none flex items-center justify-center flex-shrink-0 mt-1
                ${isUser
                  ? 'bg-slate-800'
                  : 'bg-white'
                }
              `}>
                {isUser
                  ? <User size={14} className="text-gray-600" />
                  : <Bot size={14} className="text-black" />
                }
              </div>

              {/* Balão */}
              <div className={`
                px-4 py-3 rounded-none text-sm leading-relaxed max-w-[80%] whitespace-pre-wrap border
                ${isUser
                  ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.1)] font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-200 shadow-sm'
                }
              `}>
                {msg.conteudo}
                {msg.conteudo.includes('ID kit') && !isUser && (
                  <button onClick={() => downloadCSV(msg.conteudo)} className="mt-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-none text-sm font-bold transition-colors shadow-lg uppercase tracking-tighter">
                     <Download size={16} /> Baixar Planilha CSV
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Indicador de digitação */}
        {carregando && mensagens[mensagens.length - 1]?.tipo !== 'ferramenta' && (
          <div className="flex gap-3 max-w-2xl mx-auto w-full">
            <div className="w-8 h-8 rounded-none bg-white flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-black" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-none px-4 py-3 shadow-sm">
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
          <div className="max-w-2xl mx-auto w-full flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-none text-sm text-rose-400">
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
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          {anexo && (
            <div className="flex items-center gap-2 bg-white/10 text-white px-3 py-1.5 rounded-none mb-2 text-sm w-fit border border-white/20">
              <FileSpreadsheet size={14} />
              <span className="font-bold">{anexo.nome}</span>
              <button onClick={() => setAnexo(null)} className="ml-2 hover:text-white transition-colors"><XCircle size={14} /></button>
            </div>
          )}
          <div className="flex gap-3 items-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-11 h-11 rounded-none bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-all flex-shrink-0 mb-0.5 text-slate-400 border border-slate-700"
              title="Anexar Planilha (CSV, XLS)"
            >
              <Paperclip size={18} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.xls,.xlsx"
              className="hidden"
            />
            <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite os comandos operacionais..."
            rows={2}
            disabled={carregando}
            className="flex-1 resize-none px-4 py-3 text-sm bg-slate-950 border border-slate-800 rounded-none
                       placeholder:text-slate-600 text-slate-200
                       focus:outline-none focus:ring-1 focus:ring-white focus:border-white
                       disabled:opacity-50 transition-all leading-relaxed font-mono"
          />
          <button
            onClick={() => enviar()}
            disabled={!input.trim() || carregando}
            className="w-11 h-11 rounded-none bg-white hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center transition-all flex-shrink-0 mb-0.5 shadow-lg"
          >
            {carregando
              ? <Loader2 size={16} className="text-black animate-spin" />
              : <Send size={16} className="text-black" />
            }
          </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
