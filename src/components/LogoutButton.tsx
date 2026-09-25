"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => signOut({ callbackUrl: "/login" })}
      title="Sair"
    >
      Sair
    </button>
  );
}
