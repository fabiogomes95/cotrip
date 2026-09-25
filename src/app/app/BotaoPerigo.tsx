"use client";

import { useEffect, useRef, useState } from "react";


export function BotaoPerigo({
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
