import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Clock } from 'lucide-react'
import './CriptomonedasSection.css'

interface CoinDef { id: string; symbol: string; name: string; color: string }

const COINS: CoinDef[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#f7931a' },
  { id: 'pax-gold', symbol: 'PAXG', name: 'PAX Gold', color: '#e5c100' },
  { id: 'hyperliquid', symbol: 'HYPE', name: 'Hyperliquid', color: '#6ee7b7' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos', color: '#6f7cba' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: '#9945ff' },
]

interface PriceData { ars: number; usd: number; change24h: number; updatedAt: number }

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

  const fetchPrices = useCallback(async () => {
    try {
      let result: any
      if (window.electronAPI?.getCryptoPrices) {
        result = await window.electronAPI.getCryptoPrices()
      } else {
        const ids = COINS.map(c => c.id).join(',')
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
        </div>
      )}
    </div>
  )
}
