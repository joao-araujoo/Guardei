<p align="left">
  <img width="400" height="230" alt="guardei-logo" src="https://github.com/user-attachments/assets/a90dda4f-3977-4ad6-8506-3cdd961b122b" />
</p>

# Guardei — memória auxiliar para a internet

O Guardei existe para reduzir o caminho entre **encontrar algo → guardar → reencontrar → entender → usar**.

A experiência principal é deliberadamente simples: a pessoa pode continuar no navegador ou celular que já usa. O Guardei recebe o conteúdo, organiza por baixo e traz de volta quando existe motivo para isso.

## Princípios do produto

1. **Guardar deve exigir quase zero decisão.** Categoria, tags, embeddings e snapshot não são trabalho do usuário.
2. **Encontrar não depende de lembrar onde algo foi colocado.** Busca textual + semântica + síntese do próprio acervo.
3. **O acervo precisa voltar a ser útil.** Hoje, Guardinho, lembretes, digest e repetição espaçada reativam conteúdo relevante.
4. **Consumir não significa aplicar.** O Ciclo de Conhecimento separa consumo, reflexão, memória e aplicação real.
5. **Complexidade fica por baixo.** A Home prioriza Hoje; recursos avançados existem sem competir pela atenção inicial.

## O que existe hoje

### Captura universal

- link manual, clipboard e Web Share Target;
- centro **Guardar** com atalho `Ctrl/Cmd + K`;
- motivo rápido: ver depois, usar, aprender, inspirar ou comprar;
- screenshot pesquisável com visão/OCR quando habilitado;
- pensamentos rápidos que também entram na busca semântica;
- importação de favoritos HTML/CSV com deduplicação;
- snapshot textual seguro de páginas para não depender somente de uma URL viva;
- token de captura restrito para a extensão do navegador, com pausa global e revogação individual.

### Extensão do navegador

A pasta `extension/` contém uma extensão Manifest V3 pronta para carregar em modo desenvolvedor:

- guardar página ativa em um clique;
- guardar screenshot visível;
- menu de contexto;
- selecionar rapidamente a intenção do salvamento;
- mostrar discretamente **“você já guardou coisas sobre isso”** ao encontrar relação entre a página atual e o acervo.

O token `gcp_...` usado pela extensão só é aceito nas rotas de captura e pode ser revogado dentro do Guardei.

### Guardinho e reencontro

- recomendações contextuais;
- ações seguras sobre o acervo;
- recuperação semântica antes de responder;
- lembretes in-app e Web Push;
- **Lembra disso?** para conteúdos antigos que ainda têm sinal de valor;
- digest semanal com destaques, itens ressurgidos e candidatos à limpeza;
- síntese **“O que eu já sei sobre X?”** baseada somente no acervo real do usuário.

### Conhecimento

- Cápsulas Inteligentes;
- busca híbrida textual + semântica;
- embeddings isolados do frontend;
- Trilhas Inteligentes;
- conexões e Mapa;
- reflexões após consumo;
- cartões de conhecimento;
- repetição espaçada determinística;
- aplicações reais com evidência/reflexão;
- dashboard de conhecimento;
- Central Hoje com sessões por tempo disponível e progresso real da meta diária de revisão.

### Organização sem pastas obrigatórias

- categorias e tags automáticas;
- **Espaços automáticos** criados apenas quando categorias, conceitos ou tags realmente se repetem;
- nenhuma estrutura vazia é criada só para parecer organizada.

### Compartilhamento

- coleções públicas com slug próprio e exclusão com confirmação segura;
- página pública em `shared.html`;
- visitantes podem abrir fontes sem conta;
- usuário autenticado pode **Guardar tudo no meu Guardei** com deduplicação.

## Stack

- React + Vite;
- PWA + Service Worker + Web Share Target;
- Node.js + Express;
- PostgreSQL + Prisma;
- Gemini com fallbacks determinísticos/local onde aplicável;
- Web Push/VAPID;
- extensão Manifest V3.

## Rodar localmente

Frontend:

    npm install
    npm run dev

Backend:

    cd server
    npm install
    npm run db:generate
    npm run dev

Variáveis mínimas para modo API:

    VITE_STORAGE_MODE=api
    VITE_API_BASE_URL=http://localhost:3333
    DATABASE_URL=...
    DATABASE_DIRECT_URL=...
    AUTH_SECRET=...

`GEMINI_API_KEY` é opcional para desenvolvimento: o produto mantém fallbacks onde existe alternativa segura.

## Banco e deploy

Para instalações que já possuem as migrations do Ciclo de Conhecimento, aplique a migration aditiva mais recente:

    cd server
    npx prisma migrate deploy
    npx prisma generate

O schema preserva os dados anteriores e adiciona captura universal, snapshots, assets, coleções, pensamentos, digest e tokens de captura.

## Web Push

Gere as chaves uma vez:

    npm --prefix server run push:keys

Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`. Não troque o par VAPID depois que dispositivos estiverem inscritos.

## Validação

O CI principal executa:

- instalação limpa frontend/backend com `npm ci`;
- `npm audit` frontend/backend em nível high;
- geração do Prisma Client;
- syntax check de todo backend JavaScript;
- testes do produto inteligente;
- testes de Cápsulas, busca/trilhas e Ciclo de Conhecimento;
- testes da camada Everywhere;
- build de produção do frontend.

## Arquitetura visual e regras para agentes

Leia antes de alterar UI:

- `DESIGN_SYSTEM.md` — fonte de verdade visual;
- `AGENTS.md` — regras obrigatórias para agentes/IA;
- `src/design-system.css` — tokens e fundação visual.

Novas features não devem criar um novo design system, chat paralelo, launcher paralelo de Guardinho nem hacks globais no `index.html`.
