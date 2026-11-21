# API do Amigo Secreto

Guia para quem for escrever o backend. O contrato formal está em [`openapi.yaml`](openapi.yaml); o modo demonstração em [`js/api/mock.js`](../js/api/mock.js) implementa exatamente estas regras no navegador e serve de referência.

## Ideia geral

- Um grupo por instalação (uma família, um sorteio).
- **Ninguém precisa de conta.** O link de convite é só o endereço do site.
- Ao se cadastrar, a pessoa recebe um **token pessoal**. O frontend guarda no `localStorage` e mostra o link `https://site/#t=<token>` para abrir em outro celular ou mandar pelo WhatsApp.
- O organizador entra com `https://site/#admin=<chave>`. A chave fica numa variável de ambiente do servidor.
- **O sorteio roda no servidor.** Nenhuma rota devolve a lista de pares, nem para o organizador. Cada pessoa só consegue ver quem ela tirou, pelo próprio token.

## Autenticação

| Quem | Como chega | Header |
|---|---|---|
| Participante | `#t=<token>` no link, depois `localStorage` | `Authorization: Bearer <token>` |
| Organizador | `#admin=<chave>` no link, depois `localStorage` | `X-Admin-Key: <chave>` |

Recomendações:
- Gere tokens com pelo menos 128 bits aleatórios (ex.: 32 caracteres base36 de `SecureRandom`).
- Guarde só o **hash** do token (SHA-256) no banco. Na busca, faça o hash do que chegou.
- Compare a chave de organizador em tempo constante.
- Aplique limite de requisições em `POST /participants` e nas rotas `/admin/*`.

## Rotas

| Método | Caminho | Auth | O que faz |
|---|---|---|---|
| GET | `/config` | — | Nome do grupo, datas, valor, `status`, `drawnAt`, `drawCount`, `features` |
| GET | `/participants` | — | Lista pública: `id`, `name`, `photo`, `complete` (sem tamanhos) |
| POST | `/participants` | — | Cadastro próprio → `{participant, token}`. 409 se já sorteado |
| GET | `/me` | token | Meu cadastro |
| PUT | `/me` | token | Atualiza meu cadastro (substitui os campos) |
| DELETE | `/me` | token | Sair do sorteio. 409 se já sorteado |
| GET | `/me/assignment` | token | `{receiver, reason}` — quem eu tirei |
| POST | `/me/ideas` | token | Opcional: ideias com IA (`features.aiIdeas`) |
| GET | `/admin/check` | chave | Confere a chave |
| PUT | `/admin/config` | chave | Atualiza nome, `drawDate`, `exchangeDate`, `budget` |
| GET | `/admin/participants` | chave | Cadastros completos + `complete` + `inDraw` |
| POST | `/admin/participants` | chave | Cadastra alguém (`manual = true`) → `{participant, token}` |
| PUT | `/admin/participants/{id}` | chave | Edita um cadastro |
| DELETE | `/admin/participants/{id}` | chave | Remove um cadastro |
| POST | `/admin/participants/{id}/link` | chave | Gera token novo (o antigo deixa de valer) → `{token}` |
| POST | `/admin/draw` | chave | Sorteia (ou refaz) → `Config` |
| POST | `/admin/reopen` | chave | Apaga os pares e volta para `open` → `Config` |

O frontend chama tudo relativo a `apiBaseUrl` (em `js/config.js`), por exemplo `https://api.exemplo.com/api`.

## Regras de negócio

**Sorteio (`POST /admin/draw`)**
1. Pega todos os participantes atuais. Menos de 3 → `409` com `message` em português.
2. Embaralha com Fisher–Yates usando gerador seguro e liga cada pessoa à próxima, fechando um círculo (veja [`js/draw.js`](../js/draw.js)). Ninguém tira a si mesmo e não existem pares fechados (A↔B) com 3 ou mais pessoas.
3. Apaga os pares antigos, grava os novos (`giver_id → receiver_id`), salva quem entrou (`drawIds`), `status = drawn`, `drawnAt = agora`.
4. Faça tudo numa transação.

**Quem eu tirei (`GET /me/assignment`)**
- `status != drawn` → `{receiver: null, reason: "not_drawn"}`
- a pessoa não está no último sorteio → `reason: "joined_after_draw"`
- quem ela tirou foi removido depois → `reason: "receiver_left"`
- senão → `{receiver: {...}, reason: null}` com nome, foto, tamanhos, gostos, lista de desejos e "prefere não ganhar".

**Quem vê o quê**
- Público: nome, foto e se o cadastro está completo.
- Participante: o próprio cadastro e o cadastro completo de quem tirou.
- Organizador: todos os cadastros e o estado do sorteio, **nunca os pares**. (Ele consegue gerar um link novo para alguém e abrir; isso é aceitável numa família e fica registrado como troca de token.)

**Validação**
- `name` obrigatório, até 40 caracteres. Tamanhos até 16. `likes` 300, `wishlist` 500, `avoid` 160.
- `photo`: data URL `image/jpeg|png|webp` em base64, até ~200 KB. O frontend já entrega 360×360 em JPEG.
- Datas no formato `AAAA-MM-DD` ou vazias. `budget` inteiro ≥ 0 ou `null`.

**Erros**
Sempre JSON: `{"code": "...", "message": "..."}`. Códigos: `invalid` (400/422), `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409), `too_large` (413), `server` (5xx). Em `invalid` e `conflict` o `message` aparece para a pessoa, então escreva em português.

**CORS**
Se o site e a API ficarem em domínios diferentes, libere a origem do site para `GET, POST, PUT, DELETE` com os headers `Content-Type`, `Authorization` e `X-Admin-Key`.

## Modelo de dados sugerido

```
config        (id=1, title, draw_date, exchange_date, budget, status, drawn_at)
participant   (id, name, photo, shoe, pants, shirt, likes, wishlist, avoid,
               manual, token_hash, created_at, updated_at)
assignment    (giver_id PK, receiver_id)   -- apagada e regravada a cada sorteio
draw_member   (participant_id PK)          -- quem entrou no último sorteio
```

`drawCount` = linhas em `draw_member`. `inDraw` = existe em `draw_member`.

## Ideias com IA (opcional)

Se quiser o botão "Pedir ideias com IA", devolva `features.aiIdeas = true` em `/config` e implemente `POST /me/ideas`: pegue o cadastro de quem a pessoa tirou e o `budget`, peça 6 sugestões a um modelo de linguagem e responda `{"ideas": [{"titulo", "porque", "preco"}]}`. A chave do modelo fica só no servidor.
