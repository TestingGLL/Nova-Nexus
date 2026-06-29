# Nova Nexus

Plataforma de escritorio "todo en uno" para uso personal: inicio con widgets
combinables, finanzas, gestión de tiendas de Etsy, salud y rutinas, notas,
proyectos, alertas, criptomonedas, herramientas de software y más.

Construida con **Electron + React 19 + Vite + TypeScript**. Todos los datos viven
localmente en el dispositivo y se sincronizan a la nube (Supabase) de forma
*offline-first*, así que la información está disponible en cualquier PC.

## Desarrollo

```bash
npm install
npm run dev            # solo el frontend en http://localhost:2000
npm run electron:dev   # app de escritorio completa (Vite + Electron)
npm run build          # compila TypeScript y genera dist/
```

## Estructura

- `src/` — aplicación React (secciones en `src/components/sections/`, utilidades en `src/lib/`)
- `electron/` — proceso principal, preload y servidor de transferencia WiFi
- `dist/` — build de producción (generado)

Para el mapa detallado del código, las claves de almacenamiento, los canales IPC y
el flujo de sincronización, ver **[ARCHITECTURE.md](ARCHITECTURE.md)**. Para comandos,
versionado y despliegue, ver **[CLAUDE.md](CLAUDE.md)**.

## Configuración

Copiá `.env.example` a `.env` y completá las credenciales de Supabase
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). El archivo `.env` no se versiona.
Si no se configuran, la app funciona igual de forma local (sin sincronización en la nube).
