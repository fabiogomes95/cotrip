import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Raiz: manda para o app se logado, senão para o login.
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/app");
  redirect("/login");
}
