import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/app");

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="mark" />
          <span className="name">CoTrip</span>
        </div>
        <h1>Bem-vindo de volta</h1>
        <p className="tagline">As próximas viagens esperam por vocês.</p>

        <LoginForm />

        <p className="auth-alt">
          Ainda não tem conta? <Link href="/register">Criar conta</Link>
        </p>
        <p className="auth-demo">
          Conta de teste: <code>demo@cotrip.app</code> · senha <code>demo1234</code>
        </p>
      </div>
    </main>
  );
}
