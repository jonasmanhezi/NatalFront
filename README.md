# Amigo Secreto de Natal

Site para o amigo secreto da família. Cada pessoa se cadastra com foto, nome e tamanhos de calçado, calça e camisa. No dia, o organizador sorteia e cada um abre um presente animado para ver quem tirou, com os tamanhos e ideias de presente.

**Ninguém precisa criar conta.** Quem se cadastra recebe um link pessoal. Para quem tem dificuldade com o celular, o organizador faz o cadastro e manda o link pelo WhatsApp.

Frontend estático (HTML, CSS e JavaScript sem build). O backend é separado e segue o contrato em [`docs/`](docs/).

## Rodar

Os módulos JavaScript não abrem por `file://`, então sirva a pasta:

```bash
python3 -m http.server 5173
# ou
npx serve .
```

Abra http://localhost:5173.

### Modo demonstração

Com `apiBaseUrl` vazio em [`js/config.js`](js/config.js), o app guarda tudo no `localStorage` do navegador. Para testar o fluxo inteiro:

1. Toque em **Entrar como organizador** na faixa do topo.
2. Em **Organizar**, toque em **Adicionar 4 pessoas de exemplo**.
3. Faça o seu cadastro na aba **Cadastro**.
4. Volte em **Organizar** e toque em **Sortear agora**.
5. Na aba **Início**, abra o presente.

Para começar do zero: **Organizar → Apagar demonstração**.

## Ligar o backend

1. Implemente a API descrita em [`docs/API.md`](docs/API.md) e [`docs/openapi.yaml`](docs/openapi.yaml).
2. Coloque o endereço em `js/config.js`:

   ```js
   window.APP_CONFIG = { apiBaseUrl: "https://sua-api.exemplo.com/api" };
   ```

3. Defina a chave de organizador no servidor e entre uma vez por `https://seu-site/#admin=SUA_CHAVE`. O navegador guarda a chave; o endereço é limpo na hora.

## Publicar

Qualquer hospedagem de site estático serve: GitHub Pages, Netlify, Vercel, Cloudflare Pages ou Render (Static Site). Não há etapa de build: publique a pasta como está.

## Como funciona para a família

| Quem | O que faz |
|---|---|
| Organizador | Abre com `#admin=chave`. Define nome do grupo, dia do sorteio, data da troca e valor. Cadastra quem precisar de ajuda, gera links novos, sorteia, refaz ou reabre as inscrições. Não vê os pares. |
| Participante | Abre o link do site, se cadastra e recebe o link pessoal (`#t=...`). No dia, abre o app e toca no presente. |
| Quem tem dificuldade | Recebe do organizador o link pessoal pelo WhatsApp e só precisa tocar nele. |

## Estrutura

```
index.html          telas e barra de abas
css/styles.css      visual: vidro estilo iOS, tema de Natal
js/config.js        endereço do backend (vazio = demonstração)
js/app.js           estado, telas e ações
js/api/http.js      cliente da API REST
js/api/mock.js      mesma API no localStorage (demonstração)
js/draw.js          algoritmo do sorteio (referência para o servidor)
js/ideas.js         ideias de presente pelos tamanhos e gostos
js/icons.js         ícones SVG
docs/API.md         guia do backend
docs/openapi.yaml   contrato OpenAPI 3
```
