# CoTrip ✈️

Planeje viagens **em grupo** — do "um dia a gente vai" à viagem reservada.

### 🔗 [Ver funcionando → cotrip-chi.vercel.app](https://cotrip-chi.vercel.app)

Quer entrar sem criar conta? Use a conta de demonstração:

| | |
|---|---|
| **Email** | `demo@cotrip.app` |
| **Senha** | `demo1234` |

CoTrip é um quadro compartilhado para organizar viagens ao longo dos próximos anos. Cada viagem passa por um fluxo simples de status (**Ideia → Planejando → Reservado → Feita**), com época, orçamento estimado e anotações. Duas ou mais pessoas entram no mesmo quadro e editam juntas.

> Projeto full-stack em **Next.js + TypeScript + PostgreSQL**. Nasceu de um protótipo e virou uma aplicação com contas de verdade e espaços compartilhados (multi-tenant).

---

## ✨ Funcionalidades

- **Contas de verdade** (email + senha) com sessões via Auth.js (NextAuth v5).
- **Quadros compartilhados**: convide alguém por email; se a pessoa já tem conta, entra na hora; se não, o convite é aceito quando ela se cadastra.
- **Multi-tenant**: cada quadro é isolado; o acesso é validado no servidor em toda requisição.
- **Viagens** com destino, época, ano (ou "algum dia"), status, orçamento por pessoa e anotações.
- **Linha do tempo por ano** + seção "Algum dia" para ideias sem data.
- **Status em um toque** direto no card, filtros por status e resumo (total, reservadas/feitas, orçamento estimado).
- **Tema claro/escuro** automático.
- **Sincronização leve**: o quadro atualiza sozinho (polling) para refletir edições de quem está junto.

---

## 🧱 Stack e arquitetura

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router, Server Components) |
| Linguagem | TypeScript |
| UI | React 19 + CSS próprio (design tokens, sem framework de CSS) |
| Auth | Auth.js / NextAuth v5 (Credentials + JWT) |
| Banco | PostgreSQL |
| ORM | Prisma |
| Validação | Zod |

**Modelo de dados** (ver `prisma/schema.prisma`):

- `User` — conta (email único, senha com hash bcrypt).
- `Board` — um quadro de viagens.
- `BoardMember` — vínculo usuário↔quadro com papel (`OWNER` / `EDITOR`).
- `Trip` — uma viagem, pertence a um quadro.
- `Invitation` — convite pendente por email (aceito no cadastro).

O isolamento multi-tenant é garantido em cada rota: nenhuma viagem é lida ou escrita sem antes checar que o usuário é membro do quadro dono dela (`src/lib/auth-helpers.ts`).

**Estrutura**

```
src/
├─ auth.ts, auth.config.ts     # configuração do Auth.js (Node + edge)
├─ middleware.ts               # protege /app
├─ lib/                        # prisma, status, format, validação, helpers
├─ types.ts                    # DTOs compartilhados cliente/servidor
└─ app/
   ├─ login/ register/         # páginas de autenticação
   ├─ api/                     # rotas REST (register, boards, trips, members)
   └─ app/                     # a aplicação (server page + BoardApp client)
```

---

## 🚀 Rodando localmente

### Pré-requisitos
- Node.js 20+
- Um PostgreSQL. Duas opções:
  - **Neon** (recomendado) — crie um branch `dev` do projeto e use as URLs dele.
    Mesmo Postgres da produção, nada para instalar.
  - **Docker local** — `docker compose up -d` sobe um Postgres 16 na porta 5432.

### Passos

```bash
# 1. Instalar dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env
#   → gere um AUTH_SECRET:  openssl rand -base64 32

# 3. Subir o Postgres local — só se for usar Docker em vez do Neon
docker compose up -d

# 4. Aplicar as migrações no banco
npx prisma migrate deploy

# 5. (opcional) Popular com dados de exemplo
npm run db:seed
#   Login demo: demo@cotrip.app / demo1234

# 6. Rodar
npm run dev            # http://localhost:3000
```

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Aplica migrações, gera o Prisma Client e faz o build |
| `npm run start` | Sobe o build de produção |
| `npm run db:push` | Aplica o schema sem criar migração (só para rascunho) |
| `npm run db:migrate` | Cria e aplica uma migração nova (após mudar o schema) |
| `npm run db:seed` | Popula dados de exemplo |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run typecheck` | Checagem de tipos (tsc) |

---

## 🔌 API (REST)

Todas as rotas exigem sessão, exceto o cadastro. O corpo é JSON.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/register` | Cria conta (e aceita convites pendentes) |
| `GET` | `/api/boards` | Lista os quadros do usuário |
| `POST` | `/api/boards` | Cria um quadro |
| `GET` | `/api/boards/:id` | Detalhe do quadro (viagens + membros) |
| `PATCH` | `/api/boards/:id` | Renomeia (dono) |
| `DELETE` | `/api/boards/:id` | Exclui (dono) |
| `GET` | `/api/boards/:id/members` | Membros + convites pendentes |
| `POST` | `/api/boards/:id/members` | Convida por email (dono) |
| `DELETE` | `/api/boards/:id/members?userId=` | Remove membro (dono) |
| `GET` | `/api/boards/:id/trips` | Viagens do quadro |
| `POST` | `/api/boards/:id/trips` | Cria viagem |
| `PATCH` | `/api/trips/:id` | Atualiza viagem |
| `DELETE` | `/api/trips/:id` | Exclui viagem |

---

## ☁️ Deploy

**Vercel** (app) + **Neon** (Postgres).

1. Suba o repositório no GitHub e importe na Vercel.
2. No painel do Neon, copie as **duas** connection strings do branch de produção
   e configure na Vercel:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | connection string **pooled** (host termina em `-pooler`) |
   | `DIRECT_URL` | connection string **direta** (sem `-pooler`) |
   | `AUTH_SECRET` | `openssl rand -base64 32` |

   `AUTH_URL` pode ficar de fora: o Auth.js v5 detecta o domínio sozinho na Vercel.

3. Deploy. O `build` roda `prisma migrate deploy` antes do `next build`, então o
   schema é aplicado automaticamente a cada deploy.

**Por que duas URLs?** O runtime é serverless e abre muitas conexões curtas — daí
o pooler. Já o `prisma migrate` precisa de uma sessão própria, que o pooler não
entrega; por isso o `directUrl` no `schema.prisma`.

> ⚠️ **Preview deployments:** eles também rodam `migrate deploy`. Aponte o
> `DATABASE_URL`/`DIRECT_URL` do ambiente *Preview* da Vercel para um branch de
> dev do Neon, senão um preview com migração nova altera o banco de produção.

---

## 🗺️ Próximos passos (ideias)

- Tempo real de verdade (WebSocket/SSE) no lugar do polling.
- Checklist por viagem (passagem, hospedagem, seguro).
- Múltiplas moedas (viagens internacionais).
- Anexos e links por viagem.
- Papéis mais finos (visualizador × editor).
- App mobile consumindo a mesma API.

---

## 📄 Licença

MIT — veja [LICENSE](./LICENSE).
