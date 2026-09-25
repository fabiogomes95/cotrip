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
import { formatBRL } from "@/lib/format";
import type { BoardSummary, InviteDTO, MemberDTO, Role, TripDTO } from "@/types";

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
}

export function BoardApp({
  currentUser,
  boards,
  activeBoard,
  initialTrips,
  initialMembers,
}: Props) {
  const router = useRouter();
  const [trips, setTrips] = useState<TripDTO[]>(initialTrips);
  const [members] = useState<MemberDTO[]>(initialMembers);
  const [filter, setFilter] = useState<"todos" | Status>("todos");
  const [modal, setModal] = useState<Modal>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const modalRef = useRef<Modal>(null);
  modalRef.current = modal;

  const isOwner = activeBoard.role === "OWNER";
  const initials = (currentUser.name || currentUser.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  // Sincronização: quando um novo initialTrips chega (troca de quadro), atualiza.
  useEffect(() => {
    setTrips(initialTrips);
  }, [initialTrips]);

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

  // Polling leve para refletir edições da outra pessoa (pausa com modal aberto).
  useEffect(() => {
    const id = setInterval(() => {
      if (modalRef.current === null) refetchTrips();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refetchTrips]);

  // Fecha modal no ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      .reduce((s, t) => s + (t.budget ?? 0), 0);
    return { total: trips.length, locked, done, money };
  }, [trips]);

  const filtered =
    filter === "todos" ? trips : trips.filter((t) => t.status === filter);

  const years = useMemo(() => {
    const set = new Set<number>(BASE_YEARS);
    trips.forEach((t) => {
      if (t.year && t.year > 0) set.add(t.year);
    });
    return [...set].sort((a, b) => a - b);
  }, [trips]);

  const hasSomeday = trips.some((t) => !t.year || t.year <= 0);

  // ----- render helpers -----
  function moneyForYear(list: TripDTO[]) {
    const m = list
      .filter((t) => t.status !== "FEITA")
      .reduce((s, t) => s + (t.budget ?? 0), 0);
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
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="__new__">+ Novo quadro</option>
            </select>
          </div>

          <span className="spacer" />

          <span className="sync-pill" title="As mudanças da equipe aparecem sozinhas">
            <span className="live" />
            ao vivo
          </span>

          <button
            className="btn"
            onClick={() => setModal({ type: "share" })}
            title="Compartilhar quadro"
          >
            Compartilhar
          </button>

          <span className="user-chip">
            <span className="avatar" title={currentUser.email}>
              {initials}
            </span>
          </span>

          <button
            className="btn btn-ghost"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sair
          </button>
        </div>
      </div>

      {/* ---------- intro + stats ---------- */}
      <div className="wrap">
        <section className="intro">
          <div className="kicker">{activeBoard.name}</div>
          <h2>As viagens que vocês sempre falam em fazer</h2>
          <p className="lede">
            Tira do “um dia a gente vai” e bota no papel. Cada ideia vira plano,
            vira reserva, vira lembrança.
          </p>

          <div className="stats">
            <div className="stat">
              <div className="num">{stats.total}</div>
              <div className="lab">
                viagem{stats.total === 1 ? "" : "s"} no radar
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
          </div>
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
                const list = trips
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
                  />
                );
              })}

              {hasSomeday &&
                (() => {
                  const list = trips
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
                    />
                  );
                })()}

              {filtering && filtered.length === 0 && (
                <div className="empty">
                  <div className="big">🔍</div>
                  <h3>Nenhuma viagem “{STATUS_LABEL[filter as Status]}”</h3>
                  <p>Troque o filtro para ver as outras.</p>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="foot">
          <b>Compartilhando:</b> use “Compartilhar” e convide sua dupla pelo email.
          Vocês editam o mesmo quadro — o que uma muda, a outra vê. <br />
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
          onClose={() => setModal(null)}
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
          onClose={() => setModal(null)}
          onToast={toast}
        />
      )}

      {modal?.type === "newboard" && (
        <NewBoardModal
          onClose={() => setModal(null)}
          onCreated={(id) => {
            setModal(null);
            router.push(`/app?board=${id}`);
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
            <TripCard key={t.id} trip={t} onOpen={onOpen} onCycle={onCycle} />
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
}: {
  trip: TripDTO;
  onOpen: (t: TripDTO) => void;
  onCycle: (t: TripDTO) => void;
}) {
  const when =
    [trip.whenText, trip.year && trip.year > 0 ? trip.year : null]
      .filter(Boolean)
      .join(" · ") || "algum dia";

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
      <button className="trip-open" onClick={() => onOpen(trip)}>
        <div className="trip-row1">
          <span className="when">{when}</span>
        </div>
        <h3 className="dest">{trip.dest || "Sem nome"}</h3>
        {trip.note && <p className="note">{trip.note}</p>}
        <div className="trip-foot">
          {trip.budget && trip.budget > 0 ? (
            <span className="budget">
              {formatBRL(trip.budget)} <span className="per">/pessoa</span>
            </span>
          ) : (
            <span className="budget empty">sem orçamento</span>
          )}
          <span className="edit-hint">editar →</span>
        </div>
      </button>
    </article>
  );
}

/* ============================================================
   Modal de viagem (criar / editar)
   ============================================================ */
function TripModal({
  trip,
  presetYear,
  onClose,
  onSave,
  onDelete,
}: {
  trip: TripDTO | null;
  presetYear: number;
  onClose: () => void;
  onSave: (id: string | null, body: Partial<TripDTO>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [dest, setDest] = useState(trip?.dest ?? "");
  const [whenText, setWhenText] = useState(trip?.whenText ?? "");
  const [year, setYear] = useState<number>(trip ? trip.year : presetYear);
  const [status, setStatus] = useState<Status>(trip?.status ?? "IDEIA");
  const [budget, setBudget] = useState<string>(
    trip?.budget != null ? String(trip.budget) : "",
  );
  const [note, setNote] = useState(trip?.note ?? "");
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
      budget: budget.trim() === "" ? null : Math.max(0, Number(budget) || 0),
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
            <select
              id="t-year"
              value={year}
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

        <div className="field">
          <label htmlFor="t-budget">Orçamento estimado · por pessoa (R$)</label>
          <input
            id="t-budget"
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="ex: 2500"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="t-note">Anotações</label>
          <textarea
            id="t-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="o que fazer, onde ficar, com quem, links…"
          />
        </div>

        <div className="sheet-actions">
          {trip && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onDelete(trip.id)}
            >
              Excluir
            </button>
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
  onClose,
  onToast,
}: {
  boardId: string;
  boardName: string;
  isOwner: boolean;
  initialMembers: MemberDTO[];
  currentUserId: string;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [members, setMembers] = useState<MemberDTO[]>(initialMembers);
  const [invites, setInvites] = useState<InviteDTO[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}/members`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setInvites(data.invites);
      }
    } catch {
      /* ignore */
    }
  }, [boardId]);

  useEffect(() => {
    load();
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
        <h3>Compartilhar</h3>
        <div className="sub">{boardName} · quem entrar edita junto</div>

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
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "4px 8px" }}
                  onClick={() => removeMember(m.userId)}
                  title="Remover"
                >
                  ✕
                </button>
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
  onCreated: (id: string) => void;
  onToast: (m: string) => void;
}) {
  const [name, setName] = useState("");
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
      onCreated(data.id);
    } catch {
      onToast("Não deu para criar");
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit} style={{ maxWidth: 440 }}>
        <h3>Novo quadro</h3>
        <div className="sub">Um espaço separado de viagens (outra turma, outra dupla…)</div>
        <div className="field">
          <label htmlFor="b-name">Nome do quadro</label>
          <input
            id="b-name"
            ref={ref}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Viagens com a galera do trampo"
            autoComplete="off"
            required
          />
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
