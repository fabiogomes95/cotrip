import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/app");

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="mark" />
          <span className="name">CoTrip</span>
        </div>
        <h1>Criar conta</h1>
        <p className="tagline">Comece o próximo roteiro em minutos.</p>

        <RegisterForm />

        <p className="auth-alt">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
