"use client";

import type { InviteDTO, MemberDTO } from "@/types";
import { BotaoPerigo } from "./BotaoPerigo";
import { useCallback, useEffect, useState } from "react";


export function ShareModal({
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

  async function sairDoQuadro() {
    const res = await fetch(`/api/boards/${boardId}/members?userId=${currentUserId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onToast("Você saiu do quadro");
      onDeleted(); // mesma saída da exclusão: fecha e volta para o primeiro quadro
    } else {
      const d = await res.json().catch(() => ({}));
      onToast(d.error ?? "Não deu para sair");
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

        {!isOwner && (
          <div className="zona-perigo">
            <div className="txt">
              <b>Sair deste quadro</b>
              <span>
                Você deixa de ver as viagens daqui. Quem te convidou pode te
                trazer de volta depois.
              </span>
            </div>
            <BotaoPerigo
              label="Sair do quadro"
              confirmLabel="Sair mesmo?"
              onConfirm={() => void sairDoQuadro()}
            />
          </div>
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
