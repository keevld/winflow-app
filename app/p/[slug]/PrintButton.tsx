'use client'

// Con PDFShift configurado descarga el PDF generado en el servidor (sin encabezados
// del navegador); si no, cae a la impresión del navegador.
export default function PrintButton({ href }: { href?: string | null }) {
  if (href) {
    return <a href={href} download className="pd-btn pd-noprint">Descargar PDF</a>
  }
  return (
    <button onClick={() => window.print()} className="pd-btn pd-noprint">
      Descargar PDF
    </button>
  )
}
