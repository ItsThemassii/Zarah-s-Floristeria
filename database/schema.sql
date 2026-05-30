-- ============================================================
-- Zarah's Floristería — Esquema de base de datos (Supabase / PostgreSQL)
-- ============================================================
-- Crea las 4 tablas principales del proyecto.
-- NOTA: las políticas RLS (Row Level Security) NO están incluidas aquí.
--       Se agregan en un paso posterior.
-- Listo para pegar en el SQL Editor de Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabla: productos
-- ------------------------------------------------------------
create table if not exists public.productos (
    id              bigserial    primary key,
    nombre          text         not null,
    precio          numeric      not null,
    precio_anterior numeric,
    imagen_url      text,
    categorias      text[],
    caracteristicas text[],
    en_oferta       boolean      not null default false,
    created_at      timestamptz  not null default now()
);

-- ------------------------------------------------------------
-- 2. Tabla: ventas
-- ------------------------------------------------------------
create table if not exists public.ventas (
    id               bigserial    primary key,
    cliente_nombre   text,
    cliente_whatsapp text,
    productos        jsonb,
    total            numeric,
    estado           text         not null default 'pendiente',
    dedicatoria      text,
    notas            text,
    fecha            timestamptz  not null default now()
);

-- ------------------------------------------------------------
-- 3. Tabla: clientes
-- ------------------------------------------------------------
create table if not exists public.clientes (
    id         bigserial    primary key,
    nombre     text         not null,
    whatsapp   text,
    notas      text,
    created_at timestamptz  not null default now()
);

-- ------------------------------------------------------------
-- 4. Tabla: configuracion
-- ------------------------------------------------------------
create table if not exists public.configuracion (
    clave text primary key,
    valor text
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- En Supabase existen dos roles relevantes para las políticas:
--   * anon          -> visitante SIN login (usa la anon key pública).
--   * authenticated -> usuario CON sesión iniciada (el admin logueado).
-- Al activar RLS, NINGUNA fila es accesible hasta que una política
-- lo permita explícitamente. Por eso definimos una política por cada
-- operación (SELECT / INSERT / UPDATE / DELETE) que queramos habilitar.
--
-- Sintaxis usada:
--   to public         -> aplica a cualquiera (anon + authenticated).
--   to authenticated  -> aplica solo a usuarios con sesión.
--   using (...)       -> condición para leer/actualizar/borrar filas existentes.
--   with check (...)  -> condición que deben cumplir las filas al insertar/actualizar.
-- ============================================================


-- ------------------------------------------------------------
-- RLS: productos
--   Lectura pública; escritura solo para autenticados.
-- ------------------------------------------------------------
alter table public.productos enable row level security;

-- Cualquiera puede LEER el catálogo (la tienda pública lo necesita).
create policy "productos: lectura publica"
    on public.productos
    for select
    to public
    using (true);

-- Solo un usuario autenticado (el admin) puede CREAR productos.
create policy "productos: insertar solo autenticados"
    on public.productos
    for insert
    to authenticated
    with check (true);

-- Solo un usuario autenticado puede ACTUALIZAR productos.
create policy "productos: actualizar solo autenticados"
    on public.productos
    for update
    to authenticated
    using (true)
    with check (true);

-- Solo un usuario autenticado puede BORRAR productos.
create policy "productos: borrar solo autenticados"
    on public.productos
    for delete
    to authenticated
    using (true);


-- ------------------------------------------------------------
-- RLS: ventas
--   Lectura solo autenticados; inserción pública (cliente sin login
--   puede crear un pedido); actualización y borrado solo autenticados.
-- ------------------------------------------------------------
alter table public.ventas enable row level security;

-- Solo el admin autenticado puede VER las ventas/pedidos.
create policy "ventas: lectura solo autenticados"
    on public.ventas
    for select
    to authenticated
    using (true);

-- Cualquiera puede CREAR un pedido (un cliente sin login reserva por WhatsApp).
create policy "ventas: insertar publico"
    on public.ventas
    for insert
    to public
    with check (true);

-- Solo el admin autenticado puede ACTUALIZAR una venta (ej. cambiar estado).
create policy "ventas: actualizar solo autenticados"
    on public.ventas
    for update
    to authenticated
    using (true)
    with check (true);

-- Solo el admin autenticado puede BORRAR una venta.
create policy "ventas: borrar solo autenticados"
    on public.ventas
    for delete
    to authenticated
    using (true);


-- ------------------------------------------------------------
-- RLS: clientes
--   CRUD completo solo para usuarios autenticados.
--   (Datos privados de la libreta de clientes; el público no los toca.)
-- ------------------------------------------------------------
alter table public.clientes enable row level security;

-- Una sola política "for all" cubre SELECT, INSERT, UPDATE y DELETE
-- para el rol authenticated. El público queda sin ningún acceso.
create policy "clientes: crud solo autenticados"
    on public.clientes
    for all
    to authenticated
    using (true)
    with check (true);


-- ------------------------------------------------------------
-- RLS: configuracion
--   Lectura pública; escritura solo para autenticados.
-- ------------------------------------------------------------
alter table public.configuracion enable row level security;

-- Cualquiera puede LEER la configuración (la tienda muestra nombre,
-- WhatsApp, horario, etc.).
create policy "configuracion: lectura publica"
    on public.configuracion
    for select
    to public
    using (true);

-- Solo el admin autenticado puede CREAR claves de configuración.
create policy "configuracion: insertar solo autenticados"
    on public.configuracion
    for insert
    to authenticated
    with check (true);

-- Solo el admin autenticado puede ACTUALIZAR la configuración.
create policy "configuracion: actualizar solo autenticados"
    on public.configuracion
    for update
    to authenticated
    using (true)
    with check (true);

-- Solo el admin autenticado puede BORRAR claves de configuración.
create policy "configuracion: borrar solo autenticados"
    on public.configuracion
    for delete
    to authenticated
    using (true);


-- ============================================================================
-- POLÍTICAS RLS DEL STORAGE BUCKET `productos-imagenes`
-- ============================================================================
-- Las imágenes de los productos viven en el bucket de Storage
-- `productos-imagenes`. El bucket es público, así que la LECTURA ya está
-- permitida para cualquiera (la tienda muestra las fotos sin login).
--
-- Estas 3 políticas dan permiso de ESCRITURA solo al admin autenticado, que es
-- quien sube/reemplaza/borra imágenes desde el panel:
--   - INSERT  → subir una imagen nueva al bucket (subirYGuardarImagen()).
--   - UPDATE  → reemplazar el archivo de una imagen existente.
--   - DELETE  → borrar imágenes huérfanas (limpieza, mejora futura).
--
-- Se aplican sobre storage.objects, filtrando por bucket_id para que solo
-- afecten a este bucket y no a otros.
-- ============================================================================

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'productos-imagenes');

CREATE POLICY "Authenticated users can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'productos-imagenes');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'productos-imagenes');
