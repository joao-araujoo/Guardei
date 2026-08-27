<p align="left">
  <img width="400" height="230" alt="guardei-logo" src="https://github.com/user-attachments/assets/a90dda4f-3977-4ad6-8506-3cdd961b122b" />
</p>

# Guardei - O Seu Acervo Digital Inteligente 🗂️

![Status do Projeto](https://img.shields.io/badge/status-em%20produção-orange)
![Tech Stack](https://img.shields.io/badge/stack-React%20%7C%20Node.js%20%7C%20Gemini%20AI-00E676)
![Tipo](https://img.shields.io/badge/projeto-solo-blueviolet)

<p align="center">
  <strong>Salve, organize e revisite links importantes da internet com o poder da Inteligência Artificial.</strong>
</p>

---

## Sobre o projeto

O Guardei é uma PWA para transformar links esquecidos em um acervo ativo. Ele recebe links manualmente, pelo clipboard e pelo menu de compartilhamento compatível, classifica e organiza automaticamente e usa o Guardinho para recomendar, lembrar e executar ações seguras sobre o acervo.

## Principais funcionalidades

- salvamento e deduplicação de links;
- classificação automática com Gemini e fallback local;
- contas e acervo isolado por usuário;
- recomendações contextuais;
- Guardinho com ações para salvar, organizar, categorizar, arquivar, marcar visto e destacar conteúdos;
- lembretes inteligentes e bem-humorados;
- Web Push com VAPID para a PWA instalada, inclusive com o app fechado;
- subscriptions de push por dispositivo e limpeza no logout;
- Service Worker com ações nas notificações;
- PWA com Web Share Target em plataformas compatíveis;
- backup/importação JSON;
- conquistas e métricas de consumo.

## Rodar o frontend

```bash
npm install
npm run dev
```

## Rodar o backend

```bash
cd server
npm install
npm run db:generate
npm run db:push
npm run dev
```

Variáveis principais:

```env
VITE_STORAGE_MODE=api
VITE_API_BASE_URL=http://localhost:3333
DATABASE_URL=connection_string_pooled_do_neon
DATABASE_DIRECT_URL=connection_string_direta_do_neon
AUTH_SECRET=um_segredo_com_pelo_menos_32_caracteres
GEMINI_API_KEY=sua_chave_gemini
```

Com `VITE_STORAGE_MODE=api`, contas, links, preferências e subscriptions ficam no backend/PostgreSQL. Sem essa variável, o app continua oferecendo o modo local para desenvolvimento.

## Ativar Web Push no celular

Depois de instalar as dependências do backend, gere as chaves VAPID uma única vez:

```bash
npm --prefix server run push:keys
```

Coloque os valores gerados no ambiente permanente do backend:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:seu-email@dominio.com
PUSH_SCHEDULER_ENABLED=true
PUSH_SCHEDULER_INTERVAL_MINUTES=60
PUSH_CRON_SECRET=um-segredo-longo-opcional
```

Não troque as chaves VAPID depois que usuários estiverem inscritos, pois a troca invalida subscriptions existentes.

Em produção, use HTTPS. Instale a PWA no celular, entre na conta e ative **Lembretes** pelo Guardinho. O dispositivo será inscrito automaticamente e receberá uma notificação de teste. O scheduler do backend passa então a enviar lembretes inteligentes mesmo quando o Guardei estiver fechado.

Se a infraestrutura do backend dormir ou escalar para zero, configure também um cron externo para chamar `POST /api/push/cron` com o header `X-Push-Cron-Secret`.

## Scripts úteis

```bash
npm test
npm run build
npm --prefix server run db:generate
npm --prefix server run db:push
npm --prefix server run push:keys
```

## Estrutura

- `src/` — frontend React/PWA;
- `public/sw.js` — Service Worker, notificações e push;
- `server/src/` — API Express;
- `server/src/push/` — motor server-driven de Web Push;
- `server/prisma/schema.prisma` — PostgreSQL/Prisma;
- `tests/` — testes automatizados do produto inteligente.
