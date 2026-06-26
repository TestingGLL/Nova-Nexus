import { useState, useEffect, useCallback } from 'react'
import { Gamepad2, Keyboard, Mouse, Smartphone, Headphones, Bluetooth, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning, Zap } from 'lucide-react'
import './ControllerStatus.css'

interface BtDevice { id: string; name: string; battery: number | null; class?: string }
type DevType = 'controller' | 'keyboard' | 'mouse' | 'phone' | 'audio' | 'generic'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function deviceType(name: string): DevType {
  const n = name.toLowerCase()
  if (/control|gamepad|joystick|dualsense|dualshock|xbox|8bitdo|gulikit|vstar|dehuka/.test(n)) return 'controller'
  if (/teclado|keyboard|keychron|rdkm-?9|magic keyboard/.test(n)) return 'keyboard'
  if (/mouse|rat[oó]n/.test(n)) return 'mouse'
  if (/phone|m[oó]vil|celular|galaxy|iphone|redmi|xiaomi|samsung|android|pixel|motorola|moto |huawei|oppo/.test(n)) return 'phone'
  if (/auricular|headphone|headset|speaker|buds|airpods|jbl|bose|parlante|cascos|wh-|freebuds|earbuds/.test(n)) return 'audio'
  return 'generic'
}

function DeviceIcon({ type }: { type: DevType }) {
  switch (type) {
    case 'controller': return <Gamepad2 size={15} />
    case 'keyboard': return <Keyboard size={15} />
    case 'mouse': return <Mouse size={15} />
    case 'phone': return <Smartphone size={15} />
    case 'audio': return <Headphones size={15} />
    default: return <Bluetooth size={14} />
  }
}

function BatteryIcon({ level }: { level: number }) {
  if (level <= 15) return <BatteryWarning size={13} className="ctrl-bat-icon crit" />
  if (level <= 35) return <BatteryLow size={13} className="ctrl-bat-icon low" />
  if (level <= 70) return <BatteryMedium size={13} className="ctrl-bat-icon mid" />
  return <BatteryFull size={13} className="ctrl-bat-icon full" />
}

export default function ControllerStatus() {
  const [bt, setBt] = useState<BtDevice[]>([])
  const [gamepads, setGamepads] = useState<{ id: string; index: number }[]>([])
  const prevBattery = useState<Record<string, number>>(() => ({}))[0]

  // Poll Windows for connected Bluetooth devices (primary source — sees idle devices).
  const pollBt = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.getBluetoothDevices) return
    try {
      const list: BtDevice[] = await api.getBluetoothDevices()
      setBt(Array.isArray(list) ? list.filter(d => d && d.name) : [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    pollBt()
    const id = setInterval(pollBt, 10_000)
    return () => clearInterval(id)
  }, [pollBt])

  // Gamepad API — supplements with USB / actively-used controllers not on Bluetooth.
  useEffect(() => {
    const read = () => {
      const gps = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []
      setGamepads(gps.filter((g): g is Gamepad => !!g).map(g => ({ id: g.id, index: g.index })))
    }
    read()
    const onConn = () => read()
    window.addEventListener('gamepadconnected', onConn)
    window.addEventListener('gamepaddisconnected', onConn)
    const id = setInterval(read, 2000)
    return () => { window.removeEventListener('gamepadconnected', onConn); window.removeEventListener('gamepaddisconnected', onConn); clearInterval(id) }
  }, [])

  // Devices the user hid in Software → Dispositivos must not appear in the top-bar HUD.
  let hidden: string[] = []
  try { const s = localStorage.getItem('nn-hidden-devices'); hidden = s ? JSON.parse(s) : [] } catch {}
  const btVisible = bt.filter(d => !hidden.includes(norm(d.name)))

  // Build display list. Number duplicate names so two identical controllers both show distinctly.
  const nameCounts: Record<string, number> = {}
  const items = btVisible.map(d => {
    const type = deviceType(d.name)
    const base = norm(d.name)
    nameCounts[base] = (nameCounts[base] || 0) + 1
    let charging = false
    if (d.battery != null) {
      const prev = prevBattery[d.id]
      if (prev != null && d.battery > prev) charging = true
      prevBattery[d.id] = d.battery
    }
    return { key: d.id, name: d.name, type, battery: d.battery, charging, dupIndex: nameCounts[base] }
  })
  // Add a suffix for duplicated names (only when >1 of that name exists).
  const totalByName: Record<string, number> = {}
  for (const it of items) totalByName[norm(it.name)] = (totalByName[norm(it.name)] || 0) + 1
  const display = items.map(it => ({ ...it, label: totalByName[norm(it.name)] > 1 ? `${it.name} (${it.dupIndex})` : it.name }))

  // Supplement: USB / active gamepads not already represented by a Bluetooth entry.
  for (const g of gamepads) {
    const gn = norm(g.id)
    const label = g.id.replace(/\(.*\)/, '').trim() || `Control ${g.index + 1}`
    if (hidden.includes(norm(label))) continue
    const already = btVisible.some(d => { const dn = norm(d.name); return dn.includes(gn) || gn.includes(dn) || (deviceType(d.name) === 'controller' && /control|gamepad|wireless/.test(gn)) })
    if (!already) {
      display.push({ key: 'gp-' + g.index, name: label, label, type: 'controller', battery: null, charging: false, dupIndex: 1 })
    }
  }

  if (display.length === 0) return null

  return (
    <div className="controller-status">
      {display.map(d => (
        <div key={d.key} className={`ctrl-chip ${d.charging ? 'charging' : ''}`} title={`${d.label}${d.battery != null ? ` — ${d.battery}%${d.charging ? ' (cargando)' : ''}` : ' — conectado'}`}>
          <span className={`ctrl-pad-icon type-${d.type}`}><DeviceIcon type={d.type} /></span>
          {d.battery != null ? (
            <span className="ctrl-bat">
              {d.charging && <Zap size={9} className="ctrl-charge-bolt" />}
              <BatteryIcon level={d.battery} />
              <span className="ctrl-bat-pct">{d.battery}%</span>
            </span>
          ) : (
            <span className="ctrl-dot" />
          )}
        </div>
      ))}
    </div>
  )
}
