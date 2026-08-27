# Guardei API

Backend do Guardei para contas, acervo, IA, configuracoes e Web Push da PWA.

## Rodar

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

Para Neon, preencha `DATABASE_URL` com a connection string pooled e `DATABASE_DIRECT_URL` com a connection string direta.

## Web Push / notificacoes no celular

1. Copie `server/.env.example` para `server/.env`.
2. Instale as dependencias do backend.
3. Rode `npm run push:keys` dentro de `server` ou `npm --prefix server run push:keys` a partir da raiz.
4. Salve `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no ambiente do backend.
5. Rode `npm run db:push` para criar `PushSubscription` e os novos campos de configuracao.
6. Sirva a aplicacao em HTTPS, instale a PWA no celular e ative `Lembretes` pelo Guardinho.

As chaves VAPID devem permanecer as mesmas em producao. Troca-las invalida as inscricoes push existentes.

O scheduler interno verifica notificacoes periodicamente. Para infraestrutura que dorme ou escala para zero, configure tambem um cron externo chamando `POST /api/push/cron` com o header `X-Push-Cron-Secret` igual a `PUSH_CRON_SECRET`.

Ao clonar do zero, use `npm install` no backend nesta versao; ele instala `web-push` e sincroniza o lockfile local antes dos demais comandos.

## Endpoints principais

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/ai/enrich-video`
- `GET /api/videos`
- `POST /api/videos`
- `PATCH /api/videos/:id`
- `DELETE /api/videos/:id`
- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/push/public-key`
- `GET /api/push/status`
- `POST /api/push/subscribe`
- `DELETE /api/push/subscribe`
- `POST /api/push/test`
- `POST /api/push/cron`
- `GET /api/health`

O enriquecimento aceita qualquer URL. Para TikTok e YouTube tenta oEmbed; para as demais fontes usa metadados recebidos e classificacao por IA/fallback.
