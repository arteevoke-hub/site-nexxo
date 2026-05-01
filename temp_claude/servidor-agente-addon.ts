// ═══════════════════════════════════════════════════════════════
// ADICIONE ESTE BLOCO NO FINAL DO SEU servidor.ts
// (antes do app.listen)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// AGENTE IA — rota /api/agente
// ─────────────────────────────────────────────

// Definição das ferramentas que o agente pode usar no Tiny ERP
const TINY_TOOLS = [
  {
    name: 'buscar_produtos',
    description: 'Busca produtos no Tiny ERP por nome, SKU ou código.',
    input_schema: {
      type: 'object',
      properties: {
        pesquisa: { type: 'string', description: 'Termo de busca: nome, SKU ou código' },
        pagina: { type: 'number', description: 'Página (padrão: 1)' },
      },
      required: ['pesquisa'],
    },
  },
  {
    name: 'obter_produto',
    description: 'Obtém todos os detalhes de um produto do Tiny pelo ID, incluindo variações, estoque por depósito e imagens.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do produto no Tiny ERP' },
      },
      required: ['id'],
    },
  },
  {
    name: 'criar_produto_com_variacoes',
    description: 'Cria um produto com variações (grade de tamanhos, cores etc) no Tiny ERP.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome do produto' },
        codigo: { type: 'string', description: 'SKU base' },
        preco: { type: 'number', description: 'Preço base' },
        unidade: { type: 'string', description: 'Unidade (padrão: UN)' },
        ncm: { type: 'string', description: 'NCM' },
        marca: { type: 'string' },
        categoria: { type: 'string' },
        descricao: { type: 'string' },
        variacoes: {
          type: 'array',
          description: 'Lista de variações',
          items: {
            type: 'object',
            properties: {
              grade1: { type: 'string', description: 'Ex: Tamanho: P' },
              grade2: { type: 'string', description: 'Ex: Cor: Azul' },
              codigo: { type: 'string' },
              preco: { type: 'number' },
              estoque: { type: 'number' },
            },
            required: ['grade1'],
          },
        },
      },
      required: ['nome', 'preco', 'variacoes'],
    },
  },
  {
    name: 'criar_kit',
    description: 'Cria um kit/combo no Tiny ERP composto por outros produtos.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        codigo: { type: 'string' },
        preco: { type: 'number' },
        descricao: { type: 'string' },
        categoria: { type: 'string' },
        componentes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID do produto componente' },
              codigo: { type: 'string' },
              quantidade: { type: 'number' },
            },
            required: ['quantidade'],
          },
        },
      },
      required: ['nome', 'preco', 'componentes'],
    },
  },
  {
    name: 'atualizar_produto',
    description: 'Atualiza dados de um produto existente no Tiny.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do produto no Tiny' },
        nome: { type: 'string' },
        preco: { type: 'number' },
        preco_promocional: { type: 'number' },
        ncm: { type: 'string' },
        descricao: { type: 'string' },
        marca: { type: 'string' },
        categoria: { type: 'string' },
        situacao: { type: 'string', enum: ['A', 'I'], description: 'A = Ativo, I = Inativo' },
      },
      required: ['id'],
    },
  },
  {
    name: 'duplicar_como_variacoes',
    description: 'Busca um produto existente no Tiny e cria uma versão nova com variações baseada nele.',
    input_schema: {
      type: 'object',
      properties: {
        id_original: { type: 'string', description: 'ID do produto original' },
        novo_nome: { type: 'string' },
        variacoes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              grade1: { type: 'string' },
              grade2: { type: 'string' },
              sufixo_codigo: { type: 'string' },
              preco: { type: 'number' },
              estoque: { type: 'number' },
            },
            required: ['grade1'],
          },
        },
      },
      required: ['id_original', 'variacoes'],
    },
  },
];

// Executor das ferramentas — chama a API do Tiny
async function executarFerramenta(nome: string, input: any, token: string): Promise<string> {
  const BASE = 'https://api.tiny.com.br/api2';

  const get = async (endpoint: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams({ token, formato: 'json', ...params });
    const r = await fetch(`${BASE}/${endpoint}?${qs}`);
    const d = await r.json() as any;
    if (d?.retorno?.status === 'Erro') {
      throw new Error(d.retorno.erros?.map((e: any) => e.erro).join(', '));
    }
    return d?.retorno;
  };

  const post = async (endpoint: string, xml: string) => {
    const body = new URLSearchParams({ token, formato: 'json', xml });
    const r = await fetch(`${BASE}/${endpoint}`, { method: 'POST', body });
    const d = await r.json() as any;
    if (d?.retorno?.status === 'Erro') {
      throw new Error(d.retorno.erros?.map((e: any) => e.erro).join(', '));
    }
    return d?.retorno;
  };

  const campo = (tag: string, val: any) =>
    val != null && val !== '' ? `<${tag}>${String(val).replace(/&/g, '&amp;')}</${tag}>` : '';

  switch (nome) {
    case 'buscar_produtos': {
      const r = await get('produtos.pesquisa.php', { pesquisa: input.pesquisa, pagina: String(input.pagina ?? 1) });
      const lista = (r?.produtos ?? []).map((p: any) =>
        `ID: ${p.produto.id} | ${p.produto.nome} | SKU: ${p.produto.sku ?? '—'} | Estoque: ${p.produto.estoque ?? '?'} | R$${p.produto.preco ?? '?'}`
      ).join('\n');
      return lista || 'Nenhum produto encontrado.';
    }

    case 'obter_produto': {
      const [det, est] = await Promise.all([
        get('produto.obter.php', { id: input.id }),
        get('produto.obter.estoque.php', { id: input.id }),
      ]);
      return JSON.stringify({
        ...det?.produto,
        estoque_total: est?.produto?.estoque,
        depositos: est?.produto?.depositos,
      }, null, 2);
    }

    case 'criar_produto_com_variacoes': {
      const varXml = (input.variacoes ?? []).map((v: any) => `<variacao>
        ${campo('grade1', v.grade1)}${campo('grade2', v.grade2)}
        ${campo('codigo', v.codigo)}${campo('preco', v.preco ?? input.preco)}
        ${campo('estoque', v.estoque ?? 0)}
      </variacao>`).join('');
      const xml = `<produto>
        ${campo('nome', input.nome)}${campo('codigo', input.codigo)}
        ${campo('preco', input.preco)}${campo('tipo', 'V')}
        ${campo('unidade', input.unidade ?? 'UN')}${campo('ncm', input.ncm)}
        ${campo('marca', input.marca)}${campo('categoria', input.categoria)}
        ${campo('descricao', input.descricao)}
        <variacoes>${varXml}</variacoes>
      </produto>`;
      const r = await post('produto.incluir.php', xml);
      const id = r?.registros?.[0]?.registro?.id ?? '?';
      return `Produto "${input.nome}" criado com sucesso! ID: ${id}. ${input.variacoes.length} variações cadastradas: ${input.variacoes.map((v: any) => v.grade1 + (v.grade2 ? '/' + v.grade2 : '')).join(', ')}.`;
    }

    case 'criar_kit': {
      const compXml = (input.componentes ?? []).map((c: any) => `<componente>
        ${campo('id', c.id)}${campo('codigo', c.codigo)}${campo('quantidade', c.quantidade)}
      </componente>`).join('');
      const xml = `<produto>
        ${campo('nome', input.nome)}${campo('codigo', input.codigo)}
        ${campo('preco', input.preco)}${campo('tipo', 'K')}
        ${campo('unidade', 'UN')}${campo('descricao', input.descricao)}
        ${campo('categoria', input.categoria)}
        <componentes>${compXml}</componentes>
      </produto>`;
      const r = await post('produto.incluir.php', xml);
      const id = r?.registros?.[0]?.registro?.id ?? '?';
      return `Kit "${input.nome}" criado! ID: ${id}. Composto por ${input.componentes.length} produto(s).`;
    }

    case 'atualizar_produto': {
      const xml = `<produto>
        ${campo('id', input.id)}${campo('nome', input.nome)}
        ${campo('preco', input.preco)}${campo('preco_promocional', input.preco_promocional)}
        ${campo('ncm', input.ncm)}${campo('descricao', input.descricao)}
        ${campo('marca', input.marca)}${campo('categoria', input.categoria)}
        ${campo('situacao', input.situacao)}
      </produto>`;
      await post('produto.alterar.php', xml);
      return `Produto ID ${input.id} atualizado com sucesso!`;
    }

    case 'duplicar_como_variacoes': {
      const det = await get('produto.obter.php', { id: input.id_original });
      const orig = det?.produto ?? {};
      const varXml = (input.variacoes ?? []).map((v: any) => `<variacao>
        ${campo('grade1', v.grade1)}${campo('grade2', v.grade2)}
        ${campo('codigo', orig.codigo ? `${orig.codigo}-${v.sufixo_codigo ?? v.grade1.split(':').pop()?.trim()}` : '')}
        ${campo('preco', v.preco ?? orig.preco)}${campo('estoque', v.estoque ?? 0)}
      </variacao>`).join('');
      const xml = `<produto>
        ${campo('nome', input.novo_nome ?? orig.nome)}
        ${campo('codigo', orig.codigo ? orig.codigo + '-GRADE' : '')}
        ${campo('preco', orig.preco)}${campo('tipo', 'V')}
        ${campo('unidade', orig.unidade ?? 'UN')}${campo('ncm', orig.ncm)}
        ${campo('marca', orig.marca)}${campo('categoria', orig.categoria)}
        ${campo('descricao', orig.descricao)}
        <variacoes>${varXml}</variacoes>
      </produto>`;
      const r = await post('produto.incluir.php', xml);
      const id = r?.registros?.[0]?.registro?.id ?? '?';
      return `Produto "${input.novo_nome ?? orig.nome}" criado com variações a partir do ID ${input.id_original}. Novo ID: ${id}.`;
    }

    default:
      return `Ferramenta "${nome}" não reconhecida.`;
  }
}

// Rota principal do agente — suporta streaming SSE
app.post('/api/agente', async (req, res) => {
  const { mensagens } = req.body as { mensagens: any[] };
  const tinyToken = process.env.TINY_API_TOKEN ?? '';
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? '';

  if (!anthropicKey) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY não configurada no .env' });
  }

  // Configura SSE para streaming de eventos para o frontend
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const enviar = (tipo: string, dados: any) => {
    res.write(`data: ${JSON.stringify({ tipo, ...dados })}\n\n`);
  };

  try {
    let historico = [...mensagens];
    let rodadas = 0;
    const MAX_RODADAS = 10; // evita loop infinito

    while (rodadas < MAX_RODADAS) {
      rodadas++;

      // Chama a API do Claude
      const resposta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 4096,
          system: `Você é um agente especializado no Tiny ERP, integrado ao Dashboard Meikê.
Você tem acesso às ferramentas do Tiny ERP e pode executar tarefas autonomamente.
Quando o usuário pedir para fazer algo, use as ferramentas disponíveis para executar.
Sempre confirme o que foi feito após executar. Responda sempre em português brasileiro.
Se precisar de informações adicionais para completar uma tarefa, pergunte antes de executar.`,
          messages: historico,
          tools: TINY_TOOLS,
        }),
      });

      const dados = await resposta.json() as any;

      if (!resposta.ok) {
        enviar('erro', { mensagem: dados.error?.message ?? 'Erro na API do Claude' });
        break;
      }

      // Processa blocos de resposta
      for (const bloco of dados.content ?? []) {
        if (bloco.type === 'text') {
          // Texto da resposta do agente
          enviar('texto', { conteudo: bloco.text });
        } else if (bloco.type === 'tool_use') {
          // Agente decidiu usar uma ferramenta
          enviar('ferramenta_inicio', {
            nome: bloco.name,
            input: bloco.input,
            id: bloco.id,
          });

          try {
            const resultado = await executarFerramenta(bloco.name, bloco.input, tinyToken);
            enviar('ferramenta_resultado', { id: bloco.id, resultado, sucesso: true });

            // Adiciona resultado ao histórico para o Claude continuar
            historico.push({ role: 'assistant', content: dados.content });
            historico.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: bloco.id,
                content: resultado,
              }],
            });
          } catch (err: any) {
            const erroMsg = err.message ?? 'Erro ao executar ferramenta';
            enviar('ferramenta_resultado', { id: bloco.id, resultado: erroMsg, sucesso: false });
            historico.push({ role: 'assistant', content: dados.content });
            historico.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: bloco.id,
                content: `ERRO: ${erroMsg}`,
                is_error: true,
              }],
            });
          }
        }
      }

      // Se o agente terminou (sem mais ferramentas), encerra o loop
      if (dados.stop_reason === 'end_turn') break;
      if (dados.stop_reason !== 'tool_use') break;
    }

    enviar('fim', { rodadas });
  } catch (err: any) {
    enviar('erro', { mensagem: err.message ?? 'Erro interno' });
  } finally {
    res.end();
  }
});
