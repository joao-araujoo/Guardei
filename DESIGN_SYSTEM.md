# Guardei Design System

Este documento é a fonte de verdade para decisões visuais e de interação do frontend do Guardei.

O objetivo é manter uma interface **divertida, editorial e acolhedora**, sem cair em aparência infantil, genérica ou inconsistente. O produto deve parecer feito por uma equipe de produto madura, mas continuar tendo personalidade própria.

## 1. Princípios

### 1.1 Editorial playful

O Guardei mistura referências de caderno, arquivo, coleção e cards físicos com uma interface digital limpa. A diversão vem da composição, do mascote, de pequenos detalhes e das cores — não de excesso de enfeites.

### 1.2 Clareza antes de decoração

Toda tela deve deixar óbvio:

1. onde o usuário está;
2. o que é mais importante;
3. qual é a ação principal;
4. o que é secundário;
5. qual feedback aconteceu depois da ação.

### 1.3 Personalidade consistente

Não criar um “novo estilo” a cada feature. Novos componentes devem usar os mesmos tokens, raios, bordas, sombras, tipografia, estados e espaçamentos.

### 1.4 Mobile é um produto, não um fallback

Toda interface deve funcionar primeiro em 360–430 px e depois expandir. Modais, drawers, chats, filtros, grids e ações precisam ser desenhados conscientemente para toque.

### 1.5 Diversão com controle

O Guardinho, microcopy e pequenos detalhes podem ser bem-humorados. Componentes críticos, formulários, confirmações e navegação devem continuar claros e previsíveis.

---

## 2. Linguagem visual

### Tipografia

- **Display:** Fraunces, para títulos importantes e momentos editoriais.
- **Interface:** Archivo, para navegação, formulários, labels, botões e texto corrido.
- Títulos não devem ocupar linhas demais apenas para parecerem impactantes.
- Evitar caixa alta em textos longos. Usar uppercase apenas para eyebrow, status curtos e labels auxiliares.

### Cores

A paleta é quente e inspirada em papel, tinta e marcadores.

Tokens principais são definidos em `src/design-system.css` e mapeiam os tokens legados (`--bg`, `--paper`, `--ink`, etc.).

Regras:

- fundo geral: quente e discreto;
- superfícies: claras e legíveis;
- texto principal: alto contraste;
- cores fortes: usadas para estado, destaque e personalidade;
- não introduzir hex aleatório em componente novo quando existir token semântico equivalente.

### Bordas

- borda forte faz parte da identidade, mas deve ser usada com intenção;
- cards principais: 2 px;
- divisores internos: 1 px;
- evitar múltiplas bordas competindo dentro do mesmo componente.

### Raios

Usar apenas a escala do sistema:

- `--radius-sm`: controles compactos;
- `--radius-md`: inputs e botões;
- `--radius-lg`: cards;
- `--radius-xl`: modais, drawers e superfícies grandes;
- `--radius-pill`: chips e badges.

Não inventar `border-radius` arbitrário por feature.

### Sombras

A sombra “offset/sticker” é parte do Guardei, mas precisa ser padronizada.

- `--shadow-sm`: elementos compactos;
- `--shadow-md`: cards e painéis;
- `--shadow-lg`: overlays e superfícies elevadas.

Evitar combinar blur pesado, glassmorphism e sombra offset no mesmo elemento.

---

## 3. Espaçamento e layout

Escala base:

- 4 px — micro ajuste;
- 8 px — elementos relacionados;
- 12 px — controles compactos;
- 16 px — espaçamento padrão;
- 20/24 px — blocos de conteúdo;
- 32 px — seções;
- 48+ px — respiro entre grandes regiões, quando necessário.

Regras:

- não “colar” título, descrição e ação;
- não usar gaps aleatórios de 5, 7, 11, 19 px sem motivo;
- grids devem cair para uma coluna antes de comprimir conteúdo;
- `min-width: 0` é obrigatório em filhos flex/grid que podem conter texto longo;
- nenhum componente deve gerar scroll horizontal em 360 px.

Container principal:

- desktop confortável até aproximadamente 1180 px;
- tablets mantêm margem lateral clara;
- mobile usa 8–12 px de margem externa, conforme o componente.

---

## 4. Componentes

### Botões

Hierarquia:

1. **Primary** — ação mais importante do contexto;
2. **Secondary** — alternativa relevante;
3. **Ghost** — baixa ênfase;
4. **Danger** — destrutivo, nunca usado como decoração.

Regras:

- alvo de toque mínimo de 44 px em dispositivos touch;
- ícone + texto devem ter gap consistente;
- não criar três botões primários competindo na mesma região;
- disabled deve parecer indisponível sem perder legibilidade;
- todo botão interativo precisa de `:focus-visible`.

### Inputs e selects

- altura visual consistente;
- labels acima ou associados semanticamente;
- borda perceptível no estado normal;
- foco visível e acessível;
- mensagem auxiliar abaixo do campo quando necessário;
- erro deve explicar o que fazer, não apenas mudar a cor da borda.

### Cards

Cards devem ter uma função clara: conteúdo, métrica, ação ou agrupamento.

Evitar “card dentro de card dentro de card” apenas para separar visualmente. Preferir espaçamento, heading e divisor.

### Chips e badges

- curtos;
- uma única linha quando possível;
- não usar como substituto de texto explicativo complexo;
- cor deve ter significado consistente.

### Ícones

- usar o conjunto Lucide existente via Iconify;
- emojis podem aparecer em microcopy intencional, mas não devem substituir ícones de interface;
- evitar símbolos Unicode improvisados quando houver ícone equivalente.

---

## 5. Modais, dialogs, sheets e drawers

Overlays são componentes críticos e devem seguir estas regras.

### Desktop

- modal central para edição ou decisão focal;
- drawer lateral para experiência persistente/assistiva, como Guardinho;
- largura limitada e conteúdo rolável internamente;
- fundo da página não deve rolar enquanto o overlay principal está aberto.

### Mobile

- preferir bottom sheet/drawer de largura total para experiências longas;
- modal de edição pode ocupar quase toda a viewport, mantendo 8 px de margem;
- altura deve usar `dvh`, não depender apenas de `vh`;
- considerar `safe-area-inset-bottom`;
- ações principais devem permanecer alcançáveis sem layout quebrado;
- conteúdo deve rolar dentro do overlay;
- nenhuma região pode depender de hover.

### Acessibilidade

- `role="dialog"` e `aria-modal="true"` quando aplicável;
- nome acessível via `aria-labelledby` ou `aria-label`;
- Escape deve fechar overlays não destrutivos;
- fechar pelo backdrop apenas quando isso não causa perda de dados perigosa;
- foco deve ser visível.

---

## 6. Guardinho

O Guardinho é parte da marca, não um widget genérico de chat.

Direção:

- presença amigável, compacta e reconhecível;
- o mascote é o principal elemento lúdico;
- superfícies do Guardinho devem reutilizar o mesmo sistema de cards, inputs, botões e sombras do produto;
- mensagens do usuário e do Guardinho precisam ter contraste e leitura claros;
- ações rápidas devem ser escaneáveis, sem virar uma grade apertada de controles minúsculos.

Arquitetura visual:

- `ProductShell.jsx` contém a experiência inteligente mais nova;
- `smart-layer.css` contém estilos base dessa camada;
- `design-system.css` possui os tokens e refinamentos globais que mantêm essa camada alinhada ao restante do produto;
- não adicionar outro launcher/chat paralelo sem remover ou integrar explicitamente o anterior.

---

## 7. Responsividade

Breakpoints de validação obrigatórios:

- 360 px;
- 390 px;
- 430 px;
- 768 px;
- 1024 px;
- 1280 px;
- 1440 px.

Verificar especialmente:

- topbar;
- navegação inferior;
- cards da home;
- biblioteca e filtros;
- formulário de novo item;
- modal de vídeo;
- configurações;
- conquistas;
- Guardinho legado e Guardinho inteligente;
- toasts/notificações internas;
- teclado virtual em formulários e chat.

---

## 8. Estados obrigatórios

Todo componente novo relevante deve considerar:

- default;
- hover, quando houver ponteiro;
- active/pressed;
- focus-visible;
- disabled;
- loading;
- empty;
- error;
- success/feedback, quando aplicável.

---

## 9. Motion

Animações devem reforçar causalidade, não chamar atenção para si mesmas.

- duração curta: 120–220 ms;
- preferir transform e opacity;
- respeitar `prefers-reduced-motion`;
- mascote pode ter movimento sutil, mas não deve atrapalhar leitura ou navegação.

---

## 10. Checklist antes de considerar UI pronta

- não há scroll horizontal em 360 px;
- controles touch têm área adequada;
- títulos não estouram containers;
- textos longos truncam ou quebram corretamente;
- modal/drawer não ultrapassa viewport;
- teclado mobile não esconde o campo principal sem possibilidade de scroll;
- foco por teclado está visível;
- cores e contrastes continuam legíveis;
- nenhum componente novo introduziu cor, raio ou sombra arbitrária;
- loading/empty/error estão tratados;
- `npm test` passa;
- `npm run build` passa.

Este documento deve ser atualizado quando um padrão realmente novo for incorporado ao produto. Não atualizar o sistema apenas para justificar uma exceção local.