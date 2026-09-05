# Game design

## Decided

- Estratégia espacial persistente para navegador, com consequência, distância e universo físico útil.
- Economia curta: recursos naturais → processamento → materiais/componentes.
- Stocks são separados de capacities; energia é geração/consumo.
- População é capacidade agregada, não city builder.
- Superfície planetária é separada da infraestrutura orbital.
- Pesquisa desbloqueia capacidades; propulsão separa casco, motor e combustível.
- Viagens possuem regimes Economy, Normal e Forced, com trade-offs de tempo, combustível, calor e assinatura.
- Universo procedural, determinístico e materializado sob demanda.
- Spawn assimétrico fisicamente, mas avaliado por viabilidade estratégica.
- UI é um command center dark e legível, desktop-first.
- Indústria nominal, slots de obras e slots de estaleiro são capacidades distintas.
- Obras e montagem têm prazo fixo após validação inicial; pesquisa progride conforme
  cobertura contínua de energia e workforce, podendo pausar e retomar.
- Na foundation, indústria nominal é informativa; não aumenta paralelismo ou velocidade.
- PostgreSQL persiste estado; YAML continua definindo conteúdo, sem tabelas espelhadas.

## Pending

- Lore de origem da civilização.
- Combate orbital e de superfície.
- Colonização avançada, diplomacia e logística entre planetas.
- Fenômenos dinâmicos, debris e efeitos ambientais de guerra.
- Política de clusters de spawn para escala multi-jogador.
- Autenticação, ownership multiusuário e operação em produção.
