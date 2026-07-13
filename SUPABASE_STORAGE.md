# Supabase Storage — imágenes (`nn-images`)

Desde **v1.01.42**, las imágenes que subís en la app (avatar, banner/logo de tiendas Etsy,
banner de rutinas) se guardan en **Supabase Storage** y en `localStorage` queda solo la
**URL**. Así no cuentan contra el límite de ~5 MB de `localStorage` ni engordan la sync.

> **Sin setup la app igual funciona:** si el bucket no existe (o no hay sesión/conexión),
> el código cae automáticamente al método anterior (guarda la imagen como *data URL*). No
> se rompe nada; simplemente esas imágenes no van al bucket hasta que lo crees.

## 1. Crear el bucket

En el panel de Supabase → **Storage** → **New bucket**:

- **Name:** `nn-images`
- **Public bucket:** ✅ **activado** (las imágenes se sirven por URL pública)
- Create.

## 2. Políticas (RLS) de `storage.objects`

En **SQL Editor**, ejecutá:

```sql
-- Subir: cada usuario autenticado sube dentro de su propia carpeta (uid/...)
create policy "nn-images auth insert"
on storage.objects for insert to authenticated
with check ( bucket_id = 'nn-images' and (storage.foldername(name))[1] = auth.uid()::text );

-- Actualizar / borrar los propios archivos (opcional pero recomendado)
create policy "nn-images auth update"
on storage.objects for update to authenticated
using ( bucket_id = 'nn-images' and (storage.foldername(name))[1] = auth.uid()::text );

create policy "nn-images auth delete"
on storage.objects for delete to authenticated
using ( bucket_id = 'nn-images' and (storage.foldername(name))[1] = auth.uid()::text );

-- Lectura pública (con bucket público suele alcanzar; esto lo deja explícito)
create policy "nn-images public read"
on storage.objects for select to public
using ( bucket_id = 'nn-images' );
```

La ruta de cada imagen es `<uid>/<carpeta>/<archivo>` (carpetas: `avatar`, `etsy-banner`,
`etsy-logo`, `routine`, `misc`), por eso la política valida que el primer segmento sea el
`uid` del usuario.

## 3. Listo

Después de crear el bucket + políticas, cada imagen nueva que subas se guarda en la nube y
la app referencia su URL. Las imágenes que ya tenías (como *data URL*) siguen funcionando y
sincronizando como antes; se irán reemplazando por URLs a medida que las vuelvas a subir.

Implementación: [`src/lib/imageStore.ts`](src/lib/imageStore.ts).
