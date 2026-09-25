"use client";

import { useEffect, useRef, useState } from "react";


export function NewBoardModal({
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
