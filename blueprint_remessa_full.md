### BLUEPRINT TÉCNICO: SISTEMA DE REMESSA FULL MEIKÊ BEAUTY

#### 1. ESCOPO DE NAVEGAÇÃO E INTERFACE (UI)
*   **Abas de Filtro**: Implementar navegação entre 'Todas', 'Mercado Livre', 'Shopee', 'Amazon' e 'Arquivados'[cite: 1].
*   **Lógica de Arquivamento**: Remessas com status 'concluido' ou 'cancelado' devem ser movidas para a aba 'Arquivados', saindo da visualização principal de operação[cite: 1].
*   **Estética Industrial**: Manter o design limpo, direto, com textos em caixa alta para facilitar a leitura operacional[cite: 2].

#### 2. LÓGICA DE AGREGAÇÃO E CÁLCULO (O "CÉREBRO")
*   **Consolidação Dinâmica**: O sistema deve realizar a soma (Aggregation) de todas as unidades de um mesmo SKU (via id_produto_tiny) presentes em diferentes documentos de remessa com status 'pendente'[cite: 1, 2].
*   **Exemplo de Funcionamento**: Se houver remessas de 50 un. para Amazon, 50 un. para ML e 50 un. para Shopee, o ProductCard deve exibir o total de 150 unidades a enviar[cite: 1, 2].
*   **Quebra por Canal**: Exibir dentro do card a distribuição exata de quanto pertence a cada marketplace[cite: 2].

#### 3. CONFRONTO DE ESTOQUE E ALERTAS DE PRODUÇÃO
*   **Monitoramento em Tempo Real**: Comparar o 'Total a Enviar' acumulado com o saldo do 'Depósito Meikê' retornado pela API do Tiny ERP[cite: 1, 2].
*   **Gatilho de Produção**: Ativar o badge visual "PRODUZIR" sempre que a demanda consolidada for superior ao estoque físico disponível no Meikê[cite: 2].

#### 4. INTEGRAÇÃO GOOGLE AGENDA (CALENDAR API)
*   **Sincronização**: Cada nova remessa criada deve gerar um evento automático na agenda[cite: 1].
*   **Padronização de Cores**: 
    *   Mercado Livre: Amarelo Banana (#F2C94C)[cite: 1].
    *   Shopee: Laranja Tangerina (#F2994A)[cite: 1].
    *   Amazon: Cinza Grafite (#4F4F4F)[cite: 1].

#### 5. REQUISITOS DE DADOS (SQL)
*   Utilizar a tabela `remessa_itens` vinculada ao `id_produto_tiny` para garantir que a soma das unidades seja precisa entre diferentes marketplaces[cite: 1].