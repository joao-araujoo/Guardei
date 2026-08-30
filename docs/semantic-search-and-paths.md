# Busca semântica, Trilhas Inteligentes e Conexões

Esta evolução adiciona recuperação híbrida, trilhas orientadas a objetivos e relações reproduzíveis entre conteúdos sem substituir a busca literal nem alterar os dados existentes.

## Embeddings

O texto indexado é uma composição limitada de título, descrição, nota, categoria, tags, resumo, conceitos e pontos principais da cápsula. O texto é normalizado, limitado e identificado por hash. O vetor fica exclusivamente no backend, em `VideoEmbedding.vector`, isolado por um serviço que poderá ser substituído por pgvector no futuro.

O provedor padrão é local e determinístico, com vetor de 192 dimensões. A opção Gemini só é utilizada quando `EMBEDDING_PROVIDER=gemini` e existe uma chave no backend. Falhas deixam a indexação como `failed` ou `outdated`, mas nunca impedem a criação ou edição do item.

## Ranking híbrido

O ranking combina:

- 52% similaridade semântica;
- 36% correspondência textual;
- 12% sinais determinísticos de contexto, como duração, humor, esforço, prioridade, status e existência de cápsula.

Sem embeddings, o serviço usa 78% de sinal textual e 22% de atributos. Filtros são aplicados antes do ranking e todos os candidatos já são limitados ao usuário autenticado.

## Trilhas

`LearningPath` armazena o objetivo e as preferências. `LearningPathItem` associa somente vídeos reais da conta, com posição, etapa, justificativa, duração, status, observação e marcação de alteração manual. `LearningPathGap` registra lacunas como sugestões de pesquisa, sem criar links externos.

A geração busca candidatos dentro do acervo, limita o contexto e valida todos os IDs retornados. Reorganizações preservam itens adicionados ou modificados manualmente.

## Conexões e mapa

Itens relacionados e arestas do mapa são calculados por similaridade vetorial, conceitos e tags compartilhadas. Nenhuma relação permanente é criada por uma resposta arbitrária da IA. O mapa limita nós e arestas e possui visualização alternativa em lista.

## Segurança

- Todas as rotas exigem autenticação.
- Consultas, embeddings, trilhas e relações sempre filtram por `userId` da sessão.
- Vetores não são serializados para o frontend nem registrados em logs.
- Há limites de candidatos, paginação, rate limiting, timeouts e validação de payload.
- O Guardinho recebe apenas itens e trilhas relevantes, com contexto limitado.

## Migração

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

A migração é aditiva e não altera registros existentes.
