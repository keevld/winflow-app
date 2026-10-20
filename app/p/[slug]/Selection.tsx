'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export interface PlanOption { key: string; label: string; total: string }

interface Ctx {
  options: PlanOption[]
  needsChoice: boolean
  selected: string | null
  current: PlanOption | null
  select: (key: string) => void
}

const SelectionCtx = createContext<Ctx | null>(null)

export function useSelection(): Ctx {
  const c = useContext(SelectionCtx)
  if (!c) throw new Error('useSelection fuera de SelectionProvider')
  return c
}

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Guarda qué paquete eligió el cliente. Sin paquete elegido no se puede continuar.
export function SelectionProvider({
  options, needsChoice, initial, children,
}: { options: PlanOption[]; needsChoice: boolean; initial: string | null; children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(needsChoice ? initial : (options[0]?.key ?? null))
  const current = options.find(o => o.key === selected) ?? null
  return (
    <SelectionCtx.Provider value={{ options, needsChoice, selected, current, select: setSelected }}>
      {children}
    </SelectionCtx.Provider>
  )
}

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 8.4l3 2.9 6-6.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// Botón dentro de cada tarjeta de paquete.
export function PickButton({ optionKey }: { optionKey: string }) {
  const { selected, select } = useSelection()
  const on = selected === optionKey
  return (
    <button type="button" className="pd-pick pd-noprint" aria-pressed={on} onClick={() => select(optionKey)}>
      {on ? <><Check /> Elegido</> : 'Elegir este paquete'}
    </button>
  )
}

// Botón de la barra superior: primero obliga a elegir paquete, luego deja continuar.
export function BarContinue() {
  const { needsChoice, selected, current } = useSelection()
  if (needsChoice && !selected) {
    return <button type="button" className="pd-btn pd-btn-primary pd-btn-ghost" onClick={() => scrollToId('inversion')}>Elige un paquete</button>
  }
  return (
    <button type="button" className="pd-btn pd-btn-primary" onClick={() => scrollToId('continuar')}>
      {needsChoice && current ? `Continuar con ${current.label}` : 'Continuar'}
    </button>
  )
}
