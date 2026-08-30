# Ciclo de Conhecimento

A terceira evolução do Guardei acompanha o caminho entre salvar um conteúdo e realmente utilizá-lo. O ciclo é opcional e incremental:

1. o conteúdo é salvo;
2. o usuário registra o consumo;
3. pode escrever uma reflexão curta;
4. pode aceitar poucos cartões de recordação;
5. revisa os cartões com repetição espaçada;
6. cria um compromisso de aplicação;
7. registra evidência ou reflexão ao concluir;
8. o dashboard calcula métricas somente a partir desses registros reais.

## Separação entre consumo e aplicação

`watchedAt` foi mantido para compatibilidade e passa a ser um alias histórico de consumo. Novos registros também usam `consumedAt`.

Marcar um conteúdo como consumido:

- preenche `consumedAt` e `watchedAt`;
- atualiza o tempo consumido e a contagem de consumo;
- não altera o status para `aplicado`;
- abre de forma opcional o formulário **Registrar aprendizado**.

Uma aplicação real exige um `ApplicationCommitment` concluído com ao menos evidência textual, URL ou reflexão final. Somente essa ação grava:

- `applicationStatus = completed`;
- `appliedAt`;
- `applicationNote`;
- `applicationEvidenceUrl`;
- `status = aplicado`, preservado como representação visual compatível com as versões anteriores.

## Migração de dados existentes

A migração `20260713150000_add_knowledge_cycle` é aditiva e não destrutiva.

- `consumedAt` recebe o valor existente de `watchedAt` quando houver.
- Linhas antigas com `status = aplicado` recebem `applicationStatus = legacy_applied`.
- O status histórico não é reescrito.
- `appliedAt` não é inventado para registros antigos.
- Itens `legacy_applied` continuam acessíveis, mas não entram na métrica de aplicação comprovada.
- As tabelas anteriores, cápsulas, embeddings e trilhas permanecem intactas.

## Modelos

### `ContentReflection`

Uma reflexão por conteúdo, contendo aprendizado principal, lembrança desejada, ideia de aplicação e confiança de 1 a 5.

### `KnowledgeCard`

Cartão pertencente ao usuário e a um conteúdo. Guarda pergunta, resposta, dica, tipo, fonte, status e o estado determinístico do agendamento.

### `ReviewAttempt`

Registra cada avaliação, o intervalo anterior, o próximo intervalo, o fator de facilidade resultante e a data. A resposta digitada pelo usuário pode ser persistida, mas não é devolvida em listagens nem incluída em logs ou no contexto do Guardinho.

### `ApplicationCommitment`

Ação concreta relacionada a um conteúdo e, opcionalmente, a uma trilha. Uma conclusão exige evidência ou reflexão.

## Algoritmo de revisão

O agendamento está isolado em `server/src/reviews/scheduler.js`. A IA não escolhe datas.

Avaliações:

- `again`: reinicia repetições, reduz o fator de facilidade e agenda para 1 dia;
- `hard`: mantém o progresso, reduz levemente a facilidade e aumenta pouco o intervalo;
- `good`: usa a sequência 1 dia, 3 dias e depois multiplica pelo fator de facilidade;
- `easy`: aumenta a facilidade e usa um multiplicador maior.

O cálculo também considera:

- repetições anteriores;
- intervalo anterior;
- fator de facilidade;
- confiança da reflexão, quando registrada;
- atraso em relação à data prevista, com bônus limitado.

Limites:

- intervalo mínimo: 1 dia;
- intervalo máximo: 365 dias;
- fator de facilidade mínimo: 1,3;
- fator de facilidade máximo: 3,2;
- datas inválidas geram erro antes da persistência;
- intervalos negativos ou não numéricos são normalizados de forma segura.

Cada tentativa armazena o intervalo anterior e o novo intervalo, permitindo auditoria e métricas reproduzíveis.

## Cartões sugeridos por IA

A geração recebe somente contexto limitado:

- título e descrição resumida;
- resumo, conceitos e poucos pontos da cápsula;
- reflexão curta do usuário.

A geração:

- possui timeout;
- tem rate limiting;
- ignora instruções presentes no conteúdo não confiável;
- retorna no máximo 5 cartões pelo backend e 3 pela interface padrão;
- valida JSON, tipos e limites;
- não persiste nada automaticamente;
- utiliza fallback local quando a IA não estiver disponível.

O usuário precisa editar, aceitar ou rejeitar cada sugestão.

## Central Hoje

`GET /api/reviews/today` separa:

- conteúdos no inbox para decidir;
- cartões vencidos ou prontos;
- compromissos próximos ou atrasados;
- trilhas ativas com próxima ação.

As sessões de 2, 5, 10 minutos e completa são montadas com custos determinísticos aproximados. A central não cria atividade falsa para preencher tempo.

## Dashboard

`GET /api/knowledge/dashboard` calcula:

- tentativas e cartões pendentes;
- recordação, apenas quando existem tentativas;
- confiança média, apenas quando existem reflexões com confiança;
- aplicações planejadas e concluídas;
- conteúdos consumidos;
- aplicações reais e registros históricos separados;
- evolução diária;
- assuntos com maior dificuldade e melhor recordação;
- sequência de dias de revisão;
- cartões recuperados após um erro;
- trilhas concluídas com aplicações.

A taxa de recordação considera `good` e `easy` como recordação e sempre informa o número de tentativas da amostra.

## Guardinho

Antes de responder, o Guardinho recupera dados pertencentes ao usuário:

- cápsulas e resultados semânticos;
- trilhas e lacunas;
- reflexões;
- cartões relevantes e avaliações recentes;
- compromissos de aplicação.

O contexto é limitado, não contém vetores, não inclui respostas pessoais completas das tentativas e não afirma retenção ou aplicação quando não há registros suficientes.

## Endpoints

Todos exigem autenticação:

```text
GET    /api/reviews/today
GET    /api/reviews/session?minutes=2|5|10|complete
GET    /api/videos/:id/reflection
POST   /api/videos/:id/reflection
GET    /api/cards
POST   /api/cards
PATCH  /api/cards/:id
DELETE /api/cards/:id
POST   /api/cards/:id/review
POST   /api/videos/:id/cards/generate
GET    /api/applications
POST   /api/videos/:id/applications
PATCH  /api/applications/:id
DELETE /api/applications/:id
GET    /api/knowledge/dashboard
```

## Segurança e privacidade

- O `userId` sempre vem da sessão.
- Consultas e mutações verificam propriedade.
- Um item de outra conta não pode ser usado para criar cartão, reflexão ou aplicação.
- Ratings, datas, enums, paginação e tamanhos são validados.
- URLs de evidência aceitam somente HTTP ou HTTPS e removem credenciais.
- Textos pessoais não entram em logs.
- Nenhuma chave ou escolha de modelo fica no frontend.
- O Guardinho recebe somente contexto resumido e pertencente ao usuário.
- Não há promessa de notificações push; os lembretes são internos ao aplicativo.

## Acessibilidade

- A revisão ativa funciona por teclado.
- Espaço revela a resposta quando o foco não está no campo de texto.
- Teclas 1 a 4 registram as quatro avaliações após revelar a resposta.
- Escape encerra a sessão.
- Trocas de cartão usam `aria-live` e foco previsível.
- Avaliações possuem texto, não dependem apenas de cor.
- Suspensão e exclusão exigem confirmação.
- A resposta digitada fica em `sessionStorage` e é preservada ao sair ou após erro de rede.
- Gráficos possuem representação textual equivalente.
- Movimento reduzido desativa animações do ciclo.

## Deploy

Após incorporar as PRs anteriores, execute:

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

A ordem das PRs empilhadas é:

1. Cápsulas Inteligentes;
2. Busca semântica, Trilhas e Conexões;
3. Ciclo de Conhecimento.
