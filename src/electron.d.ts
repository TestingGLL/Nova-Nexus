interface ElectronAPI {
  setFileAssociations: (browser: string) => Promise<{ success: boolean; browser: string; results: Array<{ ext: string; status: string; detail: string }> }>
  getCurrentAssociations: () => Promise<Record<string, string>>
  openBrowserSettings: (browser: string) => Promise<{ success: boolean; error?: string }>
  openExternal: (url: string) => Promise<{ success: boolean }>
  getPlatform: () => Promise<{ platform: string; isDesktop: boolean }>
  emptyRecycleBin: () => Promise<{ success: boolean; message?: string }>
  openAppData: () => Promise<{ success: boolean; dir: string; message?: string }>
  transferStart: () => Promise<{ success: boolean; ip?: string; port?: number; url?: string; dir?: string; message?: string }>
  transferStop: () => Promise<{ success: boolean }>
  transferAddShared: () => Promise<{ success: boolean; files: { id: string; name: string; size: number }[] }>
  transferRemoveShared: (id: string) => Promise<{ success: boolean; files: { id: string; name: string; size: number }[] }>
  transferGetShared: () => Promise<{ id: string; name: string; size: number }[]>
  transferReceived: () => Promise<Array<{ name?: string; size?: number; ts: number; type?: string; text?: string }>>
  transferClearReceived: () => Promise<{ success: boolean }>
  transferStatus: () => Promise<{ running: boolean; ip: string; port: number; url: string; dir?: string }>
  transferOpenFolder: () => Promise<{ success: boolean }>
  showNotification: (title: string, body: string) => Promise<{ success: boolean }>
  getBluetoothDevices: () => Promise<Array<{ id: string; name: string; battery: number | null; class: string }>>
  getCryptoPrices: () => Promise<{ success: boolean; data?: Record<string, { ars: number; usd: number; ars_24h_change?: number; last_updated_at?: number }>; message?: string }>
  getCryptoChart: (coinId: string, days: number) => Promise<{ success: boolean; data?: { prices: [number, number][] }; message?: string }>
  getMundialScores: () => Promise<{
    success: boolean
    matches?: Array<{
      id: string
      home: { name: string; abbr: string; score: number; logo: string }
      away: { name: string; abbr: string; score: number; logo: string }
      state: string
      clock: string
      detail: string
      startTime: string
    }>
    message?: string
  }>
  isDesktop: boolean
}

interface Window {
  electronAPI?: ElectronAPI
}
