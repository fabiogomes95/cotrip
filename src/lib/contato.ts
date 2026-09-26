/**
 * Tenta achar um telefone discável dentro de um contato em texto livre.
 *
 * O campo `contact` de uma atividade é coisa como "Atlantis Divers · (81)
 * 99777-4321", porque foi colado de um WhatsApp. Durante a viagem esse
 * telefone é o dado mais útil da tela, e tem que ser um toque — não um
 * copiar e colar em pé na praia.
 *
 * Só vira link quando sobram dígitos suficientes para ser um telefone de
 * verdade. Sem esse piso, "sala 302" ou "diária 180" viravam uma ligação.
 */
export function telefoneDe(contato: string): string | null {
  // O primeiro trecho longo o bastante feito só de caracteres de telefone.
  const m = contato.match(/[\d()+\-.\s]{8,}/);
  if (!m) return null;

  const bruto = m[0].trim();
  const digitos = bruto.replace(/\D/g, "");
  // 8 = fixo antigo sem DDD; 13 = +55 com DDD e nove dígitos.
  if (digitos.length < 8 || digitos.length > 13) return null;

  return (bruto.startsWith("+") ? "+" : "") + digitos;
}
