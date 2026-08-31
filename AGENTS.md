# AGENTS.md — Guardei

Este arquivo define regras obrigatórias para agentes de IA, copilots e pessoas que alterarem o repositório.

## 1. Antes de alterar a interface

Leia, nesta ordem:

1. `AGENTS.md`;
2. `DESIGN_SYSTEM.md`;
3. `src/design-system.css`;
4. `src/styles.css`;
5. o componente/arquivo específico que será alterado.

Não implemente uma feature visual importante sem entender o padrão existente.

## 2. Regra principal de produto

O Guardei deve parecer **divertido, editorial, acolhedor e profissional**.

Não transformar o produto em:

- dashboard SaaS genérico;
- UI excessivamente corporativa;
- visual infantil;
- conjunto desconexo de cards;
- interface com “cara de IA” feita por componentes aleatórios;
- glassmorphism/gradientes decorativos sem relação com a identidade atual.

Preserve a linguagem de papel quente, tinta escura, cores alegres, Fraunces + Archivo, contornos marcantes e o Guardinho como elemento de marca.

## 3. Não invente estilos locais

Antes de escrever CSS novo, procure token ou padrão equivalente.

Obrigatório:

- usar tokens de `src/design-system.css`;
- reutilizar escala de radius;
- reutilizar sombras do sistema;
- reutilizar cores semânticas;
- manter espaçamento na escala definida em `DESIGN_SYSTEM.md`;
- usar os ícones Lucide do runtime local do projeto para ícones de interface.

Evite:

- hex novo dentro de componente sem justificativa;
- `border-radius` arbitrário;
- sombras diferentes em cada card;
- `style={{ ... }}` para layout/estilização quando uma classe resolve;
- emojis como ícones funcionais;
- tamanho de fonte enorme apenas para criar impacto artificial.

Exceção: cores dinâmicas de categorias existentes podem continuar sendo passadas por CSS custom properties quando fizer parte da lógica do produto.

## 4. Responsividade é requisito de aceite

Toda alteração visual deve funcionar em:

- 360;
- 390;
- 430;
- 768;
- 1024;
- 1280;
- 1440 px.

Nunca entregue componente que:

- gere scroll horizontal;
- dependa de hover para ação essencial;
- use largura fixa incompatível com mobile;
- coloque três ou mais colunas onde o conteúdo fica espremido;
- ignore safe areas;
- use `100vh` em overlay mobile sem considerar `dvh`;
- deixe ação principal inacessível com teclado virtual aberto.

Use `min-width: 0` em filhos de flex/grid com texto variável.

## 5. Modais, dialogs e drawers

Não crie overlay do zero sem seguir o sistema existente.

Para qualquer modal/drawer novo:

- role e nome acessível corretos;
- Escape fecha quando seguro;
- backdrop consistente;
- rolagem interna;
- viewport respeitada;
- foco visível;
- layout mobile específico;
- áreas de toque com pelo menos 44 px em dispositivos touch;
- `safe-area-inset-bottom` quando houver ação próxima ao rodapé.

Não use scripts globais em `index.html` para interceptar cliques, esconder componentes React ou coordenar dois fluxos paralelos. Integração de comportamento deve acontecer na camada React/aplicação.

## 6. Guardinho

O Guardinho deve ser tratado como um único produto assistivo, não como vários chats independentes.

Regras:

- não adicionar um terceiro launcher;
- não duplicar chat inteligente em nova feature;
- integrar ações novas na experiência existente;
- o mascote deve permanecer visualmente importante, mas sem ocupar espaço excessivo;
- ações rápidas precisam ter labels claras;
- mensagens precisam continuar legíveis em 360 px;
- painel inteligente precisa se comportar como drawer no desktop e bottom sheet no mobile.

Se houver necessidade de manter comportamento legado, a compatibilidade deve ser explícita e documentada — nunca um hack invisível no HTML.

## 7. Componentização e tamanho de arquivos

`src/App.jsx` e `src/styles.css` já são grandes. Não continue concentrando toda feature nova neles por conveniência.

Para trabalho novo relevante:

- preferir componente próprio;
- preferir CSS próprio quando representar um domínio visual claro;
- evitar duplicação de helpers;
- manter nomes de classes com domínio identificável;
- não criar abstração genérica prematura para componente usado uma vez.

Refatorações devem ser incrementais e não podem alterar regra de negócio sem solicitação explícita.

## 8. Acessibilidade

Obrigatório:

- `:focus-visible` perceptível;
- `aria-label` em botão apenas com ícone;
- label associado a inputs;
- contraste legível;
- ordem de tab coerente;
- não comunicar estado apenas por cor;
- respeitar `prefers-reduced-motion`.

## 9. Conteúdo e microcopy

Tom do Guardei:

- humano;
- curto;
- levemente bem-humorado;
- sem exagero;
- sem jargão técnico para usuário final.

Evitar:

- títulos genéricos de IA;
- parágrafos desnecessariamente longos;
- excesso de exclamações;
- emoji em toda frase;
- frases que escondem o que a ação realmente faz.

## 10. Segurança de comportamento

Não altere regras de negócio, autenticação, persistência, push, classificação, Prisma ou API durante uma tarefa puramente visual, salvo quando existir bug diretamente relacionado e a alteração for necessária.

Nunca:

- apagar dados do usuário para corrigir UI;
- remover validações server-side;
- colocar segredo no frontend;
- quebrar modo local/API existente;
- mudar payloads sem revisar consumidores;
- armazenar respostas autenticadas de `/api/` no Cache Storage do Service Worker;
- usar `prisma db push` como mecanismo de deploy em produção;
- adotar um banco legado no histórico de migrations sem antes verificar drift estrutural.

Regras adicionais de produção:

- deploy usa migrations versionadas e `server/scripts/migrate-production.js`;
- banco novo e banco legado sem `_prisma_migrations` precisam continuar cobertos no CI com PostgreSQL real;
- alterações em `schema.prisma` devem vir acompanhadas de migration forward-only; não reescreva migrations já publicadas;
- dependências diretas de produção não podem usar `latest`;
- Web Push, Service Worker, Guardinho e qualquer outra superfície que marque algo como “visto” devem registrar consumo, nunca aplicação;
- o assistente contextual da extensão permanece opt-in; não leia texto da página enquanto ele estiver desligado.

## 11. Validação antes de commit/PR

Execute ou garanta compatibilidade com:

```text
npm test
npm run build
```

Quando backend for alterado, também validar os scripts/checks pertinentes do servidor.

Faça revisão visual das telas afetadas nos breakpoints obrigatórios.

Checklist mínimo:

- home;
- adicionar item;
- biblioteca;
- revisão;
- dashboard;
- conquistas;
- configurações;
- modal de item;
- Guardinho;
- toasts;
- mobile dock.

## 12. PRs

PR visual deve explicar:

- problema encontrado;
- padrão adotado;
- arquivos alterados;
- impacto em mobile;
- como foi validado;
- qualquer limitação conhecida.

Não descreva apenas “melhorias de UI”. Seja específico.

## 13. Critério final

Uma alteração visual só está pronta quando parece pertencer ao Guardei mesmo se o autor original não estiver presente para orientar.

Se uma nova tela parece ter vindo de outro produto, a implementação ainda não está pronta.

## 14. Invariante de dados: consumir != aplicar

- `watchedAt` / `consumedAt` significam que o usuário consumiu o conteúdo.
- `applicationStatus`, `appliedAt` e compromissos de aplicação significam que o usuário realmente aplicou algo.
- Nunca defina `status: aplicado` apenas porque um vídeo/link foi visto, aberto, revisado ou marcado como visto.
- Toda nova ação do Guardinho, PWA, Web Push ou integração que altere consumo/aplicação precisa de teste de regressão para essa distinção.

## 15. Ícones locais e independência de runtime

- Não adicione CDN, `<script>` remoto ou chamada à API Iconify para renderizar ícones no navegador.
- A tag existente `<iconify-icon icon="lucide:...">` é atendida pelo runtime local `src/lib/localIconify.js`.
- Ao introduzir um novo `lucide:*`, execute `node scripts/generate-local-icons.mjs` e versione o catálogo gerado.
- `tests/localIcons.test.mjs` deve continuar garantindo que todo ícone referenciado tenha representação local e que o frontend não dependa de rede para desenhá-lo.
- Não edite manualmente `src/lib/localIconify.js`; altere os usos de ícones ou o gerador e regenere.
