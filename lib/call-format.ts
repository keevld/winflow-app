// Convierte la transcripción por persona en las notas que lee la IA, con roles claros.
// Se usa en el navegador: el vendedor indica cuál de los participantes es él.

export type CallSegment = { key: string; name: string; text: string; start: number }

export const NOTES_LIMIT = 20000

export function formatCallNotes(segments: CallSegment[], sellerKey: string | null): { text: string; truncated: boolean } {
  const lines = segments.map(s => {
    const role = sellerKey == null ? s.name : s.key === sellerKey ? `Vendedor (${s.name})` : `Prospecto (${s.name})`
    return `${role}: ${s.text}`
  })
  let text = lines.join('\n')
  const truncated = text.length > NOTES_LIMIT
  if (truncated) text = text.slice(0, NOTES_LIMIT - 1) + '…'
  return { text, truncated }
}
