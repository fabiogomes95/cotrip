/**
 * Chamada de API do lado do cliente.
 *
 * Estava copiada em quatro componentes, sempre igual: manda JSON, lê a
 * resposta, e transforma erro de HTTP em exceção com a mensagem que o
 * servidor devolveu — para o `catch` de quem chama ter o que mostrar na tela
 * em vez de um "algo deu errado" genérico.
 */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? "Não deu para salvar",
    );
  }
  return data as T;
}

/** A mensagem de um erro desconhecido, com um padrão de reserva. */
export function mensagemDoErro(e: unknown, padrao = "Não deu para salvar"): string {
  return e instanceof Error ? e.message : padrao;
}
