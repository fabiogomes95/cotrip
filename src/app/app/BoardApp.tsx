"use client";

import type {
  BoardSummary,
  ChecklistItemDTO,
  MemberDTO,
  Role,
  TripDTO,
} from "@/types";
import type { Status } from "@/lib/status";
import { Arquivo } from "./Arquivo";
import { ProximaViagem } from "./ProximaViagem";
import { EmViagem } from "./EmViagem";
import { estaEmViagem } from "@/lib/em-viagem";
import { proximaViagem } from "@/lib/proxima";
import { NewBoardModal } from "./NewBoardModal";
import { STATUSES, STATUS_COR, STATUS_LABEL, nextStatus } from "@/lib/status";
import { BotaoTema } from "./BotaoTema";
import { ShareModal } from "./ShareModal";
import { TripModal, type AbaId } from "./TripModal";
import { YearSection } from "./TripCard";
import { formatBRL } from "@/lib/format";
import { totalAPagar, totalPago } from "@/lib/checklist";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CUR = new Date().getFullYear();
const BASE_YEARS = [CUR, CUR + 1, CUR + 2, CUR + 3];
const POLL_MS = 12000;

type Modal =
  | { type: "trip"; trip: TripDTO | null; presetYear?: number; aba?: AbaId }
  | { type: "share" }
  | { type: "newboard" }
  | null;

interface Props {
  currentUser: { id: string; name: string; email: string };
  boards: BoardSummary[];
  activeBoard: { id: string; name: string; role: Role };
  initialTrips: TripDTO[];
  initialMembers: MemberDTO[];
  abrirCompartilhar?: boolean;
}

export function BoardApp({
  currentUser,
  boards,
  activeBoard,
  initialTrips,
  initialMembers,
  abrirCompartilhar = false,
}: Props) {
  const router = useRouter();
  const [trips, setTrips] = useState<TripDTO[]>(initialTrips);
  const [members] = useState<MemberDTO[]>(initialMembers);
  const [filter, setFilter] = useState<"todos" | Status>("todos");
  const [modal, setModal] = useState<Modal>(
    abrirCompartilhar ? { type: "share" } : null,
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  /* A contagem regressiva depende de "hoje", e "hoje" difere entre servidor e
     navegador: o servidor roda em UTC, então às 22h de Brasília ele já virou
     o dia e calcularia um dia a menos. Renderizar isso no servidor daria
     divergência de hidratação — e um número piscando na tela.

     Por isso a data só é lida depois que o componente monta: no primeiro
     render (o do servidor) a contagem simplesmente não aparece. */
  const [hoje, setHoje] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date());
  }, []);

  const isOwner = activeBoard.role === "OWNER";

  /* Solo x compartilhado não é um campo no banco: é simplesmente quantas
     pessoas são membros do quadro. Um quadro com você sozinho É o seu
     espaço privado — ninguém mais consegue ler nada dele. */
  const outros = members.filter((m) => m.userId !== currentUser.id);
  const solo = outros.length === 0;
  const seloQuadro = solo
    ? "só você"
    : outros.length === 1
      ? `você + ${outros[0].name.trim().split(/\s+/)[0]}`
      : `${members.length} pessoas`;
  const initials = (currentUser.name || currentUser.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  /* Não há efeito sincronizando props com estado aqui de propósito.
     A página passa key={id do quadro} neste componente, então trocar de
     quadro o remonta e o useState pega os valores novos sozinho — que é a
     forma que o React recomenda para "resetar estado quando a prop muda".
     A versão com useEffect + setState causava um render extra a cada troca,
     e era ela que deixava a lista de membros defasada. */

  // ----- toast -----
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2300);
  }, []);

  // ----- data -----
  const refetchTrips = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${activeBoard.id}/trips`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips as TripDTO[]);
      }
    } catch {
      /* silencioso: mantém estado atual */
    }
  }, [activeBoard.id]);

  // Polling leve para refletir edições de quem está junto. Pausa enquanto
  // houver modal aberto: recarregar por baixo de um formulário atropelaria o
  // que a pessoa está digitando.
  //
  // Antes isso era lido de um ref escrito durante o render — o que o React
  // proíbe, porque o valor pode ficar defasado entre render e commit. Agora o
  // próprio `modal` é dependência: o intervalo é desmontado e remontado na
  // troca, que é exatamente o comportamento desejado.
  useEffect(() => {
    if (modal !== null) return;
    const id = setInterval(() => void refetchTrips(), POLL_MS);
    return () => clearInterval(id);
  }, [refetchTrips, modal]);

  // O checklist grava direto na API, sem passar pelo "Salvar" do formulário.
  // Por isso toda saída de modal repuxa as viagens: é o que mantém o resumo
  // do cartão (feitos, gasto) em dia com o que acabou de ser mexido.
  const closeModal = useCallback(() => {
    setModal(null);
    void refetchTrips();
  }, [refetchTrips]);

  // Fecha modal no ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  // ----- mutations -----
  async function saveTrip(id: string | null, body: Partial<TripDTO>) {
    const url = id ? `/api/trips/${id}` : `/api/boards/${activeBoard.id}/trips`;
    const res = await fetch(url, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(data.error ?? "Não deu para salvar");
      throw new Error("save failed");
    }
    await refetchTrips();
  }

  async function deleteTrip(id: string) {
    const res = await fetch(`/api/trips/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Não deu para excluir");
      return;
    }
    await refetchTrips();
  }

  // Marcar item pelo cartão. O estado vive aqui (é o dono da lista de
  // viagens), não no cartão: assim o total "já gasto" do topo reage na hora.
  async function toggleItem(item: ChecklistItemDTO) {
    const done = !item.done;
    setTrips((prev) =>
      prev.map((t) =>
        t.id !== item.tripId
          ? t
          : {
              ...t,
              items: t.items.map((i) =>
                i.id === item.id ? { ...i, done } : i,
              ),
            },
      ),
    );
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      if (!res.ok) throw new Error("falhou");
    } catch {
      toast("Não deu para marcar");
      await refetchTrips();
    }
  }

  async function cycleStatus(t: TripDTO) {
    const next = nextStatus(t.status);
    // otimista
    setTrips((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)),
    );
    try {
      await saveTrip(t.id, { status: next });
      toast(`${t.dest} → ${STATUS_LABEL[next]}`);
    } catch {
      await refetchTrips();
    }
  }

  // ----- derived -----
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      todos: trips.length,
      IDEIA: 0,
      PLANEJANDO: 0,
      RESERVADO: 0,
      FEITA: 0,
    };
    trips.forEach((t) => {
      c[t.status] = (c[t.status] ?? 0) + 1;
    });
    return c;
  }, [trips]);

  const stats = useMemo(() => {
    const locked = trips.filter(
      (t) => t.status === "RESERVADO" || t.status === "FEITA",
    ).length;
    const done = trips.filter((t) => t.status === "FEITA").length;
    const money = trips
      .filter((t) => t.status !== "FEITA")
      .reduce((s, t) => s + (t.budgetCents ?? 0), 0);
    // Somam TODAS as viagens, inclusive as já feitas: dinheiro que saiu não
    // deixa de ter saído porque a viagem acabou.
    const spent = trips.reduce((s, t) => s + totalPago(t.items), 0);
    const owed = trips.reduce((s, t) => s + totalAPagar(t.items), 0);
    return { total: trips.length, locked, done, money, spent, owed };
  }, [trips]);

  const filtered =
    filter === "todos" ? trips : trips.filter((t) => t.status === filter);

  /* A linha do tempo é sobre o que ainda vai acontecer. Viagem feita sai dela
     e desce para o bloco "Já rolou", recolhido no fim — continua acessível,
     mas para de competir por atenção com o que está por vir. */
  const ativas = useMemo(
    () => trips.filter((t) => t.status !== "FEITA"),
    [trips],
  );
  const arquivadas = useMemo(
    () =>
      trips
        .filter((t) => t.status === "FEITA")
        .sort((a, b) => (b.year || 0) - (a.year || 0)),
    [trips],
  );

  /* A viagem em destaque. Depende de "hoje", então só existe depois que o
     componente monta — mesmo motivo da contagem regressiva nos cartões. */
  const destaque = useMemo(
    () => (hoje ? proximaViagem(ativas, hoje) : null),
    [ativas, hoje],
  );

  const years = useMemo(() => {
    const set = new Set<number>(BASE_YEARS);
    ativas.forEach((t) => {
      if (t.year && t.year > 0) set.add(t.year);
    });
    return [...set].sort((a, b) => a - b);
  }, [ativas]);

  const hasSomeday = ativas.some((t) => !t.year || t.year <= 0);

  // ----- render helpers -----
  function moneyForYear(list: TripDTO[]) {
    const m = list
      .filter((t) => t.status !== "FEITA")
      .reduce((s, t) => s + (t.budgetCents ?? 0), 0);
    return m ? formatBRL(m) : null;
  }

  const filtering = filter !== "todos";

  return (
    <>
      {/* ---------- app bar ---------- */}
      <div className="appbar">
        <div className="appbar-in">
          <div className="brand">
            <span className="mark" />
            <h1>CoTrip</h1>
          </div>

          <div className="switcher">
            <select
              aria-label="Trocar de quadro"
              value={activeBoard.id}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__new__") {
                  setModal({ type: "newboard" });
                } else {
                  router.push(`/app?board=${v}`);
                }
              }}
            >
              {/* <optgroup> separa os dois mundos dentro do próprio <select>,
                  sem precisar de menu customizado — e o nativo é o que melhor
                  funciona no celular. */}
              {boards.filter((b) => (b.memberCount ?? 1) <= 1).length > 0 && (
                <optgroup label="Só minhas">
                  {boards
                    .filter((b) => (b.memberCount ?? 1) <= 1)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </optgroup>
              )}
              {boards.filter((b) => (b.memberCount ?? 1) > 1).length > 0 && (
                <optgroup label="Compartilhados">
                  {boards
                    .filter((b) => (b.memberCount ?? 1) > 1)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} · {b.memberCount}
                      </option>
                    ))}
                </optgroup>
              )}
              <option value="__new__">+ Novo quadro</option>
            </select>
          </div>

          <span className="spacer" />

          <span
            className="sync-pill"
            title="As mudanças da equipe aparecem sozinhas"
          >
            <span className="live" />
            ao vivo
          </span>

          {/* No celular a barra nao cabe com todos os rotulos: o texto some e
              fica so o icone. O aria-label garante que o leitor de tela
              continue anunciando a acao inteira nos dois tamanhos. */}
          <button
            className="btn btn-share"
            onClick={() => setModal({ type: "share" })}
            title="Compartilhar quadro"
            aria-label="Compartilhar quadro"
          >
            <svg
              className="ico"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              <path d="M2.5 20.5a6.5 6.5 0 0 1 13 0" />
              <path d="M18 8.5v6M15 11.5h6" />
            </svg>
            <span className="lbl">Compartilhar</span>
          </button>

          <BotaoTema />

          <span className="user-chip">
            <span className="avatar" title={currentUser.email}>
              {initials}
            </span>
          </span>

          <button
            className="btn btn-ghost btn-signout"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sair
          </button>
        </div>
      </div>

      {/* ---------- intro + stats ---------- */}
      <div className="wrap">
        <section className="intro">
          <div className="kicker">
            {activeBoard.name}
            <span className={`selo-quadro${solo ? " solo" : ""}`}>
              {seloQuadro}
            </span>
          </div>
          <h2>
            {solo
              ? "As viagens que você sempre fala em fazer"
              : "As viagens que vocês sempre falam em fazer"}
          </h2>
          <p className="lede">
            Tira do “um dia a gente vai” e bota no papel. Cada ideia vira plano,
            vira reserva, vira lembrança.
          </p>
        </section>

        {/* O painel de destaque some quando há filtro ativo: ali a pessoa
            está procurando algo específico, e um bloco grande fora do
            filtro seria ruído. */}
        {destaque &&
          !filtering &&
          /* Durante a viagem o painel vira outra coisa. "hoje" so existe
             depois que o componente monta — no servidor seria UTC, e a
             virada do dia cairia na hora errada para quem esta em outro
             fuso, que e exatamente a pessoa em viagem. */
          (hoje && estaEmViagem(destaque, hoje) ? (
            <EmViagem
              trip={destaque}
              hoje={hoje}
              onAbrir={() => setModal({ type: "trip", trip: destaque })}
              onLancarGasto={() =>
                setModal({ type: "trip", trip: destaque, aba: "destino" })
              }
            />
          ) : (
            <ProximaViagem
              trip={destaque}
              hoje={hoje}
              onAbrir={() => setModal({ type: "trip", trip: destaque })}
            />
          ))}

        {/* ---------- filters ---------- */}
        <div className="filters">
          <button
            className="chip"
            aria-pressed={filter === "todos"}
            onClick={() => setFilter("todos")}
          >
            Todas<span className="n">{counts.todos}</span>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className="chip"
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
            >
              <span className="dot" style={{ background: STATUS_COR[s] }} />
              {STATUS_LABEL[s]}
              <span className="n">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---------- board ---------- */}
      <div className="wrap">
        <div className="board">
          {trips.length === 0 ? (
            <div className="empty">
              <div className="big">🧭</div>
              <h3>O quadro está em branco</h3>
              <p>Comece pela primeira ideia de viagem.</p>
              <div className="row">
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    setModal({ type: "trip", trip: null, presetYear: CUR })
                  }
                >
                  <span className="plus">+</span> Adicionar viagem
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* A linha e desenhada uma vez so, aqui: marcos de ano e viagens
                  precisam ser irmaos no mesmo grid para o fio passar por todos. */}
              <div className="fluxo">
                {years.map((y) => {
                  const list = ativas
                    .filter((t) => t.year === y)
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                  const shown = filtering
                    ? list.filter((t) => t.status === filter)
                    : list;
                  if (filtering && shown.length === 0) return null;
                  return (
                    <YearSection
                      key={y}
                      title={String(y)}
                      someday={false}
                      count={list.length}
                      money={moneyForYear(list)}
                      trips={shown}
                      showAdd={!filtering}
                      onAdd={() =>
                        setModal({ type: "trip", trip: null, presetYear: y })
                      }
                      onOpen={(t) => setModal({ type: "trip", trip: t })}
                      onCycle={cycleStatus}
                      onToggleItem={toggleItem}
                      hoje={hoje}
                    />
                  );
                })}

                {hasSomeday &&
                  (() => {
                    const list = ativas
                      .filter((t) => !t.year || t.year <= 0)
                      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                    const shown = filtering
                      ? list.filter((t) => t.status === filter)
                      : list;
                    if (filtering && shown.length === 0) return null;
                    return (
                      <YearSection
                        key="someday"
                        title="Algum dia"
                        someday
                        count={list.length}
                        money={moneyForYear(list)}
                        trips={shown}
                        showAdd={!filtering}
                        onAdd={() =>
                          setModal({ type: "trip", trip: null, presetYear: 0 })
                        }
                        onOpen={(t) => setModal({ type: "trip", trip: t })}
                        onCycle={cycleStatus}
                        onToggleItem={toggleItem}
                        hoje={hoje}
                      />
                    );
                  })()}
              </div>

              {/* Nada ativo, mas tem histórico: sem isto a área ficaria em
                  branco e pareceria bug. */}
              {!filtering && ativas.length === 0 && arquivadas.length > 0 && (
                <div className="empty">
                  <div className="big">✦</div>
                  <h3>Tudo que estava no radar já foi feito</h3>
                  <p>Bora escolher a próxima?</p>
                </div>
              )}

              {filtering && filtered.length === 0 && (
                <div className="empty">
                  <div className="big">🔍</div>
                  <h3>Nenhuma viagem “{STATUS_LABEL[filter as Status]}”</h3>
                  <p>Troque o filtro para ver as outras.</p>
                </div>
              )}

              {arquivadas.length > 0 && (
                <Arquivo
                  trips={arquivadas}
                  // Aberto por padrao: deixou de ser arquivo morto e virou o
                  // diario de bordo. Esconder as historias atras de um clique
                  // era certo quando o bloco era uma lista de nomes riscados.
                  aberto
                  onOpen={(t) => setModal({ type: "trip", trip: t })}
                />
              )}
            </>
          )}
        </div>

        {/* O resumo desceu do topo para cá a pedido: no celular ele ocupava a
            primeira tela inteira e empurrava as viagens para baixo. Aqui vira
            fechamento de contas de quem rolou até o fim. */}
        {trips.length > 0 && (
          <section className="resumo">
            <h2 className="resumo-tit">No geral</h2>
            <div className="stats">
              <div className="stat">
                <div className="num">{stats.total}</div>
                {/* "viagem" faz plural em -ns, não em -s: virava "viagems". */}
                <div className="lab">
                  {stats.total === 1 ? "viagem" : "viagens"} no radar
                </div>
              </div>
              <div className="stat accent">
                <div className="num">{stats.locked}</div>
                <div className="lab">reservadas ou feitas</div>
              </div>
              <div className="stat">
                <div className="num">{stats.done}</div>
                <div className="lab">já riscadas</div>
              </div>
              <div className="stat">
                <div className="num">
                  {stats.money ? formatBRL(stats.money) : "—"}
                </div>
                <div className="lab">estimado por pessoa*</div>
              </div>
              <div className="stat">
                <div className="num">
                  {stats.spent ? formatBRL(stats.spent) : "—"}
                </div>
                <div className="lab">já pago por pessoa</div>
              </div>
              <div className="stat">
                <div className="num">
                  {stats.owed ? formatBRL(stats.owed) : "—"}
                </div>
                <div className="lab">ainda vai sair</div>
              </div>
            </div>
          </section>
        )}

        <footer className="foot">
          {solo ? (
            <>
              <b>Esse quadro é só seu.</b> Ninguém mais enxerga o que está aqui.
              Para planejar junto com alguém, use “Compartilhar” — ou crie um
              quadro novo e deixe este como seu espaço solo. <br />
            </>
          ) : (
            <>
              <b>Compartilhando:</b> use “Compartilhar” e convide mais gente
              pelo email. Vocês editam o mesmo quadro — o que uma muda, a outra
              vê. <br />
            </>
          )}
          <span style={{ opacity: 0.8 }}>
            *Somatório dos orçamentos das viagens que ainda não foram feitas.
          </span>
        </footer>
      </div>

      {/* floating add */}
      {trips.length > 0 && (
        <button
          className="btn btn-primary"
          style={{
            position: "fixed",
            right: "18px",
            bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
            zIndex: 40,
            boxShadow: "var(--shadow-lg)",
          }}
          onClick={() =>
            setModal({ type: "trip", trip: null, presetYear: CUR })
          }
        >
          <span className="plus">+</span>{" "}
          <span className="lbl">Nova viagem</span>
        </button>
      )}

      {/* ---------- modals ---------- */}
      {modal?.type === "trip" && (
        <TripModal
          trip={modal.trip}
          presetYear={modal.presetYear ?? CUR}
          abaInicial={modal.aba}
          defaultPeople={members.length}
          membros={members}
          onClose={closeModal}
          onSave={async (id, body) => {
            await saveTrip(id, body);
            toast(id ? "Viagem atualizada" : "Viagem adicionada ✦");
            setModal(null);
          }}
          onDelete={async (id) => {
            await deleteTrip(id);
            toast("Viagem excluída");
            setModal(null);
          }}
        />
      )}

      {modal?.type === "share" && (
        <ShareModal
          boardId={activeBoard.id}
          boardName={activeBoard.name}
          isOwner={isOwner}
          initialMembers={members}
          currentUserId={currentUser.id}
          tripCount={trips.length}
          unicoQuadro={boards.length <= 1}
          onClose={closeModal}
          onToast={toast}
          onRenamed={() => router.refresh()}
          onDeleted={() => {
            setModal(null);
            router.push("/app");
            router.refresh();
          }}
        />
      )}

      {modal?.type === "newboard" && (
        <NewBoardModal
          onClose={closeModal}
          onCreated={(id, compartilhar) => {
            setModal(null);
            // "&convidar=1" faz o quadro novo abrir já com a janela de
            // convite na frente — ver `abrirCompartilhar` lá em cima.
            router.push(`/app?board=${id}${compartilhar ? "&convidar=1" : ""}`);
          }}
          onToast={toast}
        />
      )}

      {/* toast */}
      <div className={`toast${toastMsg ? " show" : ""}`}>{toastMsg}</div>
    </>
  );
}

/* ============================================================
   Seção de ano (trilha + cards)
   ============================================================ */
