import { humanize } from '@/lib/humanize'

// Convierte el texto libre de la propuesta inicial (carta + bloque ---METRICAS---) en partes con las que se puede maquetar.

export type IntroBlock = { type: 'p'; text: string } | { type: 'list'; items: string[] }

export interface IntroParsed {
  blocks: IntroBlock[]      // cuerpo, sin el párrafo de cierre
  lead: string              // primer párrafo
  closing: string           // último párrafo (el llamado a la acción)
  metrics: { value: string; label: string }[]
}

const BULLET = /^\s*[-•—–]\s*/

export function parseIntroText(raw: string, bookingUrl: string | null): IntroParsed {
  const [bodyRaw, metricsRaw] = (raw ?? '').split('---METRICAS---')

  const metrics = (metricsRaw ?? '')
    .split('\n')
    .filter(l => l.includes('|'))
    .slice(0, 3)
    .map(l => {
      const [v, ...rest] = l.split('|')
      return { value: v.trim(), label: humanize(rest.join('|').trim()) }
    })
    .filter(m => m.value && m.label && m.value !== '—')

  const esc = (u: string) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const urlPart = bookingUrl ? `(?:${esc(bookingUrl)}|https?:\\/\\/(?:calendly\\.com|cal\\.com)\\S*)` : 'https?:\\/\\/(?:calendly\\.com|cal\\.com)\\S*'
  // "…30 minutos aquí: https://… — cada semana…" → "…30 minutos. Cada semana…" (el botón reemplaza al enlace)
  const urlRe = new RegExp(`\\s*(?:aquí|acá)?\\s*:?\\s*${urlPart}\\s*(?:[—–-]\\s*)?([a-záéíóúñ])?`, 'gi')
  const clean = (t: string) =>
    humanize(
      t.replace(urlRe, (_m, ch?: string) => '. ' + (ch ? ch.toUpperCase() : ''))
        .replace(/\.{2,}/g, '.')
        .replace(/\.\s*\./g, '.')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
    )

  const paras = bodyRaw
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/^(hola|estimad[oa]|buenos días|buenas tardes)[^,\n]*[,\n]+\s*/i, '')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)

  const blocks: IntroBlock[] = []
  for (const p of paras) {
    const lines = p.split('\n').map(l => l.trim()).filter(Boolean)
    if (BULLET.test(lines[0])) {
      const items: string[] = []
      for (const l of lines) {
        if (BULLET.test(l)) items.push(clean(l.replace(BULLET, '')))
        else if (items.length) items[items.length - 1] += ' ' + clean(l)
      }
      const last = blocks[blocks.length - 1]
      if (last?.type === 'list') last.items.push(...items)
      else blocks.push({ type: 'list', items })
    } else {
      blocks.push({ type: 'p', text: clean(lines.join(' ')) })
    }
  }

  const first = blocks[0]?.type === 'p' ? (blocks.shift() as { type: 'p'; text: string }).text : ''
  const lastBlock = blocks[blocks.length - 1]
  const closing = lastBlock?.type === 'p' ? (blocks.pop() as { type: 'p'; text: string }).text : ''
  return { blocks, lead: first, closing, metrics }
}
