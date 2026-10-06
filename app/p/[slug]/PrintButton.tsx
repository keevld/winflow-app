'use client'

export default function PrintButton() {
  return (
    <button onClick={() => window.print()}
      className="text-sm text-gray-600 underline print:hidden">
      Descargar PDF
    </button>
  )
}
