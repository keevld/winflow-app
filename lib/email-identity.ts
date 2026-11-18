// Nombre que ve el destinatario como remitente. Viene de texto que escribe la agencia, así que se limpia
// antes de mandarlo a n8n: sin saltos de línea (inyección de encabezados), comillas ni signos de dirección.
export function senderName(name: string | null | undefined, fallback = 'Winflow'): string {
  const clean = (name ?? '')
    .replace(/[\r\n\t\u0000-\u001f\u007f]+/g, ' ')
    .replace(/[<>"\\;,@]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return clean || fallback
}

// Correo de respuesta: solo se acepta una dirección simple; si no es válida, no se manda (n8n usa el remitente).
export function replyToAddress(email: string | null | undefined): string {
  const e = (email ?? '').trim()
  return /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(e) ? e : ''
}
