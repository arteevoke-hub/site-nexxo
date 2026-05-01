# =====================================================================
# LÓGICA DE CÁLCULO DE INSUMOS - REMESSA FULL (MEIKÊ)
# =====================================================================

def gerar_lista_compras_full(itens_remessa_full, banco_dados_tiny, estrutura_produtos):
    """
    itens_remessa_full: Dicionário com os produtos que vão para o Full e a quantidade (Ex: {'Kit Fatale*': 100})
    banco_dados_tiny: Dicionário com o estoque real de insumos no Tiny (Ex: {'Caixa Premium': 50})
    estrutura_produtos: Dicionário de como os kits são montados (A explosão de composição)
    """
    
    necessidade_total_insumos = {}
    lista_final_compras = []

    # 1. Filtro de Origem e 2. Explosão de Composição
    for sku_produto, quantidade_envio_full in itens_remessa_full.items():
        
        # Só processa se for Produto Acabado (identificado pelo asterisco *)
        if sku_produto.endswith('*'):
            
            # Pega a receita do kit no Tiny
            composicao = estrutura_produtos.get(sku_produto, {})
            
            # Multiplica a quantidade do insumo pela meta de envio do Full
            for sku_insumo, qtd_por_kit in composicao.items():
                qtd_total_necessaria = qtd_por_kit * quantidade_envio_full
                
                # Soma caso o mesmo insumo seja usado em kits diferentes da mesma remessa
                if sku_insumo in necessidade_total_insumos:
                    necessidade_total_insumos[sku_insumo] += qtd_total_necessaria
                else:
                    necessidade_total_insumos[sku_insumo] = qtd_total_necessaria

    # 3. A Regra de Exibição Final (O "Funil" de saldo insuficiente)
    for sku_insumo, qtd_necessaria in necessidade_total_insumos.items():
        estoque_atual = banco_dados_tiny.get(sku_insumo, 0)
        
        # Só entra na lista se o estoque for menor que a necessidade DA REMESSA
        if estoque_atual < qtd_necessaria:
            qtd_a_comprar = qtd_necessaria - estoque_atual
            
            lista_final_compras.append({
                "SKU_Insumo": sku_insumo,
                "Quantidade_Comprar": qtd_a_comprar,
                "Motivo": f"Estoque ({estoque_atual}) insuficiente para demanda Full ({qtd_necessaria})"
            })

    return lista_final_compras

# =====================================================================
# SIMULAÇÃO DE DADOS (Como a API do Tiny entregaria para o Antigravity)
# =====================================================================

# O que você quer mandar no app Remessa Full hoje:
remessa_atual = {
    "Kit Fatale*": 100,
    "Kit Especial Maes*": 50
}

# Como os kits são montados (o De-Para):
composicao_kits = {
    "Kit Fatale*": {
        "Batom Liquido": 1,
        "Body Splash": 1,
        "Caixa Preta": 1
    },
    "Kit Especial Maes*": {
        "Hidratante": 1,
        "Caixa Rosa": 1
    }
}

# O que o Tiny diz que tem de saldo real agora:
estoque_tiny = {
    "Batom Liquido": 120, # Tem o suficiente para os 100
    "Body Splash": 40,    # Faltam 60
    "Caixa Preta": 0,     # Faltam 100
    "Hidratante": 200,    # Tem o suficiente
    "Caixa Rosa": 10,     # Faltam 40
    "Glitter": 0          # Falta, mas NÃO ESTÁ na remessa (deve ser ignorado)
}

# =====================================================================
# EXECUTANDO A LÓGICA (O Output que vai pro seu Dashboard)
# =====================================================================

resultado = gerar_lista_compras_full(remessa_atual, estoque_tiny, composicao_kits)

for item in resultado:
    print(item)