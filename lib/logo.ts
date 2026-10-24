// Luminancia media (0 = oscuro, 1 = claro) de los píxeles visibles de un logo en base64.
// Sirve para decidir si el logo se ve sobre el color de marca o necesita una placa.
export async function logoLuminance(dataUri: string): Promise<number | null> {
  try {
    const m = /^data:image\/(?:png|jpeg|webp);base64,(.+)$/.exec(dataUri)
    if (!m) return null
    const { default: sharp } = await import('sharp')
    const { data, info } = await sharp(Buffer.from(m[1], 'base64'))
      .resize(64, 64, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let sum = 0
    let n = 0
    for (let i = 0; i < info.width * info.height; i++) {
      const a = data[i * 4 + 3]
      if (a < 128) continue
      const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
      sum += 0.2126 * lin(data[i * 4]) + 0.7152 * lin(data[i * 4 + 1]) + 0.0722 * lin(data[i * 4 + 2])
      n++
    }
    return n > 20 ? sum / n : null
  } catch {
    return null
  }
}

// Si el logo trae un fondo sólido propio (JPG, o PNG sin transparencia), devuelve ese color.
// Sirve para mostrarlo como una "insignia" con su propio fondo, en vez de un recuadro encimado sobre otra placa.
export async function logoBackground(dataUri: string): Promise<string | null> {
  try {
    const m = /^data:image\/(?:png|jpeg|webp);base64,(.+)$/.exec(dataUri)
    if (!m) return null
    const { default: sharp } = await import('sharp')
    const { data, info } = await sharp(Buffer.from(m[1], 'base64'))
      .resize(64, 64, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const w = info.width
    const h = info.height
    const px: number[][] = []
    const take = (x: number, y: number) => { const i = (y * w + x) * 4; px.push([data[i], data[i + 1], data[i + 2], data[i + 3]]) }
    for (let x = 0; x < w; x++) { take(x, 0); take(x, h - 1) }
    for (let y = 1; y < h - 1; y++) { take(0, y); take(w - 1, y) }
    const opaque = px.filter(p => p[3] >= 230)
    if (opaque.length < px.length * 0.9) return null
    const avg = [0, 1, 2].map(c => Math.round(opaque.reduce((a, p) => a + p[c], 0) / opaque.length))
    const close = opaque.filter(p => Math.hypot(p[0] - avg[0], p[1] - avg[1], p[2] - avg[2]) < 40)
    if (close.length < opaque.length * 0.9) return null
    return `rgb(${avg[0]}, ${avg[1]}, ${avg[2]})`
  } catch {
    return null
  }
}
