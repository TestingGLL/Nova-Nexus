// Feriados nacionales de Argentina (2026-2027). Fechas en formato YYYY-MM-DD.
// Los movibles (Carnaval, Viernes Santo) están calculados para cada año.
export interface Holiday { date: string; name: string; kind?: 'inamovible' | 'trasladable' | 'puente' | 'no laborable' }

export const ARG_HOLIDAYS: Holiday[] = [
  // ===== 2026 =====
  { date: '2026-01-01', name: 'Año Nuevo', kind: 'inamovible' },
  { date: '2026-02-16', name: 'Carnaval', kind: 'inamovible' },
  { date: '2026-02-17', name: 'Carnaval', kind: 'inamovible' },
  { date: '2026-03-24', name: 'Día de la Memoria por la Verdad y la Justicia', kind: 'inamovible' },
  { date: '2026-04-02', name: 'Día del Veterano y de los Caídos en Malvinas', kind: 'inamovible' },
  { date: '2026-04-03', name: 'Viernes Santo', kind: 'inamovible' },
  { date: '2026-05-01', name: 'Día del Trabajador', kind: 'inamovible' },
  { date: '2026-05-25', name: 'Día de la Revolución de Mayo', kind: 'inamovible' },
  { date: '2026-06-15', name: 'Paso a la Inmortalidad del Gral. Güemes', kind: 'trasladable' },
  { date: '2026-06-20', name: 'Paso a la Inmortalidad del Gral. Belgrano (Día de la Bandera)', kind: 'inamovible' },
  { date: '2026-07-09', name: 'Día de la Independencia', kind: 'inamovible' },
  { date: '2026-08-17', name: 'Paso a la Inmortalidad del Gral. San Martín', kind: 'trasladable' },
  { date: '2026-10-12', name: 'Día del Respeto a la Diversidad Cultural', kind: 'trasladable' },
  { date: '2026-11-20', name: 'Día de la Soberanía Nacional', kind: 'trasladable' },
  { date: '2026-12-08', name: 'Inmaculada Concepción de María', kind: 'inamovible' },
  { date: '2026-12-25', name: 'Navidad', kind: 'inamovible' },
  // ===== 2027 =====
  { date: '2027-01-01', name: 'Año Nuevo', kind: 'inamovible' },
  { date: '2027-02-08', name: 'Carnaval', kind: 'inamovible' },
  { date: '2027-02-09', name: 'Carnaval', kind: 'inamovible' },
  { date: '2027-03-24', name: 'Día de la Memoria por la Verdad y la Justicia', kind: 'inamovible' },
  { date: '2027-03-26', name: 'Viernes Santo', kind: 'inamovible' },
  { date: '2027-04-02', name: 'Día del Veterano y de los Caídos en Malvinas', kind: 'inamovible' },
  { date: '2027-05-01', name: 'Día del Trabajador', kind: 'inamovible' },
  { date: '2027-05-25', name: 'Día de la Revolución de Mayo', kind: 'inamovible' },
  { date: '2027-06-17', name: 'Paso a la Inmortalidad del Gral. Güemes', kind: 'trasladable' },
  { date: '2027-06-20', name: 'Paso a la Inmortalidad del Gral. Belgrano (Día de la Bandera)', kind: 'inamovible' },
  { date: '2027-07-09', name: 'Día de la Independencia', kind: 'inamovible' },
  { date: '2027-08-17', name: 'Paso a la Inmortalidad del Gral. San Martín', kind: 'trasladable' },
  { date: '2027-10-11', name: 'Día del Respeto a la Diversidad Cultural', kind: 'trasladable' },
  { date: '2027-11-20', name: 'Día de la Soberanía Nacional', kind: 'trasladable' },
  { date: '2027-12-08', name: 'Inmaculada Concepción de María', kind: 'inamovible' },
  { date: '2027-12-25', name: 'Navidad', kind: 'inamovible' },
]

export interface UpcomingHoliday extends Holiday { daysUntil: number }

// Feriados dentro de los próximos `days` días (inclusive), ordenados por fecha.
export function upcomingHolidays(days: number, from = new Date()): UpcomingHoliday[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(start); end.setDate(end.getDate() + days)
  return ARG_HOLIDAYS
    .map(h => ({ h, d: new Date(h.date + 'T00:00:00') }))
    .filter(x => x.d >= start && x.d <= end)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map(x => ({ ...x.h, daysUntil: Math.round((x.d.getTime() - start.getTime()) / 86400000) }))
}
