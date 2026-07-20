# Nova Nexus — arquitectura y mapa del código

Referencia para ubicar rápido cualquier funcionalidad. Para comandos, versión y
despliegue ver [CLAUDE.md](CLAUDE.md).

## Mapa de directorios

```
electron/                Proceso de escritorio (Node)
  main.cjs               Ventana, tray, spellcheck, handlers IPC (ver tabla abajo)
  preload.cjs            contextBridge → window.electronAPI
  transfer.cjs           Servidor HTTP de transferencia WiFi (QR) entre PC y celular
scripts/
  make-icon.cjs          Generador del icono (PNG) de la app
src/
  App.tsx                Raíz: login gate, layout, APP_VERSION, campana de alertas
  main.tsx               Bootstrap React; aplica la escala de UI antes del primer render
  electron.d.ts          Tipos de window.electronAPI
  contexts/
    ThemeContext.tsx     Tema claro/oscuro + color de acento
  lib/                   Utilidades reutilizables (ver abajo)
  components/
    Sidebar / MainContent / Login / Toast / SoundFx / KeyboardShortcuts /
    ControllerStatus / SectionErrorBoundary
    sections/            Una sección de la app por archivo (+ .css)
```

### `src/lib/`
| Archivo | Qué hace |
|---|---|
| `cloudSync.ts` | Sync offline-first localStorage↔Supabase. Intercepta `setItem`/`removeItem` de claves `nn-*`, las encola en un outbox persistente y las sube cuando hay conexión + sesión. `startCloudSync()` baja la copia de la nube al iniciar sesión. |
| `supabase.ts` | Cliente Supabase (se autodeshabilita si faltan credenciales). Tabla `nova_data` (key-value JSONB por usuario, con RLS). |
| `sounds.ts` | Sonidos sutiles de UI (`sfx.*`), on/off y volumen. |
| `uiScale.ts` | Escala global de tipografía/UI vía `zoom` en la raíz. Clave `nn-ui-scale`. |
| `dolarBlue.ts` | `useDolarBlue()` (cotización via Electron) + `fmtUsdArs()`/`toArs()` para conversión USD→ARS. Lo usan Etsy y Finanzas. |
| `notifications.ts` | Tipos + `loadNotifications()`/`saveNotifications()`/`addNotification()`. Compartido (App, Inicio, Personal, Alertas) para no arrastrar la UI de Alertas al bundle principal. |
| `mundialStore.ts` | Watcher global del Mundial (poll adaptativo 1s/60s) que detecta goles y dispara sonido + notificación **en toda la app**. La UI de Inicio solo se suscribe. |
| `timerStore.ts` | Motor global del temporizador (cuenta regresiva singleton) que suena/notifica al terminar aunque estés en otra sección o minimizado. El widget de Inicio se suscribe. |
| `useReorderableTabs.ts` | Hook para barras de pestañas reordenables por drag. |
| `tabRoute.tsx` | Ruta interna de cada tab. `useSubTab(level, default, items)` reemplaza al `useState` de una fila de sub-pestañas: el valor activo sale de la ruta de la tab, el clic izquierdo navega en el lugar y `tabProps(id, label)` agrega clic central y menú «Abrir en nueva pestaña». Sin provider cae a estado local. |

### Componentes raíz (`src/components/`)
| Archivo | Qué hace |
|---|---|
| `Sidebar.tsx` | Navegación entre secciones; orden persistido en `nn-section-order`. |
| `MainContent.tsx` | Renderiza las **tabs abiertas** (máx 5): todas montadas, solo la activa visible (`display:none` en las demás) para no perder su estado. Cada tab se monta dentro de un `TabRouteProvider` (`lib/tabRoute.tsx`) que le da su ruta interna. La barra de pestañas es `TabBar.tsx`. Cada sección es un chunk vía `React.lazy`. Overlay de bloqueo (`nn-locked-sections`) y `SectionErrorBoundary`. |
| `TabBar.tsx` | Barra de pestañas: activar, cerrar (X / botón central / menú contextual). Rotula con la ruta completa (`Finanzas › Alquiler › Servicios`). Estado en `lib/tabs.ts`, orquestado por `AppShell` en `App.tsx`. Sidebar abre en tab nueva por clic derecho/central. |
| `Login.tsx` | Validación local + Supabase Auth, "recordar dispositivo", recuperación. |
| `Toast.tsx` | `ToastProvider` + `useToast()` (notificaciones efímeras). |
| `ConfirmDialog.tsx` | `ConfirmProvider` + `useConfirm()` → `Promise<boolean>`. Diálogo de confirmación para acciones destructivas (borrar tienda, grupo, proyecto, nota, tarjeta, etc.). |
| `SoundFx.tsx` | Engancha los sonidos de UI a eventos globales. |
| `KeyboardShortcuts.tsx` | Atajos globales. |
| `ControllerStatus.tsx` | HUD de dispositivos Bluetooth en la barra superior. |

## Secciones (`src/components/sections/`)

Cada archivo grande usa separadores `// ============ NOMBRE ============`; abajo se
listan sus sub-áreas para saltar directo.

| Sección | Archivo | Sub-áreas internas |
|---|---|---|
| Inicio | `InicioSection.tsx` | Animated Clock · Quotes · QuickChat→Ideas · Timer/Weather/Calendar widgets · Day+Routine · Next Alerts · Mundial 2026 · Global Search · Pending Items · grid combinable de widgets |
| Personal | `PersonalSection.tsx` | Salud (WaterCounter, ExercisePanel) · Tarjetas · Recordatorios (BlockEditor) · Lista de compras · Wishlist/Compras · **RichTextEditor (reutilizable)** · Diario · Objetivos · Hoy (rutina del día) |
| Finanzas | `FinanzasSection.tsx` | Data model · Alquiler · Gastos propios · (Criptomonedas se monta como página) |
| Etsy | `EtsySection.tsx` | Types · AddArticleModal · BrandPanel · Artículos (ArticleItem, GroupPanel) · Lanzamientos (LaunchSelectorModal, LaunchesTab) · Creaciones · Finanzas · Planificación · Clientes · StoreView |
| Criptomonedas | `CriptomonedasSection.tsx` | Precios y gráficos (CoinGecko). Se usa dentro de Finanzas. |
| Software | `SoftwareSection.tsx` | Navegador · Dispositivos (BT) · Papelera · AppData · Transferencias WiFi |
| Edición | `EdicionSection.tsx` | Pestañas: Conversor de imágenes · **Guía de Apps** (`GuiaAppsPage.tsx`: galería de apps → tarjeta alta clickeable para entrar; adentro paneles General/Visual con subpaneles **anidables** (breadcrumb de ramificación auto) y RichTextEditor; edición de banner por engranaje) |
| Notas | `NotasSection.tsx` | Notas con carpetas, tags, búsqueda, auto-borrado |
| Proyectos | `ProyectosSection.tsx` | Proyectos (lista / kanban) |
| Extras | `ExtrasSection.tsx` | Aleatorio: ruleta (SpinWheel) y grilla random |
| Alertas | `AlertasSection.tsx` | Notificaciones/recordatorios; `loadNotifications()` exportado |
| Configuración | `ConfiguracionSection.tsx` | Personalización · Paneles · Adicionales · Prompts · Usuario · Alertas · **Sistema** (sonidos, escala de tipografía, tray) |

Las secciones se registran en el tipo `Section` de `src/App.tsx` y en `MainContent.tsx`.

## Registro de claves `localStorage` (`nn-*`)

Todas se sincronizan a la nube automáticamente (cloudSync intercepta el prefijo `nn-`).
Al agregar una funcionalidad nueva, usar una clave `nn-` y sumarla a esta tabla.

### Global / configuración
| Clave | Contenido |
|---|---|
| `nn-accent` / `nn-dark-mode` | Color de acento / tema (ThemeContext) |
| `nn-ui-scale` | Escala global de tipografía/UI |
| `nn-sounds` / `nn-sounds-vol-migrated` | Sonidos de UI on/off y volumen / flag de migración |
| `nn-section-order` | Orden de secciones en el sidebar |
| `nn-tabs` | Pestañas abiertas de la app `{ open: Tab[], active: id }` (máx 5). Cada `Tab` es `{ id, section, path[], labels[] }`: `path` son los ids de las sub-pestañas activas de afuera hacia adentro (`['alquiler','servicios']`). Lógica en `src/lib/tabs.ts`; barra en `TabBar.tsx`. Persiste al reiniciar |
| `nn-locked-sections` | Secciones bloqueadas |
| `nn-profile` | Perfil de usuario (avatar, nombre…) |
| `nn-remember-login` | "Recordar dispositivo" |
| `nn-{config,personal,software,finanzas}-tab-order` | Orden de pestañas por sección |

### Inicio / widgets
| Clave | Contenido |
|---|---|
| `nn-inicio-layout` | Layout de bloques de widgets (combinables, anchos 1x–3x) |
| `nn-hidden-widgets` | Widgets ocultos |
| `nn-clock-colors` / `nn-clock-font` / `nn-clock-weather` | Config del reloj animado |
| `nn-timer-default` / `nn-timer-presets` / `nn-timer-sound` | Temporizador |
| `nn-cal-events` | Eventos del widget calendario |

### Personal / Salud
| Clave | Contenido |
|---|---|
| `nn-cards` / `nn-cards-view` | Tarjetas **cifradas** (AES-GCM, envelope; ver `lib/cardVault.ts`) / vista `list`|`grid` |
| `nn-cards-index` | Índice NO sensible de tarjetas (id/nombre/color) para mostrar nombres sin descifrar |
| `nn-promo-apps` | Opciones del campo «Aplicación» de Promociones (ver `lib/promoApps.ts`) |
| `nn-images` (bucket) | Imágenes en Supabase Storage; en localStorage se guarda solo la URL (ver `lib/imageStore.ts` y `SUPABASE_STORAGE.md`) |
| `nn-shopping` / `nn-custom-categories` | Listas de compras / categorías |
| `nn-shopping-sort` / `nn-shopping-collapsed` | Orden de las listas (`manual`/`alpha`) / listas contraídas |
| `nn-wishlist` | Compras / wishlist |
| `nn-wishlist-sort` / `nn-wishlist-collapsed` | Orden de artículos (`manual`/`alpha`) / categorías contraídas |
| `nn-diary` / `nn-diary-chapters` | Diario de pensamientos |
| `nn-goals` | Objetivos |
| `nn-reminders` / `nn-reminder-blocks` | Recordatorios (editor por bloques) |
| `nn-exercise-routines` / `nn-stretches` | Rutinas de ejercicio / estiramientos |
| `nn-week-routine` / `nn-active-week` | Rutina semanal / semana activa |
| `nn-week-autoadvance` / `nn-week-advance-marker` | Auto-avance de semana cada lunes (on/off) / lunes de la última semana procesada |
| `nn-water` / `nn-water-sound` | Contador de vasos de agua |

### Etsy
| Clave | Contenido |
|---|---|
| `nn-etsy-stores` | Tiendas (incluye artículos, grupos, sub-artículos, clientes, creaciones, ingresos) |
| `nn-etsy-migrated-v2` | Flag de migración de datos |
| `nn-prompt-groups` | Grupos de palabras (compartido con Configuración → Prompts) |

### Finanzas
| Clave | Contenido |
|---|---|
| `nn-rent` | Alquiler (servicios, división de gastos, historial, mantenimiento) |
| `nn-gastos-propios` | Gastos propios |
| `nn-gastos-usd` | Gastos en USD (fijos/pendientes/futuros, con tipo de pago y conversión a ARS) |

### Notas / Proyectos / Alertas / Extras
| Clave | Contenido |
|---|---|
| `nn-notas` / `nn-notas-folders` / `nn-note-tags` / `nn-notes-autodelete-days` | Notas, carpetas, tags, auto-borrado |
| `nn-ideas` | Ideas del QuickChat de Inicio (legado) |
| `nn-projects` | Proyectos |
| `nn-notifications` / `nn-alertas-config` | Alertas y su configuración |
| `nn-wheel-configs` / `nn-wheel-options` | Ruleta de Extras |

### Edición
| Clave | Contenido |
|---|---|
| `nn-edicion-guia-apps` | Guía de Apps: apps/banners (imagen/color, nombre) → paneles (color) → subpaneles anidables (color, `isBranch`, abierto/cerrado, html). Reordenables por grip. Copiar = texto con encabezados jerárquicos (#, ##, …) |
| `nn-edicion-guia-colors-v1` | Flag: recoloración retroactiva de subpaneles anidados hecha una vez (raíz + 15%/nivel) |
| `nn-edicion-tab` | Pestaña activa de la sección Edición (`conversor`/`guia`) |

> Nota: `__nn_outbox` (cola de sync) NO lleva prefijo `nn-` a propósito, para no sincronizarse a sí misma.

## Handlers IPC (`electron/main.cjs` ↔ `window.electronAPI`)

| Canal | Uso |
|---|---|
| `set-file-associations` / `get-current-associations` / `open-browser-settings` | Navegador por defecto |
| `open-external` / `open-appdata` / `empty-recycle-bin` | Sistema operativo |
| `show-notification` | Notificación de escritorio |
| `get-platform` | Info de plataforma |
| `get-bluetooth-devices` | Enumera dispositivos BT/audio (PnP via PowerShell) |
| `get-mundial-scores` | Resultados del Mundial (ESPN) |
| `get-crypto-prices` / `get-crypto-chart` | Precios/gráficos cripto (CoinGecko) |
| `get-dolar-blue` | Cotización dólar blue (dolarapi.com) para conversión USD→ARS |
| `transfer-*` | Servidor de transferencia WiFi (start/stop/status/shared/received/open-folder) |

## APIs externas
| API | Para qué | Nota |
|---|---|---|
| ESPN | Resultados Mundial 2026 | — |
| CoinGecko | Precios/gráficos cripto | Requiere header `User-Agent` (devuelve 403 sin él) |
| Open-Meteo | Clima (widget) | Coords de Bahía Blanca |
| dolarapi.com | Dólar blue | Conversión de precios USD→ARS en Etsy |

## Sincronización en la nube (resumen)
1. `src/lib/cloudSync.ts` sobrescribe `localStorage.setItem/removeItem` y encola cada
   cambio de clave `nn-*` en un outbox persistente (`__nn_outbox`).
2. El drenador sube el outbox a Supabase (tabla `nova_data`, key-value JSONB por usuario)
   cuando hay conexión + sesión; reintenta al reconectar y periódicamente.
3. Al iniciar sesión, `startCloudSync()` baja la copia de la nube **sin pisar** claves que
   aún están en el outbox (las ediciones offline ganan).
4. Acceso protegido por RLS: cada usuario solo ve sus filas.

## Gotchas conocidos
- **Empaquetado:** `electron-builder` da EPERM en esta máquina → se usa empaquetado manual
  + robocopy de `dist/` (ver CLAUDE.md).
- **CoinGecko:** sin `User-Agent` responde 403.
- **Canvas oculto:** dibujar con tamaño 0 lanza `IndexSizeError` y tira la app; por eso los
  widgets de canvas usan `ResizeObserver` y guardas `> 0`.
- **Escala de UI:** se aplica con `zoom` en `document.documentElement` (Chromium/Electron).
