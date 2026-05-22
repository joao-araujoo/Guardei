# Guardei API

Backend opcional para enriquecer links com IA e trocar o armazenamento local por API.

## Rodar

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

Para Neon, preencha `DATABASE_URL` com a connection string pooled e `DATABASE_DIRECT_URL` com a connection string direta.

## Endpoints

- `POST /api/ai/enrich-video`
- `GET /api/videos`
- `POST /api/videos`
- `PATCH /api/videos/:id`
- `DELETE /api/videos/:id`
- `POST /api/videos/import`
- `GET /api/health`

O endpoint aceita qualquer URL. Para TikTok e YouTube ele tenta buscar oEmbed; para as demais fontes usa metadados recebidos e classificacao por IA/fallback.
