# Nova Nexus — guía para trabajar en este repo

App de escritorio "todo en uno" (Electron + React + Vite + TypeScript). Todo el
estado del usuario vive en `localStorage` (claves `nn-*`) y se sincroniza a la nube.

> **Mapa completo del código:** ver [ARCHITECTURE.md](ARCHITECTURE.md) — contiene la
> tabla sección→archivo, el registro de todas las claves `nn-*`, los handlers IPC,
> las APIs externas y el flujo de sincronización. Leelo antes de buscar dónde vive algo.

## Stack
- React 19 + Vite 8 + TypeScript en `src/`
- Electron en `electron/` (`main.cjs` proceso principal, `preload.cjs` puente, `transfer.cjs` servidor de transferencia WiFi)
- Sin framework de estado: todo es `localStorage` + hooks locales

## Comandos
```bash
npm run dev            # Vite dev server (http://localhost:2000)
npm run electron:dev   # Vite + Electron juntos (desarrollo de escritorio)
npm run build          # tsc -b && vite build  → genera dist/  (correr SIEMPRE antes de desplegar)
npm run lint           # oxlint
```
Verificación mínima de cualquier cambio: `npm run build` debe pasar sin errores de TypeScript.

## Versión
- Definida en `src/App.tsx` → `APP_VERSION`. Esquema `X.XX.XX`; subir **+1 al último dígito** por cada cambio.
- El badge de versión se muestra abajo a la derecha de la app.

## Despliegue a la app empaquetada (Windows)
`electron-builder` falla con EPERM en esta máquina (Defender bloquea el .exe firmado),
así que se usa **empaquetado manual**: ya existe `build-output/win-unpacked/`.
Para actualizar después de un build:
```bash
# 1) build
npm run build
# 2) copiar dist/ a la app empaquetada (Git Bash / robocopy)
robocopy "dist" "build-output/win-unpacked/resources/app/dist" /MIR
# 3) SOLO si cambiaste electron/*.cjs, copiarlos también:
#    resources/app/electron/{main.cjs,preload.cjs,transfer.cjs}
```
- Cambios solo de `src/` → basta recargar la app (o re-desplegar `dist`).
- Cambios de `electron/*.cjs` → hace falta **cerrar y reabrir** "Nova Nexus".
- robocopy con `/MIR` devuelve exit code 1 o 3 en caso de éxito (no es error).

## Convenciones clave
- **Persistencia:** cualquier dato nuevo va en una clave **`nn-*`** de `localStorage`. Eso lo
  hace sincronizar a la nube automáticamente (ver `src/lib/cloudSync.ts`, que intercepta
  `setItem`/`removeItem` de toda clave `nn-`). Claves SIN `nn-` no se sincronizan.
- **Navegación dentro de archivos grandes:** cada componente/área está separada por
  comentarios `// ============ NOMBRE ============`. Buscá por ese patrón para saltar.
- **Secciones:** una sección de la app = un archivo en `src/components/sections/<Nombre>Section.tsx`
  con su `.css` al lado. Se registran en `src/App.tsx` (tipo `Section`) y `MainContent.tsx`.
- **Acceso a Electron:** desde el renderer se usa `window.electronAPI.<método>` (expuesto en
  `electron/preload.cjs`). Cada método mapea a un `ipcMain.handle('<canal>')` en `main.cjs`.
  Para agregar una capacidad nativa: handler en `main.cjs` + método en `preload.cjs` + tipo en `src/electron.d.ts`.
- **Reutilizables:** hooks/utilidades en `src/lib/` (sonidos, sync, escala de UI, tabs reordenables).
  El **Editor de Textos** unificado (rich text) vive en `src/components/RichTextEditor.tsx`
  (contentEditable no controlado: siembra HTML por `docKey`, reporta por `onChange`). Se usa
  en toda edición rica (descripciones, notas, diarios, etc.). El `BlockEditor` (Anotaciones
  estilo Notion) sigue en `PersonalSection.tsx`.
- **Canvas:** los widgets con canvas (reloj, ruleta, gráficos) usan `ResizeObserver` y
  guardas de tamaño `> 0` para no romper cuando están ocultos (no quitar esas guardas).

## Privacidad / seguridad (no romper)
- **`.env` está en `.gitignore` y nunca se commitea** (credenciales de Supabase). En el repo
  solo va `.env.example`.
- No documentar ni hardcodear credenciales nuevas en archivos versionados.
- La clave de Supabase usada en la app es la *publishable/anon* (pública por diseño, con RLS);
  la `service_role` NUNCA se usa en el cliente.
