import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// O middleware roda no edge; por isso usa apenas a config edge-safe.
export default NextAuth(authConfig).auth;

export const config = {
  // Protege as rotas do app. Ignora estáticos e a API de auth.
  matcher: ["/app/:path*"],
};
