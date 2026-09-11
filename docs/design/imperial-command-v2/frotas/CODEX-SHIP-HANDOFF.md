# STARZ — Codex Ship Handoff

## Estado

Capital Ship Visual Language V3 é uma especificação visual. Nenhum código, gameplay ou API foi alterado nesta rodada.

## Ordem de implementação futura

1. registrar classes e papéis no domínio existente;
2. adicionar manifest de assets sem substituir rotas ou modelos atuais;
3. integrar thumbnails e silhouettes ao Shipyard;
4. integrar hero e escala relativa ao Fleet Operations;
5. integrar presença orbital ao Planet View;
6. manter Atlas strike craft como unidades subordinadas;
7. tratar Stargrave como caso especial quando estiver disponível;
8. validar responsividade e legibilidade em tamanhos pequenos.

## Regras de integração

- preservar a arquitetura frontend existente;
- não transformar callouts em stats de gameplay;
- não hardcodear dimensões físicas a partir das pranchas;
- usar `PROVISIONAL` para qualquer medida ainda não canonizada;
- manter STARZ como identidade da organização e o nome da nave no casco;
- não substituir assets aprovados de Horizon a Spearhead.

## STARGRAVE IS A SPECIAL CASE

O Codex não deve tratar Stargrave como um casco convencional com seção de movimento e apresentação de nave normal. Ela continua selecionável e representável como Titan, mas visualmente usa assets próprios de megastructura: núcleo estelar cativo, containment schematic, Dyson segments e infraestrutura militar.

O Stellar Translation Field, o Judgment Alignment e o Stellar Verdict são conceitos visuais/lore marcados como `CONCEPTUAL / FUTURE GAMEPLAY CANDIDATE`. Não implementar mecânica nova nesta etapa.

## Critério visual

Se a nave for reduzida a uma silhueta preta, Leviathan, Atlas, Dominion e Stargrave ainda devem ser distinguíveis por função e arquitetura.
