// Quita las rayas largas (—) del texto generado por IA: es la huella más obvia de "texto de máquina".
// Las reemplaza por coma, o por punto si lo que sigue empieza una oración nueva.
// El guion corto (-) y los rangos numéricos con raya (25–40) no se tocan.
export function humanize(text: string): string {
  if (!text) return text
  return text
    // "idea — Otra frase" (mayúscula después) → punto
    .replace(/\s*—\s*(?=[A-ZÁÉÍÓÚÑ¿¡])/g, '. ')
    // "idea — otra idea" → coma
    .replace(/\s*—\s*/g, ', ')
    // raya media con espacios alrededor ("a – b") → coma; sin espacios (rangos) se queda
    .replace(/\s+–\s+/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\.\s*\./g, '.')
}
