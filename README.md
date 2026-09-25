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
- **Quadros solo e compartilhados**: um quadro com você sozinho é o seu espaço privado — ninguém mais enxerga. Convide alguém por email e ele vira compartilhado; se a pessoa já tem conta, entra na hora, se não, o convite é aceito quando ela se cadastra. O app mostra de qual tipo é cada quadro e adapta os textos.
- **Multi-tenant**: cada quadro é isolado; o acesso é validado no servidor em toda requisição.
- **Viagens** com destino, época, ano (ou "algum dia"), status, orçamento por pessoa e anotações.
- **Linha do tempo por ano** + seção "Algum dia" para ideias sem data.
- **Status em um toque** direto no card, filtros por status e resumo (total, reservadas/feitas, orçamento estimado).
- **No destino**: passeios com o contato de quem organiza (o telefone vira link de discagem) e um registro corrido dos gastos do dia a dia, somados por categoria — o módulo existe para tornar visível o dinheiro que some em muitas corridas pequenas.
- **Antes de sair**: checklist de casa e pets, agrupado por momento (com antecedência, na véspera, na hora de sair), com responsável por tarefa e um resumo de quem ficou com o quê. Toda viagem nova nasce com a rotina preenchida.
- **Diário em Markdown**: as anotações aceitam títulos, listas, tarefas, destaques e links, com abas de escrever e ler. O texto é guardado como Markdown puro — continua legível fora do app e sem prender o conteúdo a nenhum editor.
- **Datas exatas e contagem regressiva**: além da "época" em texto livre, ida e volta de verdade — o cartão passa a mostrar "12 a 19 de nov de 2026 · faltam 48 dias · 7 noites".
- **Parcelamento com entrada**: um item do checklist distingue *contratado* de *pago*. "R$ 500 de entrada + 6x de R$ 280, 2 pagas" mostra quanto já saiu, quanto falta e quando vence a próxima. O app soma isso em "já pago" e "ainda vai sair".
- **Sair do quadro**: quem foi convidado vai embora sozinho, sem depender do dono. (O dono não sai — precisa excluir o quadro antes.)
- **Acerto de contas** (quadro compartilhado): registre quem bancou cada item e o app calcula quem deve quanto a quem, sugerindo as transferências que zeram tudo.
- **Quantas pessoas vão** por viagem: os valores continuam por pessoa, e o app calcula o total do grupo. Viagem criada num quadro solo já nasce com 1 pessoa.
- **Viagens feitas são arquivadas** num bloco "Já rolou" recolhido no fim, com o total gasto — a linha do tempo fica só com o que está por vir.
- **Checklist com controle financeiro**: cada viagem tem itens (passagem, hospedagem, seguro…) que se marcam como feitos e recebem o **valor real** pago. O orçamento da viagem é a *estimativa*; a soma dos itens marcados é o *gasto*. O app mostra os dois lado a lado e avisa quando passou do previsto.
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
- `ChecklistItem` — um item do checklist de gastos (rótulo, contratado ou não, valor total, parcelamento, quem pagou).
- `PreTripTask` — uma tarefa de antes de sair (rótulo, feita, responsável, momento).
- `Activity` — um passeio no destino (rótulo, contato, quando, situação).
- `Expense` — um gasto avulso da viagem (rótulo, categoria, valor total, quem pagou).
- `RateHit` — registro de tentativa, para o limite de taxa no cadastro.

> **Por que `PreTripTask` não é um `ChecklistItem` com um tipo.** O checklist
> de gastos existe para dinheiro: valor, entrada, parcelas, quem pagou. Numa
> tarefa como "fechar o gás" esses sete campos ficariam nulos em toda linha, e
> o que a tarefa precisa — responsável e momento — o outro modelo não tem.

> **`done` significa CONTRATADO, não pago.** São coisas diferentes: passagem
> em 6x está contratada no primeiro dia e paga só no sexto mês. O parcelamento
> é modelado com escalares no item (`downPaymentCents`, `downPaymentPaid`,
> `installments`, `paidInstallments`, `firstDueDate`) em vez de uma tabela de
> parcelas — tudo que o app precisa é derivável deles. A entrada fica separada
> do valor das parcelas porque quase nunca é igual a uma delas.

> **Dinheiro mora em dois lugares, com unidades diferentes.**
> `ChecklistItem` é o que se planeja e paga antes (passagem, hospedagem), em
> valores **por pessoa**. `Expense` é o que se gasta no destino no dia a dia
> (Uber, comida), em valores **totais**. A divisão segue como a pessoa pensa —
> antes da viagem × durante — e a unidade difere porque cada um é registrado
> de um jeito: orçamento se pensa por cabeça, recibo de Uber vem com o valor
> cheio. O acerto de contas soma os dois, e é lá que a diferença de unidade
> precisa de atenção (ver `calcularSaldos`).

> **Dinheiro é sempre guardado em centavos**, como inteiro (`budgetCents`,
> `amountCents`). O nome do campo carrega a unidade de propósito: ponto
> flutuante acumula erro de arredondamento, e num app que soma orçamento isso
> vira diferença de reais no total.

> Não existe campo "solo" no banco: um quadro é solo quando tem um único `BoardMember`. O isolamento é o mesmo de sempre — quem não é membro não lê nada — então privacidade e compartilhamento saem do mesmo mecanismo, sem permissão por viagem.
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
| `npm run test` | Testes (runner nativo do Node) |
| `npm run lint` | ESLint |

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
| `GET` | `/api/cron/reseed-demo` | Repõe a conta de demonstração (só o cron da Vercel) |
| `GET`/`POST` | `/api/trips/:id/activities` | Passeios do destino |
| `PATCH`/`DELETE` | `/api/activities/:id` | Edita/remove um passeio |
| `GET`/`POST` | `/api/trips/:id/expenses` | Gastos avulsos |
| `PATCH`/`DELETE` | `/api/expenses/:id` | Edita/remove um gasto |
| `GET` | `/api/trips/:id/tasks` | Tarefas de antes de sair |
| `POST` | `/api/trips/:id/tasks` | Adiciona tarefa |
| `PATCH` | `/api/tasks/:id` | Marca/renomeia/atribui uma tarefa |
| `DELETE` | `/api/tasks/:id` | Remove uma tarefa |
| `GET` | `/api/trips/:id/items` | Itens do checklist |
| `POST` | `/api/trips/:id/items` | Adiciona item ao checklist |
| `PATCH` | `/api/items/:id` | Marca/renomeia/lança o valor de um item |
| `DELETE` | `/api/items/:id` | Remove um item |

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
   | `CRON_SECRET` | `openssl rand -base64 24` — protege o reset diário da demo |

   `AUTH_URL` pode ficar de fora: o Auth.js v5 detecta o domínio sozinho na Vercel.

3. Deploy. O `build` roda `prisma migrate deploy` antes do `next build`, então o
   schema é aplicado automaticamente a cada deploy.

**Região.** O `vercel.json` fixa as funções em `gru1` (São Paulo), ao lado do
banco. Sem isso a Vercel usa `iad1` (Washington) por padrão e cada consulta
atravessa o continente — medi ~0,6 a 1,6s por requisição contra 0,33s de uma
página sem banco.

**Por que duas URLs?** O runtime é serverless e abre muitas conexões curtas — daí
o pooler. Já o `prisma migrate` precisa de uma sessão própria, que o pooler não
entrega; por isso o `directUrl` no `schema.prisma`.

> ⚠️ **Preview deployments:** eles também rodam `migrate deploy`. Aponte o
> `DATABASE_URL`/`DIRECT_URL` do ambiente *Preview* da Vercel para um branch de
> dev do Neon, senão um preview com migração nova altera o banco de produção.

---

## 🧪 Qualidade

```bash
npm run typecheck   # tipos
npm run lint        # ESLint
npm test            # 153 testes
```

Os testes cobrem o que quebraria em silêncio:

- **dinheiro** — conversão, formatação e a ida-e-volta pelo campo de edição
  (`format`), as somas de contratado/pago/a pagar (`checklist`), as contas de
  parcela incluindo a invariante *pago + falta = total* (`parcelas`)
- **datas** — fuso, horário de verão, virada de ano e fim de mês (`datas`)
- **acerto de contas** — as invariantes de que os saldos somam zero e de que
  as transferências sugeridas zeram todo mundo (`acerto`)
- **validação** — os schemas, incluindo a regressão do `null` virando `0`
- **gastos do destino** (`gastos`) — soma por categoria ordenada pelo maior,
  média por dia e por pessoa
- **antes de sair** (`pre-viagem`) — agrupamento por momento, progresso (lista
  vazia não é "tudo pronto") e o resumo de pendências por pessoa
- **Markdown** (`markdown`) — a limpeza da marcação para o preview do cartão,
  com a garantia de que texto sem formatação passa intacto
- **isolamento entre quadros** (`access`) — o mais importante: roda contra um
  banco de verdade e confirma que ninguém alcança viagem ou item de um quadro
  do qual não é membro

---

## 🗺️ Próximos passos (ideias)

- Tempo real de verdade (WebSocket/SSE) no lugar do polling.
- Múltiplas moedas (viagens internacionais).
- Anexos e links por viagem.
- Papéis mais finos (visualizador × editor).
- App mobile consumindo a mesma API.

---

## 📄 Licença

MIT — veja [LICENSE](./LICENSE).
