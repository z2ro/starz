# Data-driven

Conteúdo comum vive em `game_data/` e é carregado por `Catalog`. Cada tipo tem um modelo Pydantic estrito; campos extras, ranges inválidos e YAML malformado falham.

O loader também verifica:

- IDs duplicados;
- custos e referências inexistentes;
- efeitos fora do registry conhecido;
- combustíveis incompatíveis ou inexistentes;
- requirements de tecnologia cíclicos.

Fórmulas continuam em Python (`calculate`/métodos da engine); YAML fornece parâmetros. Um novo distrito, casco ou propulsor que use campos existentes é adicionado como YAML, sem `if` pelo ID.

Para adicionar conteúdo:

1. crie um item no diretório da categoria;
2. aponte apenas para IDs já existentes ou conteúdo incluído;
3. rode `python scripts/validate_game_data.py` e os testes.
