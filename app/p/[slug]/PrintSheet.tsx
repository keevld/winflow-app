import type { ReactNode } from 'react'

// Al imprimir, el navegador pone fecha, URL y número de página en los márgenes de la hoja.
// Para que no aparezcan, la hoja se imprime con margen 0 y los márgenes reales los dan
// estos espaciadores: <thead> y <tfoot> se repiten arriba y abajo de CADA página.
// En pantalla son bloques normales y los espaciadores no se muestran.
export default function PrintSheet({ children }: { children: ReactNode }) {
  return (
    <table className="pd-sheet" role="presentation">
      <thead><tr><td><div className="pd-pagepad" /></td></tr></thead>
      <tbody><tr><td>{children}</td></tr></tbody>
      <tfoot><tr><td><div className="pd-pagepad" /></td></tr></tfoot>
    </table>
  )
}
