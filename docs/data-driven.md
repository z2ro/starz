# Data-driven

Conteúdo comum vive em `game_data/` e é carregado por `Catalog`. Cada tipo tem um modelo Pydantic estrito; campos extras, ranges inválidos e YAML malformado falham.

O loader também verifica:

- IDs duplicados;
- custos e referências inexistentes;
- campos de efeitos não suportados;
- combustíveis incompatíveis ou inexistentes;
- requirements de tecnologia cíclicos.

Fórmulas continuam em Python (`calculate`/métodos da engine); YAML fornece parâmetros. Um novo distrito, casco ou propulsor que use campos existentes é adicionado como YAML, sem `if` pelo ID.

Para adicionar conteúdo:

1. crie um item no diretório da categoria;
2. aponte apenas para IDs já existentes ou conteúdo incluído;
3. rode `python scripts/validate_game_data.py` e os testes.

## Arquétipos e modos

`stars/` define classe, peso, massa, idade, atividade e parâmetros de luminosidade.
`planets/` define peso, referências estelares compatíveis, atmosferas, ranges físicos
e perfis minerais referenciando recursos existentes. A engine usa SHA-256 de
seed/coordenadas/chave, seleção ponderada ordenada por ID e fórmulas Python.
Mesmo seed + coordenadas + catálogo produz o mesmo sistema, independentemente da
ordem dos arquivos, entradas ou dicionários. Modificar o conteúdo pode alterar o mundo.

`travel_modes/` define modificadores de tempo, combustível, calor e assinatura.
Os IDs atuais em maiúsculas são preservados no JSON/API. Um novo ID válido é aceito
pela engine e aparece na UI. Tempos e consumo precisam ser positivos e finitos;
calor/assinatura não negativos. Ranges são pares ordenados, percentuais ficam em
0–100, dimensões físicas positivas e referências são verificadas por categoria.

## DECLARADO = EXECUTADO

Somente `Technology` declara `unlocks`. A conclusão entra em `research.completed`;
`EFFECT_HANDLERS['unlock_content']` resolve os IDs declarados a partir dessa lista.
O resultado é derivado, não um segundo estoque persistido de permissões. Assim,
reler um JSON ou repetir `advance` não reaplica bônus ou duplica estado.

Conteúdo mencionado em qualquer unlock fica bloqueado até uma das tecnologias que
o libera estar concluída. `requires` é uma conjunção: tecnologias precisam estar
concluídas, distritos precisam estar construídos. Essas duas condições são verificadas
genericamente antes de construir, pesquisar, montar e escolher regime de viagem.
Casco, motor e combustível passam pela mesma validação ao montar uma nave.

Unlocks suportam tecnologias, distritos, cascos, motores, combustíveis e regimes.
Targets sem operação de disponibilidade, como recursos naturais/arquétipos, são
rejeitados. Ciclos em requirements e dependências de unlock também são rejeitados.
O antigo `district.unlock` foi substituído pelo `technology.unlocks` já existente.
O estaleiro necessário ao casco agora é declarado em `ships/*.yaml: requires`.

O antigo campo genérico `effects` foi removido: nenhuma game data o usava, e
`modify_production` não tinha handler. Declará-lo agora falha explicitamente.
O registry contém apenas o efeito realmente executado: `unlock_content` com os
dados tipados de `Technology`. Não há scripts, DSL ou expressões executáveis em YAML.
