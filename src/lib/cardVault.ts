// Cifrado en reposo de las tarjetas (AES-GCM 256; clave derivada de una frase con
// PBKDF2). `nn-cards` guarda un "envelope" cifrado y la frase NUNCA se persiste.
//
// Además se mantiene `nn-cards-index`: una lista NO sensible (id, nombre, color) que
// permite que Promociones y los widgets muestren el nombre de la tarjeta sin descifrar.
// Los campos sensibles (número, CVV, titular, vencimiento) sólo viven cifrados.

const enc = new TextEncoder()
const dec = new TextDecoder()
const PBKDF2_ITER = 150000

const toB64 = (u: ArrayBuffer | Uint8Array): string => {
  const arr = u instanceof Uint8Array ? u : new Uint8Array(u)
  let s = ''; for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i])
  return btoa(s)
}
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0))
// Copia a un ArrayBuffer fresco (WebCrypto exige BufferSource respaldado por ArrayBuffer,
// no ArrayBufferLike/SharedArrayBuffer como tipa el Uint8Array genérico de TS).
const ab = (u: Uint8Array): ArrayBuffer => { const b = new ArrayBuffer(u.byteLength); new Uint8Array(b).set(u); return b }

export interface CardEnvelope { v: 1; enc: true; salt: string; iv: string; ct: string }
export function isCardEnvelope(x: any): x is CardEnvelope {
  return !!x && x.enc === true && typeof x.ct === 'string' && typeof x.salt === 'string' && typeof x.iv === 'string'
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', ab(enc.encode(passphrase)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: ab(salt), iterations: PBKDF2_ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

// Clave nueva con salt aleatorio (primer cifrado o cambio de frase).
export async function newVaultKey(passphrase: string): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { key: await deriveKey(passphrase, salt), salt }
}

// Cifra `data` y verifica el round-trip ANTES de devolver (nunca corrompe datos).
export async function encryptVerified<T>(data: T, key: CryptoKey, salt: Uint8Array): Promise<CardEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const json = JSON.stringify(data)
  const ivBuf = ab(iv)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBuf }, key, ab(enc.encode(json)))
  const check = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, ct)
  if (dec.decode(check) !== json) throw new Error('Verificación de cifrado fallida')
  return { v: 1, enc: true, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) }
}

// Descifra un envelope con la frase. Lanza si la frase es incorrecta o el dato está dañado.
export async function decryptVault<T>(env: CardEnvelope, passphrase: string): Promise<{ data: T; key: CryptoKey; salt: Uint8Array }> {
  const salt = fromB64(env.salt)
  const key = await deriveKey(passphrase, salt)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ab(fromB64(env.iv)) }, key, ab(fromB64(env.ct)))
  return { data: JSON.parse(dec.decode(pt)) as T, key, salt }
}

// ---- Índice no sensible (id + nombre + color), disponible sin descifrar ----
export interface CardIndexEntry { id: string; label?: string; bank?: string; color?: string }
export function saveCardIndex(cards: CardIndexEntry[]) {
  localStorage.setItem('nn-cards-index', JSON.stringify(cards.map(c => ({ id: c.id, label: c.label, bank: c.bank, color: c.color }))))
}
export function loadCardIndex(): CardIndexEntry[] {
  try {
    const raw = localStorage.getItem('nn-cards')
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) return parsed.map((c: any) => ({ id: c.id, label: c.label, bank: c.bank, color: c.color }))
    if (isCardEnvelope(parsed)) { const idx = localStorage.getItem('nn-cards-index'); return idx ? JSON.parse(idx) : [] }
  } catch {}
  return []
}
