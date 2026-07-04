import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Clock } from 'lucide-react'
import './CriptomonedasSection.css'

interface CoinDef { id: string; symbol: string; name: string; color: string }

const COINS: CoinDef[] = [
  { id: 'axie-infinity', symbol: 'AXS', name: 'Axie Infinity', color: '#0055d5' },
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#f7931a' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', color: '#0033ad' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos', color: '#6f7cba' },
  { id: 'decentraland', symbol: 'MANA', name: 'Decentraland', color: '#ff2d55' },
  { id: 'enjincoin', symbol: 'ENJ', name: 'Enjin Coin', color: '#624dbf' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#627eea' },
  { id: 'gala', symbol: 'GALA', name: 'Gala', color: '#00d1ff' },
  { id: 'hyperliquid', symbol: 'HYPE', name: 'Hyperliquid', color: '#6ee7b7' },
  { id: 'pax-gold', symbol: 'PAXG', name: 'PAX Gold', color: '#e5c100' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', color: '#e6007a' },
  { id: 'polygon-ecosystem-token', symbol: 'POL', name: 'Polygon', color: '#8247e5' },
  { id: 'quant-network', symbol: 'QNT', name: 'Quant', color: '#ffbb00' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba', color: '#f00500' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: '#9945ff' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar', color: '#14b6e7' },
  { id: 'xpla', symbol: 'XPL', name: 'XPLA', color: '#4b6cff' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', color: '#00aae4' },
  { id: 'zcash', symbol: 'ZEC', name: 'Zcash', color: '#f4b728' },
]

interface PriceData { ars: number; usd: number; change24h: number; updatedAt: number }

// User-editable metadata per coin (persisted + cloud-synced via nn- key).
type Riesgo = 'Bajo' | 'Bajo - Medio' | 'Medio' | 'Medio - Alto' | 'Alto'
const RIESGO_OPTS: Riesgo[] = ['Bajo', 'Bajo - Medio', 'Medio', 'Medio - Alto', 'Alto']
interface CoinMeta { tipo: string; riesgo: Riesgo; plazo: 'Corto' | 'Mediano' | 'Largo'; rinde: boolean }
const DEFAULT_META: CoinMeta = { tipo: '', riesgo: 'Medio', plazo: 'Mediano', rinde: false }
const RIESGO_COLOR: Record<string, string> = { 'Bajo': '#22c55e', 'Bajo - Medio': '#84cc16', 'Medio': '#f59e0b', 'Medio - Alto': '#f97316', 'Alto': '#ef4444' }

// Seed metadata from the reference table (shown until the user edits it).
const SEED_META: Record<string, CoinMeta> = {
  'axie-infinity': { tipo: 'Juegos', riesgo: 'Alto', plazo: 'Mediano', rinde: false },
  'bitcoin': { tipo: 'Reserva', riesgo: 'Bajo', plazo: 'Largo', rinde: false },
  'cardano': { tipo: 'Contratos', riesgo: 'Medio', plazo: 'Mediano', rinde: true },
  'cosmos': { tipo: 'Conexión / Nodo', riesgo: 'Medio', plazo: 'Largo', rinde: true },
  'decentraland': { tipo: 'Juegos', riesgo: 'Alto', plazo: 'Mediano', rinde: false },
  'enjincoin': { tipo: 'Juegos', riesgo: 'Medio - Alto', plazo: 'Corto', rinde: false },
  'ethereum': { tipo: 'Contratos', riesgo: 'Medio', plazo: 'Largo', rinde: true },
  'gala': { tipo: 'Juegos', riesgo: 'Alto', plazo: 'Mediano', rinde: false },
  'hyperliquid': { tipo: 'Transferencias', riesgo: 'Medio', plazo: 'Mediano', rinde: false },
  'pax-gold': { tipo: 'Stablecoin', riesgo: 'Bajo', plazo: 'Largo', rinde: false },
  'polkadot': { tipo: 'Conexión / Nodo', riesgo: 'Bajo - Medio', plazo: 'Largo', rinde: true },
  'polygon-ecosystem-token': { tipo: 'Transferencias', riesgo: 'Bajo - Medio', plazo: 'Mediano', rinde: false },
  'quant-network': { tipo: 'Conexión / Nodo', riesgo: 'Bajo - Medio', plazo: 'Largo', rinde: false },
  'shiba-inu': { tipo: 'Memes', riesgo: 'Alto', plazo: 'Corto', rinde: false },
  'solana': { tipo: 'Transferencias', riesgo: 'Medio - Alto', plazo: 'Corto', rinde: true },
  'stellar': { tipo: 'Transferencias', riesgo: 'Bajo - Medio', plazo: 'Mediano', rinde: false },
  'xpla': { tipo: 'Juegos', riesgo: 'Alto', plazo: 'Corto', rinde: false },
  'ripple': { tipo: 'Transferencias', riesgo: 'Medio - Alto', plazo: 'Mediano', rinde: false },
  'zcash': { tipo: 'Transferencias', riesgo: 'Alto', plazo: 'Largo', rinde: false },
}
function loadMeta(): Record<string, CoinMeta> { try { const s = localStorage.getItem('nn-cripto-meta'); return s ? JSON.parse(s) : {} } catch { return {} } }

const PERIODS = [
  { label: 'Última hora', days: 0.042 },
  { label: '3 días', days: 3 },
  { label: '1 semana', days: 7 },
  { label: '1 mes', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '1 año', days: 365 },
]

function fmtArs(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function MiniChart({ coinId, days, color }: { coinId: string; days: number; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      setLoading(true)
      try {
        let result: any
        if (window.electronAPI?.getCryptoChart) {
          result = await window.electronAPI.getCryptoChart(coinId, Math.max(1, Math.ceil(days)))
        } else {
          const res = await globalThis.fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=ars&days=${Math.max(1, Math.ceil(days))}`)
          result = { success: true, data: await res.json() }
        }
        if (cancelled || !result.success || !result.data?.prices) return
        const prices = result.data.prices as [number, number][]
        const canvas = canvasRef.current
        if (!canvas || prices.length < 2) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const w = canvas.width = canvas.offsetWidth * 2
        const h = canvas.height = canvas.offsetHeight * 2
        const vals = prices.map(p => p[1])
        const min = Math.min(...vals), max = Math.max(...vals)
        const range = max - min || 1
        ctx.clearRect(0, 0, w, h)
        ctx.beginPath()
        vals.forEach((v, i) => {
          const x = (i / (vals.length - 1)) * w
          const y = h - ((v - min) / range) * (h * 0.85) - h * 0.05
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.stroke()
        const grad = ctx.createLinearGradient(0, 0, 0, h)
        grad.addColorStop(0, color + '30')
        grad.addColorStop(1, color + '00')
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
        ctx.fillStyle = grad; ctx.fill()
      } catch {}
      if (!cancelled) setLoading(false)
    }
    fetch()
    return () => { cancelled = true }
  }, [coinId, days, color])

  return (
    <div className="cripto-chart-wrap">
      {loading && <span className="cripto-chart-loading">Cargando gráfico...</span>}
      <canvas ref={canvasRef} className="cripto-chart-canvas" />
    </div>
  )
}

export default function CriptomonedasSection() {
  const [prices, setPrices] = useState<Record<string, PriceData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdate, setLastUpdate] = useState('')
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null)
  const [period, setPeriod] = useState(7)
  const [meta, setMeta] = useState<Record<string, CoinMeta>>(loadMeta)
  // Effective metadata: user edits override the seeded reference values.
  const metaOf = (id: string): CoinMeta => ({ ...DEFAULT_META, ...SEED_META[id], ...meta[id] })
  const updateMeta = (id: string, u: Partial<CoinMeta>) => {
    const next = { ...meta, [id]: { ...metaOf(id), ...u } }
    setMeta(next); localStorage.setItem('nn-cripto-meta', JSON.stringify(next))
  }

  const fetchPrices = useCallback(async () => {
    try {
      let result: any
      const ids = COINS.map(c => c.id).join(',')
      if (window.electronAPI?.getCryptoPrices) {
        result = await window.electronAPI.getCryptoPrices(ids)
      } else {
        const res = await globalThis.fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=ars,usd&include_24hr_change=true&include_last_updated_at=true`)
        result = { success: true, data: await res.json() }
      }
      if (!result.success) { setError(true); return }
      const map: Record<string, PriceData> = {}
      for (const coin of COINS) {
        const d = result.data?.[coin.id]
        if (d) map[coin.id] = { ars: d.ars || 0, usd: d.usd || 0, change24h: d.ars_24h_change || 0, updatedAt: d.last_updated_at || 0 }
      }
      setPrices(map)
      setError(false)
      setLastUpdate(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      setError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPrices()
    const id = setInterval(fetchPrices, 3600_000)
    return () => clearInterval(id)
  }, [fetchPrices])

  const selected = selectedCoin ? COINS.find(c => c.id === selectedCoin) : null

  return (
    <div className="cripto-section">
      <div className="cripto-header">
        <div className="cripto-header-left">
          <span className="cripto-update"><Clock size={12} /> {lastUpdate ? `Actualizado: ${lastUpdate}` : 'Cargando...'}</span>
          <span className="cripto-auto">Auto-actualización: 1h</span>
        </div>
        <button className="cripto-refresh" onClick={fetchPrices} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      {error && <p className="cripto-error">Error al cargar precios. Reintentá más tarde.</p>}

      <div className="cripto-grid">
        {COINS.map(coin => {
          const data = prices[coin.id]
          const up = data ? data.change24h >= 0 : true
          return (
            <button key={coin.id} className={`cripto-card ${selectedCoin === coin.id ? 'active' : ''}`} onClick={() => setSelectedCoin(selectedCoin === coin.id ? null : coin.id)}>
              <div className="cripto-card-top">
                <div className="cripto-coin-icon" style={{ background: coin.color + '20', color: coin.color }}>{coin.symbol.slice(0, 2)}</div>
                <div className="cripto-coin-info">
                  <span className="cripto-coin-symbol">{coin.symbol}</span>
                  <span className="cripto-coin-name">{coin.name}</span>
                </div>
                <div className={`cripto-change ${up ? 'up' : 'down'}`}>
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  <span>{data ? `${up ? '+' : ''}${data.change24h.toFixed(2)}%` : '—'}</span>
                </div>
              </div>
              <div className="cripto-card-price">
                <span className="cripto-price-ars">{data ? fmtArs(data.ars) : '...'}</span>
                <span className="cripto-price-usd">{data ? `USD ${data.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''}</span>
              </div>
              {(() => { const m = metaOf(coin.id); return (
                <div className="cripto-tags">
                  {m.tipo && <span className="cripto-tag">{m.tipo}</span>}
                  <span className="cripto-tag" style={{ color: RIESGO_COLOR[m.riesgo], borderColor: RIESGO_COLOR[m.riesgo] }}>{m.riesgo}</span>
                  <span className="cripto-tag">{m.plazo}</span>
                  {m.rinde && <span className="cripto-tag rinde">Rinde</span>}
                </div>
              ) })()}
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="cripto-detail card">
          <div className="cripto-detail-header">
            <div className="cripto-coin-icon large" style={{ background: selected.color + '20', color: selected.color }}>{selected.symbol.slice(0, 2)}</div>
            <div>
              <h3>{selected.name} ({selected.symbol})</h3>
              {prices[selected.id] && <span className="cripto-detail-price">{fmtArs(prices[selected.id].ars)} ARS</span>}
            </div>
          </div>
          <div className="cripto-period-tabs">
            {PERIODS.map(p => (
              <button key={p.days} className={period === p.days ? 'active' : ''} onClick={() => setPeriod(p.days)}>{p.label}</button>
            ))}
          </div>
          <MiniChart coinId={selected.id} days={period} color={selected.color} />
          {(() => {
            const m = metaOf(selected.id)
            return (
              <div className="cripto-meta">
                <label className="cripto-meta-field"><span>Tipo</span><input value={m.tipo} onChange={e => updateMeta(selected.id, { tipo: e.target.value })} placeholder="Reserva, Contratos, Juegos, Transferencias…" /></label>
                <label className="cripto-meta-field"><span>Riesgo</span><select value={m.riesgo} onChange={e => updateMeta(selected.id, { riesgo: e.target.value as CoinMeta['riesgo'] })}>{RIESGO_OPTS.map(r => <option key={r}>{r}</option>)}</select></label>
                <label className="cripto-meta-field"><span>Plazo</span><select value={m.plazo} onChange={e => updateMeta(selected.id, { plazo: e.target.value as CoinMeta['plazo'] })}><option>Corto</option><option>Mediano</option><option>Largo</option></select></label>
                <label className="cripto-meta-field"><span>Genera rendimientos</span><button type="button" className={`cripto-rinde ${m.rinde ? 'on' : ''}`} onClick={() => updateMeta(selected.id, { rinde: !m.rinde })}>{m.rinde ? 'Sí' : 'No'}</button></label>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
