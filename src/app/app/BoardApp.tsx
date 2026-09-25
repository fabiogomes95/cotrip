"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  STATUSES,
  STATUS_LABEL,
  nextStatus,
  type Status,
} from "@/lib/status";
import {
  centavosParaCampo,
  formatBRL,
  parseCentavos,
  yearLabel,
} from "@/lib/format";
import {
  compararComOrcamento,
  feitos,
  totalAPagar,
  totalContratado,
  totalPago,
} from "@/lib/checklist";
import { contagem, formatarPeriodo, noites } from "@/lib/datas";
import {
  faltaCents,
  pagoCents,
  parcelasRestantes,
  proximoVencimento,
  valorParcela,
} from "@/lib/parcelas";
import type {
  BoardSummary,
  ChecklistItemDTO,
  InviteDTO,
  MemberDTO,
  Role,
  TripDTO,
} from "@/types";

const CUR = new Date().getFullYear();
const BASE_YEARS = [CUR, CUR + 1, CUR + 2, CUR + 3];
const POLL_MS = 12000;


type Modal =
  | { type: "trip"; trip: TripDTO | null; presetYear?: number }
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
              items: t.items.map((i) => (i.id === item.id ? { ...i, done } : i)),
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
    setTrips((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
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
  const ativas = useMemo(() => trips.filter((t) => t.status !== "FEITA"), [trips]);
  const arquivadas = useMemo(
    () =>
      trips
        .filter((t) => t.status === "FEITA")
        .sort((a, b) => (b.year || 0) - (a.year || 0)),
    [trips],
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

          <span className="sync-pill" title="As mudanças da equipe aparecem sozinhas">
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
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              <path d="M2.5 20.5a6.5 6.5 0 0 1 13 0" />
              <path d="M18 8.5v6M15 11.5h6" />
            </svg>
            <span className="lbl">Compartilhar</span>
          </button>

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
            <span className={`selo-quadro${solo ? " solo" : ""}`}>{seloQuadro}</span>
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
              <span className="dot" style={{ background: `var(--st-${s.toLowerCase()})` }} />
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
                  onClick={() => setModal({ type: "trip", trip: null, presetYear: CUR })}
                >
                  <span className="plus">+</span> Adicionar viagem
                </button>
              </div>
            </div>
          ) : (
            <>
              {years.map((y, idx) => {
                const list = ativas
                  .filter((t) => t.year === y)
                  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                const shown = filtering
                  ? list.filter((t) => t.status === filter)
                  : list;
                if (filtering && shown.length === 0) return null;
                const isLast = idx === years.length - 1 && !hasSomeday;
                return (
                  <YearSection
                    key={y}
                    title={String(y)}
                    someday={false}
                    count={list.length}
                    money={moneyForYear(list)}
                    isLast={isLast}
                    trips={shown}
                    showAdd={!filtering}
                    onAdd={() => setModal({ type: "trip", trip: null, presetYear: y })}
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
                      isLast
                      trips={shown}
                      showAdd={!filtering}
                      onAdd={() => setModal({ type: "trip", trip: null, presetYear: 0 })}
                      onOpen={(t) => setModal({ type: "trip", trip: t })}
                      onCycle={cycleStatus}
                      onToggleItem={toggleItem}
                      hoje={hoje}
                    />
                  );
                })()}

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
                  // Se a pessoa filtrou justamente por "Feita", o bloco abre
                  // sozinho — senão ela filtraria e não veria nada.
                  aberto={filter === "FEITA"}
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
                <div className="num">{stats.money ? formatBRL(stats.money) : "—"}</div>
                <div className="lab">estimado por pessoa*</div>
              </div>
              <div className="stat">
                <div className="num">{stats.spent ? formatBRL(stats.spent) : "—"}</div>
                <div className="lab">já pago por pessoa</div>
              </div>
              <div className="stat">
                <div className="num">{stats.owed ? formatBRL(stats.owed) : "—"}</div>
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
              <b>Compartilhando:</b> use “Compartilhar” e convide mais gente pelo
              email. Vocês editam o mesmo quadro — o que uma muda, a outra vê.{" "}
              <br />
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
          onClick={() => setModal({ type: "trip", trip: null, presetYear: CUR })}
        >
          <span className="plus">+</span> <span className="lbl">Nova viagem</span>
        </button>
      )}

      {/* ---------- modals ---------- */}
      {modal?.type === "trip" && (
        <TripModal
          trip={modal.trip}
          presetYear={modal.presetYear ?? CUR}
          defaultPeople={members.length}
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
function YearSection({
  title,
  someday,
  count,
  money,
  isLast,
  trips,
  showAdd,
  onAdd,
  onOpen,
  onCycle,
  onToggleItem,
  hoje,
}: {
  title: string;
  someday: boolean;
  count: number;
  money: string | null;
  isLast: boolean;
  trips: TripDTO[];
  showAdd: boolean;
  onAdd: () => void;
  onOpen: (t: TripDTO) => void;
  onCycle: (t: TripDTO) => void;
  onToggleItem: (i: ChecklistItemDTO) => void;
  hoje: Date | null;
}) {
  return (
    <section
      className={`year${someday ? " someday" : ""}`}
      style={isLast ? undefined : undefined}
    >
      <div className="rail">
        <span className="dot" />
      </div>
      <div className="year-body">
        <div className="year-head">
          <h2>{title}</h2>
          <span className="meta">
            {count
              ? `${count} ${count === 1 ? "viagem" : "viagens"}`
              : "nada por aqui ainda"}
            {money ? (
              <>
                {" · "}
                <b>{money}</b>
              </>
            ) : null}
          </span>
        </div>
        <div className="grid">
          {trips.map((t) => (
            <TripCard
              key={t.id}
              trip={t}
              onOpen={onOpen}
              onCycle={onCycle}
              onToggleItem={onToggleItem}
              hoje={hoje}
            />
          ))}
          {showAdd && (
            <button className="add-card" onClick={onAdd}>
              <span style={{ fontSize: "17px" }}>+</span> viagem em{" "}
              {someday ? "algum dia" : title}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Card de viagem
   ============================================================ */
function TripCard({
  trip,
  onOpen,
  onCycle,
  onToggleItem,
  hoje,
}: {
  trip: TripDTO;
  onOpen: (t: TripDTO) => void;
  onCycle: (t: TripDTO) => void;
  onToggleItem: (i: ChecklistItemDTO) => void;
  hoje: Date | null;
}) {
  /* Datas exatas mandam: quando existem, substituem a época em texto livre.
     "12 a 19 de nov de 2026" diz mais que "Novembro · 2026". */
  const periodo = formatarPeriodo(trip.startDate, trip.endDate);
  const when =
    periodo ??
    ([trip.whenText, trip.year && trip.year > 0 ? trip.year : null]
      .filter(Boolean)
      .join(" · ") ||
      "algum dia");

  const quanto = hoje ? contagem(trip.startDate, trip.endDate, hoje) : null;
  const dias = noites(trip.startDate, trip.endDate);

  /* O cartão tem três zonas, e elas são <button> separados de propósito:
     antes o cartão inteiro era um botão só, e o checklist tinha ficado
     dentro dele — botão dentro de botão é HTML inválido e o clique na
     caixinha nunca chegaria a marcar o item, só abriria a viagem. */
  return (
    <article className={`trip s-${trip.status}`}>
      <button
        className={`status s-${trip.status}`}
        title="Avançar status"
        aria-label={`Status: ${STATUS_LABEL[trip.status]}. Clique para avançar`}
        onClick={() => onCycle(trip)}
      >
        <span className="sd" />
        {STATUS_LABEL[trip.status]}
      </button>

      {/* zona de leitura — abre a viagem */}
      <button className="trip-open" onClick={() => onOpen(trip)}>
        <div className="trip-row1">
          <span className="when">{when}</span>
        </div>
        {(quanto || dias != null) && (
          <div className="trip-datas">
            {quanto && (
              <span className={`conta e-${quanto.estado}`}>{quanto.txt}</span>
            )}
            {dias != null && dias > 0 && (
              <span className="dur">
                {dias} {dias === 1 ? "noite" : "noites"}
              </span>
            )}
          </div>
        )}
        <h3 className="dest">{trip.dest || "Sem nome"}</h3>
        {trip.note && <p className="note">{trip.note}</p>}
      </button>

      {/* zona interativa — marcar item sem abrir nada */}
      {trip.items.length > 0 && (
        <CardChecklist trip={trip} onToggle={onToggleItem} />
      )}

      <div className="trip-foot">
        {trip.budgetCents && trip.budgetCents > 0 ? (
          <span className="budget">
            {formatBRL(trip.budgetCents)} <span className="per">/pessoa</span>
            {/* Segunda linha em vez de tudo emendado: numa só, o texto
                empurrava o "editar →" e o rodapé quebrava torto. */}
            {trip.people > 1 && (
              <span className="total">
                {trip.people} pessoas · {formatBRL(trip.budgetCents * trip.people)}
              </span>
            )}
          </span>
        ) : (
          <span className="budget empty">sem orçamento</span>
        )}
        <button type="button" className="edit-hint" onClick={() => onOpen(trip)}>
          editar →
        </button>
      </div>
    </article>
  );
}

/* ============================================================
   Botão de ação destrutiva, em dois tempos

   O primeiro clique troca o rótulo por "Confirmar?", o segundo executa.
   Escolhi isto em vez do confirm() nativo porque no celular o confirm vira
   um alerta do sistema, descolado da tela — e porque aqui o aviso aparece
   exatamente onde o dedo já está.

   Desarma sozinho depois de alguns segundos: um botão que ficou armado e
   esquecido vira armadilha para o próximo clique distraído.
   ============================================================ */
function BotaoPerigo({
  label,
  confirmLabel = "Confirmar?",
  onConfirm,
  className = "",
  title,
}: {
  label: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  title?: string;
}) {
  const [armado, setArmado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function clique() {
    if (!armado) {
      setArmado(true);
      timer.current = setTimeout(() => setArmado(false), 4000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmado(false);
    onConfirm();
  }

  return (
    <button
      type="button"
      className={`btn btn-danger${armado ? " armado" : ""}${className ? ` ${className}` : ""}`}
      onClick={clique}
      title={title}
      aria-live="polite"
    >
      {armado ? confirmLabel : label}
    </button>
  );
}

/* ============================================================
   Modal de viagem (criar / editar)
   ============================================================ */
function TripModal({
  trip,
  presetYear,
  defaultPeople,
  onClose,
  onSave,
  onDelete,
}: {
  trip: TripDTO | null;
  presetYear: number;
  /** Quantas pessoas a viagem nova assume: o tamanho do quadro. */
  defaultPeople: number;
  onClose: () => void;
  onSave: (id: string | null, body: Partial<TripDTO>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [dest, setDest] = useState(trip?.dest ?? "");
  const [whenText, setWhenText] = useState(trip?.whenText ?? "");
  const [year, setYear] = useState<number>(trip ? trip.year : presetYear);
  const [ida, setIda] = useState(trip?.startDate ?? "");
  const [volta, setVolta] = useState(trip?.endDate ?? "");
  const [status, setStatus] = useState<Status>(trip?.status ?? "IDEIA");
  const [budget, setBudget] = useState<string>(centavosParaCampo(trip?.budgetCents));
  const [note, setNote] = useState(trip?.note ?? "");
  const [people, setPeople] = useState<string>(
    String(trip ? trip.people : Math.max(1, defaultPeople)),
  );
  const [saving, setSaving] = useState(false);
  const destRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => destRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const yearOptions: number[] = [];
  for (let y = CUR; y <= CUR + 4; y++) yearOptions.push(y);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dest.trim()) {
      destRef.current?.focus();
      return;
    }
    setSaving(true);
    const body: Partial<TripDTO> = {
      dest: dest.trim(),
      whenText: whenText.trim(),
      year,
      status,
      // Data vazia vai como null, não como "": o schema espera AAAA-MM-DD ou
      // nulo, e string vazia seria recusada.
      startDate: ida || null,
      endDate: volta || null,
      budgetCents: parseCentavos(budget),
      people: Math.min(50, Math.max(1, Math.round(Number(people) || 1))),
      note: note.trim(),
    };
    try {
      await onSave(trip?.id ?? null, body);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit}>
        <h3>{trip ? "Editar viagem" : "Nova viagem"}</h3>
        <div className="sub">{trip ? trip.dest : "Pra onde vocês querem ir?"}</div>

        <div className="field">
          <label htmlFor="t-dest">Destino</label>
          <input
            id="t-dest"
            ref={destRef}
            type="text"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="Fernando de Noronha, Lisboa, Chapada…"
            autoComplete="off"
            required
          />
        </div>

        <div className="two">
          <div className="field">
            <label htmlFor="t-when">Quando (época)</label>
            <input
              id="t-when"
              type="text"
              value={whenText}
              onChange={(e) => setWhenText(e.target.value)}
              placeholder="Julho, Carnaval, verão…"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="t-year">Ano</label>
            {/* Com data de ida preenchida o ano deixa de ser escolha: vem
                dela. Manter os dois editáveis permitiria uma viagem marcada
                para março de 2027 aparecer na faixa de 2026. */}
            <select
              id="t-year"
              value={ida ? Number(ida.slice(0, 4)) : year}
              disabled={!!ida}
              title={ida ? "Vem da data de ida" : undefined}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              <option value={0}>Algum dia / sem data</option>
            </select>
          </div>
        </div>

        <div className="two">
          <div className="field">
            <label htmlFor="t-ida">Ida (se já souber)</label>
            <input
              id="t-ida"
              type="date"
              value={ida}
              onChange={(e) => {
                const v = e.target.value;
                setIda(v);
                // Volta antes da ida não faz sentido; em vez de recusar
                // depois, ajusto na hora.
                if (v && volta && volta < v) setVolta(v);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="t-volta">Volta</label>
            <input
              id="t-volta"
              type="date"
              value={volta}
              min={ida || undefined}
              disabled={!ida}
              title={!ida ? "Preencha a ida primeiro" : undefined}
              onChange={(e) => setVolta(e.target.value)}
            />
          </div>
        </div>

        {ida && (
          <p className="dica-datas">
            {formatarPeriodo(ida, volta || null)}
            {noites(ida, volta || null) != null &&
              noites(ida, volta || null)! > 0 &&
              ` · ${noites(ida, volta || null)} noites`}
          </p>
        )}

        <div className="field">
          <label>Status</label>
          <div className="seg">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`p-${s}`}
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
              >
                <span className="sd" />
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="two">
          <div className="field">
            <label htmlFor="t-budget">Orçamento · por pessoa (R$)</label>
            {/* type="text", não "number": o input numérico do navegador
                rejeita vírgula, e ninguém escreve "2190.47" em português.
                O inputMode abre o teclado numérico no celular assim mesmo. */}
            <input
              id="t-budget"
              type="text"
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="ex: 2500 ou 2190,47"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="t-people">Quantas pessoas</label>
            <input
              id="t-people"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              step={1}
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {/* O total só aparece quando muda alguma coisa: com 1 pessoa ele
            seria igual ao orçamento e viraria ruído. */}
        {Number(people) > 1 && (parseCentavos(budget) ?? 0) > 0 && (
          <p className="total-viagem">
            {people} × {formatBRL(parseCentavos(budget))} ={" "}
            <b>{formatBRL((parseCentavos(budget) ?? 0) * Number(people))}</b> no
            total
          </p>
        )}

        <div className="field">
          <label htmlFor="t-note">Anotações</label>
          <textarea
            id="t-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="o que fazer, onde ficar, com quem, links…"
          />
        </div>

        {/* O checklist tem ids próprios no banco, então precisa da viagem já
            criada para pendurar os itens. Em viagem nova ele aparece como
            aviso em vez de sumir: assim a pessoa sabe que existe. */}
        {trip ? (
          <Checklist
            tripId={trip.id}
            initial={trip.items}
            budgetCents={trip.budgetCents}
          />
        ) : (
          <div className="field">
            <label>Checklist</label>
            <p className="check-vazio">
              Salve a viagem e o checklist abre aqui — aí você lança passagem,
              hospedagem e os valores reais de cada um.
            </p>
          </div>
        )}

        <div className="sheet-actions">
          {trip && (
            <BotaoPerigo
              label="Excluir"
              confirmLabel="Excluir mesmo?"
              onConfirm={() => void onDelete(trip.id)}
              title="Apaga a viagem e todo o checklist dela"
            />
          )}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Modal de compartilhamento (membros + convites)
   ============================================================ */
function ShareModal({
  boardId,
  boardName,
  isOwner,
  initialMembers,
  currentUserId,
  tripCount,
  unicoQuadro,
  onClose,
  onToast,
  onRenamed,
  onDeleted,
}: {
  boardId: string;
  boardName: string;
  isOwner: boolean;
  initialMembers: MemberDTO[];
  currentUserId: string;
  tripCount: number;
  /** Bloqueia a exclusão: sem nenhum quadro o app recriaria um vazio na hora,
      o que parece bug em vez de intenção. */
  unicoQuadro: boolean;
  onClose: () => void;
  onToast: (m: string) => void;
  onRenamed: () => void;
  onDeleted: () => void;
}) {
  const [members, setMembers] = useState<MemberDTO[]>(initialMembers);
  const [invites, setInvites] = useState<InviteDTO[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [nome, setNome] = useState(boardName);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/boards/${boardId}/members`, {
          cache: "no-store",
          signal,
        });
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members);
          setInvites(data.invites);
        }
      } catch {
        /* abortado ou rede fora: mantém a lista que já está na tela */
      }
    },
    [boardId],
  );

  useEffect(() => {
    // O AbortController evita escrever estado depois que o modal fechou —
    // a busca é cancelada junto com o componente.
    const ac = new AbortController();
    // Busca ao montar: o setState acontece depois do await, não de forma
    // síncrona, então a regra aqui é falso positivo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast(data.error ?? "Não deu para convidar");
      } else if (data.status === "added") {
        onToast("Adicionada ao quadro ✦");
        setEmail("");
        await load();
      } else {
        onToast("Convite registrado — vale quando ela criar a conta");
        setEmail("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function renomear() {
    const v = nome.trim();
    if (!v || v === boardName) {
      setNome(boardName); // campo vazio não vira nome vazio: desfaz
      return;
    }
    const res = await fetch(`/api/boards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: v }),
    });
    if (res.ok) {
      onToast("Quadro renomeado");
      onRenamed();
    } else {
      const d = await res.json().catch(() => ({}));
      onToast(d.error ?? "Não deu para renomear");
      setNome(boardName);
    }
  }

  async function excluirQuadro() {
    const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
    if (res.ok) {
      onToast("Quadro excluído");
      onDeleted();
    } else {
      const d = await res.json().catch(() => ({}));
      onToast(d.error ?? "Não deu para excluir");
    }
  }

  async function removeMember(userId: string) {
    const res = await fetch(`/api/boards/${boardId}/members?userId=${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onToast("Membro removido");
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      onToast(d.error ?? "Não deu para remover");
    }
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={invite}>
        <h3>O quadro</h3>
        <div className="sub">quem entrar aqui edita junto com você</div>

        {isOwner ? (
          <div className="field">
            <label htmlFor="b-rename">Nome do quadro</label>
            <input
              id="b-rename"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onBlur={renomear}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              autoComplete="off"
            />
          </div>
        ) : (
          <div className="field">
            <label>Nome do quadro</label>
            <p className="check-vazio">{boardName}</p>
          </div>
        )}

        <div className="member-list">
          {members.map((m) => (
            <div className="member" key={m.userId}>
              <span className="avatar">
                {(m.name || m.email).charAt(0).toUpperCase()}
              </span>
              <div className="who">
                <div className="nm">
                  {m.name} {m.userId === currentUserId ? "(você)" : ""}
                </div>
                <div className="em">{m.email}</div>
              </div>
              <span className={`role-tag${m.role === "OWNER" ? " owner" : ""}`}>
                {m.role === "OWNER" ? "Dono" : "Editor"}
              </span>
              {isOwner && m.role !== "OWNER" && (
                <BotaoPerigo
                  label="✕"
                  confirmLabel="Remover?"
                  className="btn-mini"
                  onConfirm={() => void removeMember(m.userId)}
                  title={`Remover ${m.name} do quadro`}
                />
              )}
            </div>
          ))}

          {invites.map((i) => (
            <div className="member" key={i.id}>
              <span className="avatar">{i.email.charAt(0).toUpperCase()}</span>
              <div className="who">
                <div className="nm">{i.email}</div>
                <div className="em">convite pendente</div>
              </div>
              <span className="role-tag pending">Pendente</span>
            </div>
          ))}
        </div>

        {isOwner ? (
          <>
            <div className="field" style={{ marginBottom: 8 }}>
              <label htmlFor="s-email">Convidar por email</label>
              <div className="invite-row">
                <input
                  id="s-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amiga@email.com"
                  autoComplete="off"
                />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "…" : "Convidar"}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: "4px 0 0" }}>
              Se a pessoa já tiver conta, entra na hora. Se não, o convite é aceito
              automaticamente quando ela se cadastrar com esse email.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>
            Só o dono do quadro pode convidar novas pessoas.
          </p>
        )}

        {isOwner && (
          <div className="zona-perigo">
            {unicoQuadro ? (
              <p className="check-vazio">
                Este é seu único quadro. Crie outro antes de apagar este.
              </p>
            ) : (
              <>
                <div className="txt">
                  <b>Excluir este quadro</b>
                  <span>
                    Apaga {tripCount} {tripCount === 1 ? "viagem" : "viagens"} e
                    todos os checklists. Não dá para desfazer.
                  </span>
                </div>
                <BotaoPerigo
                  label="Excluir quadro"
                  confirmLabel="Apagar tudo?"
                  onConfirm={() => void excluirQuadro()}
                />
              </>
            )}
          </div>
        )}

        <div className="sheet-actions">
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Modal de novo quadro
   ============================================================ */
function NewBoardModal({
  onClose,
  onCreated,
  onToast,
}: {
  onClose: () => void;
  onCreated: (id: string, compartilhar: boolean) => void;
  onToast: (m: string) => void;
}) {
  const [name, setName] = useState("");
  /* Todo quadro nasce solo — você é o único membro. "Compartilhado" não é um
     tipo diferente no banco: é só a promessa de já abrir o convite depois de
     criar, para a pessoa não ter que ir caçar o botão. */
  const [compartilhar, setCompartilhar] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast(data.error ?? "Não deu para criar");
        setBusy(false);
        return;
      }
      onToast("Quadro criado ✦");
      onCreated(data.id, compartilhar);
    } catch {
      onToast("Não deu para criar");
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit} style={{ maxWidth: 440 }}>
        <h3>Novo quadro</h3>
        <div className="sub">Um espaço separado de viagens</div>
        <div className="field">
          <label htmlFor="b-name">Nome do quadro</label>
          <input
            id="b-name"
            ref={ref}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={compartilhar ? "Ex: Viagens com a galera" : "Ex: Minhas viagens solo"}
            autoComplete="off"
            required
          />
        </div>

        <div className="field">
          <label>Quem vai enxergar</label>
          <div className="seg seg-2">
            <button
              type="button"
              aria-pressed={!compartilhar}
              onClick={() => setCompartilhar(false)}
            >
              <span className="t">Só eu</span>
              <span className="d">seu espaço privado</span>
            </button>
            <button
              type="button"
              aria-pressed={compartilhar}
              onClick={() => setCompartilhar(true)}
            >
              <span className="t">Compartilhado</span>
              <span className="d">convida alguém em seguida</span>
            </button>
          </div>
        </div>
        <div className="sheet-actions">
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Criando…" : "Criar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Checklist da viagem

   Diferente do resto do formulário, o checklist grava direto na API a cada
   mexida, sem esperar o "Salvar". Dois motivos: os itens são registros
   próprios no banco (têm id), e marcar "hospedagem: ok" é o tipo de gesto
   que a pessoa faz de passagem, sem querer preencher um formulário inteiro.

   Cuidado ao mexer: isto vive DENTRO do <form> do TripModal. Não pode haver
   <form> aninhado, e todo <button> precisa de type="button" — sem isso o
   clique dispara o submit da viagem.
   ============================================================ */
function Checklist({
  tripId,
  initial,
  budgetCents,
}: {
  tripId: string;
  initial: ChecklistItemDTO[];
  budgetCents: number | null;
}) {
  const [items, setItems] = useState<ChecklistItemDTO[]>(initial);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const ok = feitos(items);
  const contratado = totalContratado(items);
  const pago = totalPago(items);
  const aPagar = totalAPagar(items);

  async function api<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não deu para salvar");
    return data as T;
  }

  async function adicionar() {
    const label = novo.trim();
    if (!label || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const { item } = await api<{ item: ChecklistItemDTO }>(
        `/api/trips/${tripId}/items`,
        { method: "POST", body: JSON.stringify({ label }) },
      );
      setItems((prev) => [...prev, item]);
      setNovo("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para adicionar");
    } finally {
      setOcupado(false);
    }
  }

  // Otimista: a tela muda na hora e volta ao estado anterior se a API recusar.
  // Guardo `antes` em vez de tentar desfazer o patch — é à prova de cliques
  // rápidos em sequência.
  async function atualizar(id: string, patch: Partial<ChecklistItemDTO>) {
    const antes = items;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setErro(null);
    try {
      await api(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    } catch (e) {
      setItems(antes);
      setErro(e instanceof Error ? e.message : "Não deu para salvar");
    }
  }

  async function remover(id: string) {
    const antes = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setErro(null);
    try {
      await api(`/api/items/${id}`, { method: "DELETE" });
    } catch {
      setItems(antes);
      setErro("Não deu para excluir");
    }
  }

  // Comparação com a estimativa — o ponto da funcionalidade toda.
  const comparacao = compararComOrcamento(contratado, budgetCents);
  const veredito = comparacao
    ? {
        txt: comparacao.acima
          ? `${formatBRL(comparacao.diferenca)} acima do estimado`
          : comparacao.diferenca === 0
            ? "bateu o estimado na mosca"
            : `${formatBRL(comparacao.diferenca)} abaixo`,
        acima: comparacao.acima,
      }
    : null;

  return (
    <div className="field">
      <label>Checklist · valores reais</label>

      {items.length > 0 && (
        <div className="check-lista">
          {items.map((item) => (
            <ChecklistLinha
              key={item.id}
              item={item}
              onToggle={() => atualizar(item.id, { done: !item.done })}
              onCommit={(patch) => atualizar(item.id, patch)}
              onRemove={() => remover(item.id)}
            />
          ))}
        </div>
      )}

      <div className="check-novo">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            // Enter aqui adiciona o item. O preventDefault é essencial:
            // sem ele o Enter submeteria o formulário da viagem inteira.
            if (e.key === "Enter") {
              e.preventDefault();
              void adicionar();
            }
          }}
          placeholder="Passagem, hospedagem, seguro…"
          autoComplete="off"
          aria-label="Novo item do checklist"
        />
        <button
          type="button"
          className="btn"
          onClick={() => void adicionar()}
          disabled={ocupado || !novo.trim()}
        >
          Adicionar
        </button>
      </div>

      {erro && <p className="check-erro">{erro}</p>}

      {items.length > 0 && (
        <div className="check-soma">
          <span>
            {ok} de {items.length} contratado{items.length === 1 ? "" : "s"}
          </span>
          <span className="grow" />
          <span>
            {contratado > 0 ? (
              <>
                <b>{formatBRL(contratado)}</b> contratado
                {budgetCents && budgetCents > 0
                  ? ` de ${formatBRL(budgetCents)}`
                  : ""}
              </>
            ) : (
              "nada contratado ainda"
            )}
          </span>
        </div>
      )}

      {/* Pago e a pagar ficam numa linha própria: são a resposta para "quanto
          ainda vai sair do bolso", que é diferente de "quanto essa viagem
          custa". Só aparece quando há parcelamento ou pagamento em curso. */}
      {(pago > 0 || aPagar > 0) && (
        <div className="check-soma pagamento">
          <span>
            <b>{formatBRL(pago)}</b> já pagos
          </span>
          <span className="grow" />
          <span className={aPagar > 0 ? "falta" : undefined}>
            {aPagar > 0 ? <>faltam {formatBRL(aPagar)}</> : "tudo quitado ✦"}
          </span>
        </div>
      )}

      {veredito && (
        <p className={`check-veredito${veredito.acima ? " acima" : ""}`}>{veredito.txt}</p>
      )}
    </div>
  );
}

/* Uma linha do checklist. O rascunho de texto e valor fica aqui, local, e só
   sobe para a API no blur (ou no Enter) — senão seria uma requisição por
   tecla digitada. */
function ChecklistLinha({
  item,
  onToggle,
  onCommit,
  onRemove,
}: {
  item: ChecklistItemDTO;
  onToggle: () => void;
  onCommit: (patch: Partial<ChecklistItemDTO>) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [valor, setValor] = useState(centavosParaCampo(item.amountCents));

  /* Se o item mudar por fora (um rollback depois de erro na API), o rascunho
     precisa acompanhar — senão a tela segue mostrando um valor que não foi
     salvo. O padrão aqui é o "ajustar estado durante o render" documentado
     pelo React: comparar com o valor anterior e corrigir na hora. Fazer isso
     num useEffect renderizaria duas vezes e mostraria o valor errado no meio. */
  const [visto, setVisto] = useState(item);
  if (visto !== item) {
    setVisto(item);
    setLabel(item.label);
    setValor(centavosParaCampo(item.amountCents));
  }

  const [abrirPag, setAbrirPag] = useState(false);

  function gravarLabel() {
    const v = label.trim();
    if (!v) {
      setLabel(item.label); // apagar tudo não vira item sem nome: desfaz
      return;
    }
    if (v !== item.label) onCommit({ label: v });
  }

  function gravarValor() {
    const n = parseCentavos(valor);
    if (n !== item.amountCents) onCommit({ amountCents: n });
  }

  return (
    <div className={`check-item${item.done ? " feito" : ""}`}>
      <div className="check-linha">
      <button
        type="button"
        className="check-box"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.label}
        onClick={onToggle}
      >
        <span aria-hidden="true">{item.done ? "✓" : ""}</span>
      </button>

      <input
        className="check-txt"
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={gravarLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        autoComplete="off"
        aria-label={`Nome do item ${item.label}`}
      />

      <span className="check-cifrao">R$</span>
      <input
        className="check-val"
        // Mesmo motivo do campo de orçamento: "number" não aceita vírgula, e
        // gasto real quase nunca é número redondo.
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={gravarValor}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="—"
        aria-label={`Valor real de ${item.label}`}
      />

      <button
        type="button"
        className="check-del"
        onClick={onRemove}
        aria-label={`Excluir ${item.label}`}
        title="Excluir item"
      >
        ×
      </button>
      </div>

      {/* O pagamento só faz sentido depois que existe um valor. Antes disso a
          linha extra seria ruído em cinco itens ainda em branco. */}
      {(item.amountCents ?? 0) > 0 && (
        <>
          <button
            type="button"
            className="check-pag-abrir"
            aria-expanded={abrirPag}
            onClick={() => setAbrirPag((v) => !v)}
          >
            {resumoPagamento(item)}
            <span className="seta" aria-hidden="true">
              {abrirPag ? "▴" : "▾"}
            </span>
          </button>

          {abrirPag && (
            <PainelPagamento item={item} onCommit={onCommit} />
          )}
        </>
      )}
    </div>
  );
}

/** A frase curta que resume o pagamento do item, no botão que abre o painel. */
function resumoPagamento(item: ChecklistItemDTO): string {
  const falta = faltaCents(item);
  const restantes = parcelasRestantes(item);

  if (falta === 0) return "pago";

  const partes: string[] = [];
  if (item.installments > 1) {
    partes.push(`${item.installments}× de ${formatBRL(valorParcela(item))}`);
    if (item.paidInstallments > 0) {
      partes.push(`${item.paidInstallments} paga${item.paidInstallments === 1 ? "" : "s"}`);
    }
  } else {
    partes.push("à vista");
  }

  const venc = proximoVencimento(item);
  if (venc) {
    partes.push(`próxima ${formatarPeriodo(venc, null)}`);
  } else if (restantes > 0 && item.installments === 1) {
    partes.push("a pagar");
  }

  return partes.join(" · ");
}

/** Controles de parcelamento de um item. */
function PainelPagamento({
  item,
  onCommit,
}: {
  item: ChecklistItemDTO;
  onCommit: (patch: Partial<ChecklistItemDTO>) => void;
}) {
  const pagas = item.paidInstallments;
  const n = item.installments;

  return (
    <div className="check-pag">
      <div className="linha">
        <label htmlFor={`p-n-${item.id}`}>Em quantas vezes</label>
        <input
          id={`p-n-${item.id}`}
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          value={n}
          onChange={(e) => {
            const v = Math.min(60, Math.max(1, Math.round(Number(e.target.value) || 1)));
            // Reduzir o número de parcelas não pode deixar "5 pagas de 3".
            onCommit({ installments: v, paidInstallments: Math.min(pagas, v) });
          }}
        />
      </div>

      <div className="linha">
        <span className="rot">Parcelas pagas</span>
        <div className="contador">
          <button
            type="button"
            onClick={() => onCommit({ paidInstallments: Math.max(0, pagas - 1) })}
            disabled={pagas <= 0}
            aria-label="Uma parcela a menos"
          >
            −
          </button>
          <span className="n">
            {pagas} / {n}
          </span>
          <button
            type="button"
            onClick={() => onCommit({ paidInstallments: Math.min(n, pagas + 1) })}
            disabled={pagas >= n}
            aria-label="Mais uma parcela paga"
          >
            +
          </button>
        </div>
      </div>

      <div className="linha">
        <label htmlFor={`p-d-${item.id}`}>Primeira vence em</label>
        <input
          id={`p-d-${item.id}`}
          type="date"
          value={item.firstDueDate ?? ""}
          onChange={(e) => onCommit({ firstDueDate: e.target.value || null })}
        />
      </div>

      <p className="resumo">
        <b>{formatBRL(pagoCents(item))}</b> pagos ·{" "}
        {faltaCents(item) > 0 ? (
          <>faltam {formatBRL(faltaCents(item))}</>
        ) : (
          "quitado"
        )}
      </p>
    </div>
  );
}

/* ============================================================
   Checklist no cartão

   Mostra os 3 primeiros itens e um "+ mais N" que abre o resto ali mesmo,
   sem sair do quadro. O corte em 3 é o que mantém os cartões com alturas
   parecidas — com a lista inteira sempre aberta, uma viagem de 8 itens
   deixaria a grade toda desalinhada.
   ============================================================ */
const CARD_ITENS_VISIVEIS = 3;

function CardChecklist({
  trip,
  onToggle,
}: {
  trip: TripDTO;
  onToggle: (i: ChecklistItemDTO) => void;
}) {
  const [aberto, setAberto] = useState(false);

  const items = trip.items;
  const total = items.length;
  const ok = feitos(items);
  const pago = totalPago(items);
  const aPagar = totalAPagar(items);
  const pct = total ? Math.round((ok / total) * 100) : 0;

  const visiveis = aberto ? items : items.slice(0, CARD_ITENS_VISIVEIS);
  const escondidos = total - visiveis.length;

  return (
    <div className="card-check">
      <ul className="card-check-lista">
        {visiveis.map((i) => (
          <li key={i.id} className={i.done ? "feito" : undefined}>
            <button
              type="button"
              className="card-check-box"
              role="checkbox"
              aria-checked={i.done}
              aria-label={i.label}
              title={i.done ? "Desmarcar" : "Marcar como feito"}
              onClick={() => onToggle(i)}
            >
              <span aria-hidden="true">{i.done ? "✓" : ""}</span>
            </button>
            {/* title porque o nome corta com reticências em cartão estreito */}
            <span className="card-check-txt" title={i.label}>
              {i.label}
            </span>
            <span className="card-check-val">
              {i.amountCents != null && i.amountCents > 0
                ? formatBRL(i.amountCents)
                : "—"}
            </span>
          </li>
        ))}
      </ul>

      {total > CARD_ITENS_VISIVEIS && (
        <button
          type="button"
          className="card-check-mais"
          onClick={() => setAberto((v) => !v)}
        >
          {aberto ? "ver menos" : `+ mais ${escondidos}`}
        </button>
      )}

      <div className="check-resumo">
        <span
          className="barra"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={ok}
          aria-label={`${ok} de ${total} itens do checklist concluídos`}
        >
          <span className="fill" style={{ width: `${pct}%` }} />
        </span>
        <span className="txt">
          {ok}/{total}
          {pago > 0 && (
            <>
              {" · "}
              <b>{formatBRL(pago)}</b> pagos
            </>
          )}
          {aPagar > 0 && (
            <>
              {" · falta "}
              {formatBRL(aPagar)}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   "Já rolou" — as viagens feitas

   Uso <details> nativo em vez de controlar aberto/fechado com estado:
   o navegador já dá o comportamento, o teclado funciona de graça e o
   conteúdo continua encontrável pelo Ctrl+F mesmo recolhido.
   ============================================================ */
function Arquivo({
  trips,
  aberto,
  onOpen,
}: {
  trips: TripDTO[];
  aberto: boolean;
  onOpen: (t: TripDTO) => void;
}) {
  const total = trips.reduce((s, t) => s + totalPago(t.items), 0);

  return (
    <details className="arquivo" open={aberto}>
      <summary>
        <span className="seta" aria-hidden="true">
          ▸
        </span>
        <span className="tit">Já rolou</span>
        <span className="meta">
          {trips.length} {trips.length === 1 ? "viagem" : "viagens"}
          {total > 0 && (
            <>
              {" · "}
              <b>{formatBRL(total)}</b> gastos
            </>
          )}
        </span>
      </summary>

      <ul className="arquivo-lista">
        {trips.map((t) => {
          const g = totalPago(t.items);
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onOpen(t)}>
                <span className="ano">{yearLabel(t.year)}</span>
                <span className="dest">{t.dest || "Sem nome"}</span>
                <span className="val">
                  {g > 0
                    ? formatBRL(g)
                    : t.budgetCents
                      ? formatBRL(t.budgetCents)
                      : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
