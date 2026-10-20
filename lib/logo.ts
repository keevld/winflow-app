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
