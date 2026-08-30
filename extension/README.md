# Extensão Guardei

Extensão Manifest V3 para captura em um clique e descoberta contextual.

## Instalação local

1. No Guardei, abra **Guardar → Mais → Extensão 1 clique** e gere um token de captura.
2. Abra `chrome://extensions`, ative **Modo do desenvolvedor** e escolha **Carregar sem compactação**.
3. Selecione a pasta `extension/`.
4. Nas opções da extensão, informe a URL da API do Guardei e o token `gcp_...`.

O token não é uma sessão completa: ele só é aceito nas rotas `/api/capture/*` e pode ser revogado no Guardei.

## Recursos

- guardar a página ativa em um clique;
- escolher rapidamente por que foi guardada;
- guardar screenshot visível para OCR/visão;
- menu de contexto;
- aviso discreto quando a página atual se relaciona a algo já salvo.

Para publicar em lojas, revise as permissões de host, política de privacidade e screenshots da listagem.