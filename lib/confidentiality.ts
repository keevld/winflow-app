// Confidencialidad: los clientes de la agencia (casos de éxito) nunca se nombran en una propuesta
// que ve un prospecto. El nombre ni siquiera llega a la IA (se sustituye por un alias antes del
// prompt) y, por si lo escribe de todos modos, se borra del texto generado.

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** «Alpura (ejemplo de prueba)» → «Alpura». */
export function cleanClientName(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/** Etiqueta anónima para mostrar un caso: «Cliente de retail» en lugar de su nombre. */
export function caseAlias(industry: string | null | undefined): string {
  const i = (industry ?? '').trim()
  return i ? `Cliente de ${i.toLowerCase()}` : 'Cliente de la agencia'
}

/** Devuelve una función que quita de un texto los nombres dados (palabra completa, sin distinguir mayúsculas). */
export function makeScrubber(names: Array<string | null | undefined>): (text: string) => string {
  const list = [...new Set(names.map(cleanClientName).filter(n => n.length >= 3))]
    .sort((a, b) => b.length - a.length)
  if (list.length === 0) return t => t
  const alt = list.map(esc).join('|')
  const withDe = new RegExp(`\\b(de|De)\\s+(?:${alt})(?![\\p{L}\\p{N}])`, 'giu')
  const plain = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, 'giu')
  return (text: string) =>
    text.replace(withDe, (_m, d: string) => `${d === 'De' ? 'Del' : 'del'} cliente`).replace(plain, 'el cliente')
}

/** Aplica el scrubber a todas las cadenas de un objeto JSON. */
export function scrubJson<T>(value: T, scrub: (t: string) => string): T {
  return JSON.parse(JSON.stringify(value), (_k, v) => (typeof v === 'string' ? scrub(v) : v)) as T
}
