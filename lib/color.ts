// Utilidades de color para que cada agencia se vea bien con su propio color de marca.

const HEX = /^#[0-9a-fA-F]{6}$/

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export function isHex(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v)
}

/** Texto legible sobre un fondo del color de marca. */
export function onColor(bg: string): string {
  return contrast(bg, '#ffffff') >= contrast(bg, '#14110f') ? '#ffffff' : '#14110f'
}

/** Versión del color de marca apta para texto sobre blanco (contraste ≥ 4.5). */
export function inkColor(brand: string): string {
  let c = brand
  for (let i = 0; i < 12 && contrast(c, '#ffffff') < 4.5; i++) {
    const [r, g, b] = rgb(c)
    c = toHex([r * 0.88, g * 0.88, b * 0.88])
  }
  return c
}
