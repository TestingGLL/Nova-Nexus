import { useState, useMemo } from 'react'
import { RefreshCw, Clock, ArrowRightLeft, Info } from 'lucide-react'
import { useCotizaciones, fmtArs, fmtWhen, type Quote } from '../../lib/cotizaciones'
import './ConversionPage.css'

// ============ CONVERSIÓN ============
// Cotización del peso argentino contra USD, UYU, MXN, EUR y BRL, más las variantes del
// dólar (oficial, blue, MEP, CCL, tarjeta, cripto, mayorista). Se refresca sola cada
// hora; ver `src/lib/cotizaciones.ts`.

const FLAGS: Record<string, string> = { USD: '🇺🇸', UYU: '🇺🇾', MXN: '🇲🇽', EUR: '🇪🇺', BRL: '🇧🇷' }

function QuoteTable({ quotes, showFlag }: { quotes: Quote[]; showFlag?: boolean }) {
  return (
    <div className="conv-table-wrap">
      <table className="conv-table">
        <thead>
          <tr>
            <th>Moneda</th>
            <th className="num">Compra</th>
            <th className="num">Venta</th>
            <th className="when">Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map(q => (
            <tr key={q.id}>
              <td>
                <span className="conv-name">
                  {showFlag && <span className="conv-flag">{FLAGS[q.code] || '💱'}</span>}
                  {q.name}
                  {q.derived && <span className="conv-derived" title="Estimada a partir del dólar oficial: la fuente no la publica directo">≈</span>}
                </span>
                <span className="conv-code">1 {q.code}</span>
              </td>
              <td className="num">{fmtArs(q.compra)}</td>
              <td className="num strong">{fmtArs(q.venta)}</td>
              <td className="when">{fmtWhen(q.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Calculadora: convierte entre pesos y la moneda elegida usando su cotización.
function Calculator({ quotes }: { quotes: Quote[] }) {
  const [amount, setAmount] = useState('100')
  const [quoteId, setQuoteId] = useState(quotes[0]?.id ?? '')
  const [toArs, setToArs] = useState(true)

  const q = quotes.find(x => x.id === quoteId) ?? quotes[0]
  const n = parseFloat(amount.replace(',', '.'))
  const result = useMemo(() => {
    if (!q || isNaN(n)) return null
    // De moneda a pesos se usa la VENTA (lo que te cobran); de pesos a moneda, la COMPRA.
    return toArs ? { value: n * q.venta, unit: 'ARS', rate: q.venta, side: 'venta' }
                 : { value: n / q.compra, unit: q.code, rate: q.compra, side: 'compra' }
  }, [q, n, toArs])

  if (!q) return null
  return (
    <div className="card conv-calc">
      <div className="card-title"><ArrowRightLeft size={15} /> Calculadora</div>
      <div className="conv-calc-row">
        <input
          className="conv-calc-amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          inputMode="decimal"
          aria-label="Monto a convertir"
        />
        <span className="conv-calc-unit">{toArs ? q.code : 'ARS'}</span>
        <button className="conv-calc-swap" onClick={() => setToArs(v => !v)} title="Invertir la conversión">
          <ArrowRightLeft size={14} />
        </button>
        <select value={quoteId} onChange={e => setQuoteId(e.target.value)} aria-label="Cotización a usar">
          {quotes.map(x => <option key={x.id} value={x.id}>{x.code === 'USD' && x.id !== 'usd' ? `Dólar ${x.name}` : x.name}</option>)}
        </select>
      </div>
      {result && (
        <div className="conv-calc-result">
          <strong>{result.unit === 'ARS' ? fmtArs(result.value) : `${result.value.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${result.unit}`}</strong>
          <span>a la {result.side} de {fmtArs(result.rate)}</span>
        </div>
      )}
    </div>
  )
}

export default function ConversionPage() {
  const { data, loading, error, refresh } = useCotizaciones()

  // Para la calculadora: las monedas más las variantes del dólar (sin repetir el oficial).
  const calcQuotes = useMemo(() => {
    if (!data) return []
    return [...data.monedas, ...data.dolares.filter(d => d.id !== 'oficial')]
  }, [data])

  return (
    <div className="conversion-page">
      <div className="conv-header">
        <div className="conv-header-left">
          <span className="conv-update">
            <Clock size={12} />
            {data ? `Última actualización: ${new Date(data.fetchedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Sin datos todavía'}
          </span>
          <span className="conv-auto">Se actualiza sola cada 1 hora</span>
        </div>
        <button className="conv-refresh" onClick={refresh} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      {error && <p className="conv-error">{error}{data ? ' — se muestran los últimos valores guardados.' : ''}</p>}
      {!data && !error && <p className="conv-empty">Cargando cotizaciones…</p>}

      {data && (
        <>
          <div className="card conv-card">
            <div className="card-title">Monedas</div>
            <p className="conv-desc">Pesos argentinos por 1 unidad de cada moneda.</p>
            <QuoteTable quotes={data.monedas} showFlag />
          </div>

          <div className="card conv-card">
            <div className="card-title">Dólar — variantes</div>
            <p className="conv-desc">Las distintas cotizaciones del dólar en Argentina.</p>
            <QuoteTable quotes={data.dolares} />
          </div>

          <Calculator quotes={calcQuotes} />

          <p className="conv-source">
            <Info size={12} /> Fuente: dolarapi.com. Las cotizaciones marcadas con «≈» se estiman a partir del dólar oficial porque la fuente no las publica directo.
          </p>
        </>
      )}
    </div>
  )
}
