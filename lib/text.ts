// Capitaliza la primera letra respetando el resto del texto (no fuerza minúsculas
// para no romper siglas como "SEO" o "UGC").
export function capitalizeFirst(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (!t) return t
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1)
}

// Limpieza básica del HTML del correo: quita scripts, iframes/objetos, manejadores
// on* y URLs javascript:. Defensa en profundidad: además se muestra en iframe sandbox.
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|style\s+[^>]*onload)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed)[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>\s]*("|')?/gi, '$1="#"')
}

// Nombres propios: "ana garcía" -> "Ana García" (conserva partículas como "de", "del", "la").
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'van', 'von', 'da', 'di'])
export function titleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w, i) => {
      const lower = w.toLocaleLowerCase('es')
      if (i > 0 && PARTICLES.has(lower)) return lower
      return w === w.toLocaleUpperCase('es') && w.length > 1 && /[a-z]/i.test(w) && w.length <= 3
        ? w // siglas cortas (ej. "JP")
        : lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1)
    })
    .join(' ')
}

// Inserta un botón "Ver propuesta en línea" (enlace con seguimiento) en el correo.
// Busca el párrafo de cierre del correo de Winflow; si el usuario lo editó, lo pone antes de </body>.
export function injectViewLink(html: string, url: string, color: string): string {
  const safeUrl = url.replace(/"/g, '%22')
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#111827'
  const block =
    `<p style="margin:16px 0 0"><a href="${safeUrl}" target="_blank" style="display:inline-block;font-size:14px;font-weight:600;color:${safeColor};text-decoration:underline">Ver la propuesta en línea</a></p>`
  const marker = html.lastIndexOf('<p style="margin:20px 0 0')
  if (marker !== -1) return html.slice(0, marker) + block + html.slice(marker)
  const body = html.lastIndexOf('</body>')
  if (body !== -1) return html.slice(0, body) + block + html.slice(body)
  return html + block
}
