interface ElectronAPI {
  setFileAssociations: (browser: string) => Promise<{ success: boolean; browser: string; results: Array<{ ext: string; status: string; detail: string }> }>
  getCurrentAssociations: () => Promise<Record<string, string>>
  openBrowserSettings: (browser: string) => Promise<{ success: boolean; error?: string }>
  openExternal: (url: string) => Promise<{ success: boolean }>
  getPlatform: () => Promise<{ platform: string; isDesktop: boolean }>
  isDesktop: boolean
}

interface Window {
  electronAPI?: ElectronAPI
}
