# Arquitectura del proyecto Zarah's Floristería

> Manual de referencia para la migración de `localStorage` a Supabase.
> Última actualización: 2026-05-29 (branch `migracion-supabase`).

---

## Tabla de contenidos

1. [Resumen general](#resumen-general)
2. [Estado del repositorio](#estado-del-repositorio)
3. [Estructura de archivos y rol de cada uno](#estructura-de-archivos-y-rol-de-cada-uno)
4. [Inventario completo de localStorage](#inventario-completo-de-localstorage)
5. [Flujos principales del sitio](#flujos-principales-del-sitio)
6. [Hoja de ruta para migrar a Supabase](#hoja-de-ruta-para-migrar-a-supabase)
7. [Apéndice: mapeo claves de localStorage a tablas Supabase](#apéndice-mapeo-claves-de-localstorage-a-tablas-supabase)

---

## Resumen general

**Zarah's Floristería** es un sitio estático (HTML + CSS + JavaScript vanilla, sin frameworks ni bundler) que funciona como tienda online de arreglos florales, globos y regalos personalizados, con base en Callao/Lima (Perú).

### Stack actual

- **Frontend:** HTML, CSS, JavaScript puro (sin React, Vue, etc.)
- **Sin servidor / sin base de datos:** todo se persiste en `localStorage` del navegador.
- **Pagos / coordinación:** 100% por WhatsApp manual con la dueña (no hay checkout digital).
- **Hosting esperado:** estático (cualquier servicio sirve: GitHub Pages, Vercel, Netlify, Cloudflare Pages).

### Tres páginas, tres roles

| Página | Para quién | Función |
|---|---|---|
| `Landing.html` | Visitantes | Vitrina elegante con hero, categorías, productos destacados, dedicatoria y contacto. |
| `Productos.html` | Clientes | Catálogo completo con filtros, modal de producto, carrito y favoritos. |
| `admin.html` | Dueña (Zarah) | Panel privado con login, edición del catálogo, ventas, clientes y ajustes. |

### Limitaciones del sistema actual

- Los datos viven solo en el navegador donde se editaron. **No hay sincronización entre dispositivos.**
- Las fotos subidas desde el disco se guardan como base64 dentro del JSON del catálogo, lo que consume el cupo de localStorage rápidamente (~5-10 MB total).
- La contraseña del admin está en texto plano dentro de un archivo JavaScript público.
- No hay registro real de pedidos: las ventas se anotan a mano desde el admin.

---

## Estado del repositorio

**Importante:** el repo tiene archivos duplicados entre la raíz y `uploads/`, y en varios casos son **versiones distintas** del mismo archivo. Esto se debe a que la app creció iterativamente y las versiones rediseñadas se colocaron en la raíz, pero los HTML siguen apuntando por ruta relativa a los archivos de `uploads/`.

### Qué se carga realmente en el navegador

Los HTML viven en `uploads/` y referencian rutas relativas, así que **la app "viva" es la de `uploads/`**:

- `uploads/Landing.html` carga `styles.css`, `styles-2.css`, `contact.css`, `whatsapp.css`, `mobile.css` desde `uploads/`.
- `uploads/Productos.html` carga `productos.css`, `product-modal.css`, `whatsapp.css`, `products-data.js`, `products-app.js` desde `uploads/`.
- `uploads/admin.html` carga `admin.css`, `products-data.js`, `admin-app.js` desde `uploads/`.

### Diferencias entre versiones duplicadas

| Archivo | Raíz | uploads/ |
|---|---|---|
| `Landing.html` / `index.html` | Versión rediseñada (no activa) | Versión activa |
| `admin-app.js` | Versión **nueva grande** (858 líneas) con Ventas, Clientes, Ajustes, temas, backup | Versión **vieja reducida** que solo edita productos |
| `products-app.js` | Versión **nueva** con favoritos, panel lateral y carrito completo con reserva por WhatsApp | Versión **vieja** sin favoritos ni panel lateral |
| `products-data.js` | Idéntico | Idéntico |

**Recomendación antes de migrar:** consolidar el repo en una sola estructura. Si no, vas a migrar dos veces o vas a mezclar versiones por accidente.

---

## Estructura de archivos y rol de cada uno

### Documentación

- `README.md` — descripción comercial del sitio (estilo público/marketing).
- `ARQUITECTURA.md` — este archivo, manual técnico interno.

### Carpeta raíz (versión rediseñada, no activa hoy)

- `index.html` — landing rediseñada.
- `admin-app.js` — admin nuevo con secciones Productos, Ventas, Clientes y Ajustes.
- `products-app.js` — tienda pública con favoritos y carrito con reserva por WhatsApp.
- `products-data.js` — datos iniciales (16 productos), 10 categorías y contraseña.
- `styles.css`, `styles-2.css`, `contact.css`, `admin-views.css` — estilos rediseñados.
- `flowers-sprites.svg.html` — sprites SVG de flores.

### Carpeta `hero/` (imágenes reales del catálogo destacado)

- `conejo.jpg`, `gatito.jpg`, `kitty.jpg`, `koala.jpg`, `pooh.jpg` — adornos con peluches.
- `ferrero.jpeg` — caja de chocolates.
- `vinos.png` — vinos y cervezas.

### Carpeta `uploads/` (versión activa del sitio)

**HTML:**

- `Landing.html` — página principal.
- `Productos.html` — catálogo + carrito + favoritos.
- `admin.html` — panel administrativo.

**JavaScript:**

- `products-data.js` — datos iniciales (idéntico al de la raíz).
- `products-app.js` — lógica de la tienda pública.
- `admin-app.js` — lógica del admin (versión reducida).

**CSS:**

| Archivo | Rol |
|---|---|
| `styles.css` | Base, variables CSS, navegación, hero de la landing. |
| `styles-2.css` | Categorías y productos destacados de la landing. |
| `contact.css` | Sección de contacto de la landing. |
| `whatsapp.css` | Botón flotante de WhatsApp (las 3 páginas). |
| `productos.css` | Grid del catálogo, chips de filtros, paginación. |
| `product-modal.css` | Modal de detalle del producto. |
| `admin.css` | Panel admin completo (sidebar, tabla, modales). |

**Imágenes de productos:** `Adorno gatito.jpg`, `AdornoOsoPo.jpg`, `Ferrero.jpeg`, `adornoKoala.jpg`, `conejoAdorno.jpg`, `kittyAdorno.jpg`, varios `draw-*.png` y `pasted-*.png`.

### Cómo se conectan los archivos (mapa mental)

```
products-data.js  ←(cargado por todos los HTML)
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
        Landing.html         Productos.html         admin.html
       (script inline       +products-app.js     +admin-app.js
        para nav y                 │                     │
        animaciones)               └──── localStorage ───┘
                                       (depósito compartido
                                       entre las dos páginas
                                       en el mismo navegador)
```

---

## Inventario completo de localStorage

Estos son **todos los puntos donde el sitio guarda o lee datos del navegador**. Son los puntos a reemplazar durante la migración.

### Resumen de claves

| Clave | Tipo | Propósito | Dónde se usa |
|---|---|---|---|
| `zarah_products_v1` | localStorage | Catálogo de productos editado | Admin (escribe), tienda (lee) |
| `zarah_cart_v1` | localStorage | Carrito de compras del cliente | Tienda |
| `zarah_fav_v1` | localStorage | Favoritos del cliente | Tienda (solo versión nueva) |
| `zarah_sales_v1` | localStorage | Registro manual de ventas | Admin (solo versión nueva) |
| `zarah_clients_v1` | localStorage | Libreta de clientes | Admin (solo versión nueva) |
| `zarah_settings_v1` | localStorage | Info de la tienda (nombre, WhatsApp, horario, zona) | Admin (solo versión nueva) |
| `zarah_theme_v1` | localStorage | Tema visual (claro/oscuro/rosa) | Admin (solo versión nueva) |
| `zarah_accent_v1` | localStorage | Color de marca | Admin (solo versión nueva) |
| `zarah_password_v1` | localStorage | Contraseña del admin si fue cambiada | Admin |
| `zarah_admin_session` | sessionStorage | Marca de "logueado" durante la sesión | Admin |

### Inventario detallado por archivo

#### `uploads/products-app.js`

| Línea | Operación | Clave | Propósito |
|---|---|---|---|
| 41 | get | `zarah_products_v1` | Lee el catálogo guardado al cargar la tienda. |
| 43 | set | `zarah_products_v1` | Guarda el catálogo si la migración de formato lo cambió. |
| 308 | get | `zarah_cart_v1` | Lee el carrito del cliente. |
| 311 | set | `zarah_cart_v1` | Guarda el carrito tras añadir/modificar. |

#### `uploads/admin-app.js` (versión vieja)

| Línea | Operación | Clave | Propósito |
|---|---|---|---|
| 42 | get | `zarah_products_v1` | Lee el catálogo al entrar al panel. |
| 44 | set | `zarah_products_v1` | Guarda tras migración de formato. |
| 53 | set | `zarah_products_v1` | Guarda cambios del admin (edición, alta, baja). |
| 55 | get (session) | `zarah_admin_session` | Verifica si el admin está logueado. |
| 57 | set (session) | `zarah_admin_session` | Marca sesión iniciada. |
| 58 | remove (session) | `zarah_admin_session` | Cierra sesión. |

#### `products-app.js` (raíz, versión nueva)

| Línea | Operación | Clave | Propósito |
|---|---|---|---|
| 41 | get | `zarah_products_v1` | Lee el catálogo. |
| 43 | set | `zarah_products_v1` | Guarda tras migración. |
| 336 | get | `zarah_fav_v1` | Lee favoritos. |
| 339 | set | `zarah_fav_v1` | Guarda favoritos. |
| 358 | set | `zarah_fav_v1` | Limpia IDs huérfanos en favoritos. |
| 377 | get | `zarah_cart_v1` | Lee el carrito. |
| 380 | set | `zarah_cart_v1` | Guarda el carrito. |
| 399 | set | `zarah_cart_v1` | Limpia IDs huérfanos en el carrito. |

#### `admin-app.js` (raíz, versión nueva)

| Línea | Operación | Clave | Propósito |
|---|---|---|---|
| 49 | get | `zarah_products_v1` | Lee el catálogo. |
| 51 | set | `zarah_products_v1` | Guarda tras migración. |
| 60 | set | `zarah_products_v1` | Guarda cambios del admin. |
| 62 | get (session) | `zarah_admin_session` | Verifica login. |
| 64 | set (session) | `zarah_admin_session` | Marca sesión. |
| 65 | remove (session) | `zarah_admin_session` | Cierra sesión. |
| 97 | get | `zarah_theme_v1` | Lee tema visual. |
| 103 | get | `zarah_accent_v1` | Lee color de marca. |
| 111 | set | `zarah_theme_v1` | Cambia tema. |
| 116 | set | `zarah_accent_v1` | Cambia color de marca. |
| 134 | get | `zarah_sales_v1` | Lee historial de ventas. |
| 137 | set | `zarah_sales_v1` | Guarda venta nueva o cambio de estado. |
| 203 | get | `zarah_clients_v1` | Lee libreta de clientes. |
| 206 | set | `zarah_clients_v1` | Guarda cliente nuevo o eliminación. |
| 260 | get | `zarah_settings_v1` | Lee info de la tienda. |
| 263 | set | `zarah_settings_v1` | Guarda info de la tienda. |
| 286 | get | `zarah_password_v1` | Lee contraseña actual (fallback a `ADMIN_PASSWORD`). |
| 301 | set | `zarah_password_v1` | Guarda contraseña nueva. |
| 328 | remove | `zarah_products_v1` | Reset del catálogo a los datos iniciales. |
| 337 | get | `zarah_password_v1` | Verifica contraseña al loguear. |

### Lectura cruzada entre pestañas

`products-app.js` (línea 386) escucha el evento `storage` del navegador. Esto le permite **refrescar el catálogo automáticamente** cuando el admin lo edita en otra pestaña del mismo navegador. Esta capacidad se mantendrá (e incluso mejorará entre dispositivos) con la suscripción realtime de Supabase.

---

## Flujos principales del sitio

### Flujo 1: Cliente entra a Productos.html y ve el catálogo

1. El navegador descarga `Productos.html` (catálogo viene vacío).
2. Carga `products-data.js` (deja `INITIAL_PRODUCTS`, `CATEGORIES`, `ADMIN_PASSWORD` en memoria).
3. Carga `products-app.js` y queda dormido hasta el evento `DOMContentLoaded`.
4. Al despertar, `loadProducts()` busca `zarah_products_v1` en localStorage.
   - Si existe: usa esa lista guardada (puede ser una versión editada por el admin).
   - Si no: copia los productos iniciales del archivo.
   - En ambos casos pasa por `migrateProducts()` para arreglar formatos viejos.
5. `renderChips()` dibuja los botones de categorías arriba.
6. `getFiltered()` filtra y ordena la lista (al inicio todo, sin orden particular).
7. `render()` dibuja las primeras 12 cards en el `<main id="catalog">`.
8. `renderPagination()` agrega botones de página al final.
9. `updateCartBadge()` lee `zarah_cart_v1` y pone el numerito si hay items.
10. Se registra el `addEventListener("storage", ...)` para escuchar cambios desde otras pestañas.

### Flujo 2: Admin edita un producto y se guarda automáticamente

1. El admin hace click en una celda editable (nombre, precio, etc.).
2. Escribe y sale de la celda (Tab, click fuera, Enter).
3. Se dispara el evento `blur` que el código escucha por delegación.
4. El código identifica el ID del producto (de la fila) y el campo (de la celda).
5. Valida el dato (precios numéricos, precio antes mayor al actual, etc.).
6. Actualiza el producto en la variable `state.products`.
7. `saveProducts()` convierte el array completo a JSON y lo guarda en `zarah_products_v1`.
8. Re-dibuja la tabla y los stats.
9. Si la tienda pública está abierta en otra pestaña, su listener de `storage` detecta el cambio y refresca el catálogo solo.

**Nota:** no hay botón "Guardar". Cada salida de celda es un autoguardado.

### Flujo 3: Login del admin

1. Al abrir `admin.html`, el código verifica `sessionStorage["zarah_admin_session"]`.
2. Si vale `"ok"`: muestra el panel directamente.
3. Si no: muestra la pantalla de login.
4. El admin escribe la contraseña y da Enter o click en "Entrar".
5. `tryLogin()` busca la contraseña esperada:
   - Primero en `localStorage["zarah_password_v1"]` (si el admin la cambió).
   - Si no existe, usa `window.ADMIN_PASSWORD` de `products-data.js`.
6. Compara con texto plano (`pw === expected`).
7. Si coincide: guarda `sessionStorage["zarah_admin_session"] = "ok"` y muestra el panel.
8. Si no: muestra "Contraseña incorrecta".

**Vulnerabilidades a tener en cuenta:**

- La contraseña por defecto está en texto plano en un JS público (cualquiera puede verla en DevTools).
- El "login" es solo una pantalla que se oculta: alguien con conocimiento de JS puede saltarlo desde DevTools forzando el `sessionStorage`.
- `sessionStorage` se borra al cerrar todas las pestañas del sitio.

### Flujo 4: Cliente arma carrito y reserva por WhatsApp

**Parte A - Armar el carrito:**

1. El cliente clickea una card. Se abre el modal del producto.
2. (Opcional) llena el nombre personalizado y la dedicatoria. Hay validación en vivo (25 caracteres / 100 palabras).
3. Click en "Añadir al carrito".
4. `addToCart()` lee `zarah_cart_v1`, decide si suma cantidad o añade como item nuevo:
   - Si el producto ya está y **sin personalización**: suma 1 a la cantidad.
   - Si hay personalización: añade como item separado (dos rosas con dedicatorias distintas son dos items).
5. Guarda el carrito y actualiza el badge.

**Parte B - Reservar por WhatsApp:**

6. Click en el icono del carrito del nav. Se abre el panel lateral.
7. `renderCart()` dibuja cada item con: foto, nombre, precio, personalización, controles +/-, botón Quitar.
8. Calcula el total sumando `precio * cantidad`.
9. Construye un mensaje de WhatsApp estructurado con saludo, lista numerada de productos (con cantidad, subtotal y personalización), separador, total y despedida.
10. Codifica el mensaje con `encodeURIComponent` para que sea URL-safe.
11. Asigna el enlace `https://wa.me/51994684237?text=...` al botón "Reservar por WhatsApp".
12. El cliente clickea, se abre WhatsApp Web o la app con el chat pre-escrito.
13. El carrito **no se vacía automáticamente**: sigue en localStorage hasta que el cliente lo limpie.

**Nota:** el sitio nunca habla con WhatsApp ni con un servidor. La coordinación final pasa manualmente en el chat con Zarah.

### Flujo 5: Admin sube foto nueva

1. El admin clickea el thumbnail de una fila. Se abre el modal "Cambiar imagen" con dos pestañas.

**Camino A - Subir archivo:**

2. Click en la zona grande o arrastrar imagen.
3. El navegador valida que el archivo sea de tipo `image/*`.
4. Un `FileReader` lo lee como **data URL** (texto base64 que representa toda la imagen).
5. Muestra previsualización.
6. Guarda el base64 en `window.__pendingImage` (cajón temporal).
7. Click "Guardar": asigna `p.img = data:image/...;base64,...` y llama `saveProducts()`.

**Camino B - Desde URL:**

8. Pega un enlace (Unsplash, Imgur, etc.).
9. Click "Guardar": asigna `p.img = "https://..."` y llama `saveProducts()`.

**Después:**

10. Si la tienda pública está en otra pestaña, se refresca por evento `storage`.

**Problemas graves de este sistema:**

- Una foto de 1 MB pesa ~1.3 MB en base64.
- localStorage tiene tope ~5-10 MB. Con 5-7 fotos subidas, se llena.
- `saveProducts()` re-guarda todo el catálogo cada vez (incluyendo todas las imágenes base64). Si tienes 20 productos con 3 MB en base64, cada cambio de nombre re-escribe 60 MB.
- Las fotos subidas solo existen en ese navegador (no son URLs públicas).

---

## Hoja de ruta para migrar a Supabase

### Antes de empezar a tocar código

1. **Consolidar el repo.** Decidir qué versión de cada archivo es la buena (raíz vs. uploads/) y eliminar la otra. Hoy hay duplicados que confunden.
2. **Hacer backup de los datos actuales.** Usar el botón "Exportar respaldo" del admin (función `exportBackup` en `admin-app.js:309`) para descargar un JSON con productos, ventas, clientes y ajustes.
3. **Crear el proyecto en Supabase** y guardar las credenciales (URL del proyecto y `anon key` pública) en un archivo de configuración separado.
4. **Diseñar el esquema de tablas** antes de tocar código (ver apéndice).

### Orden recomendado de migración

Migrar por dominios, no por archivos. Cada dominio: crear tabla, escribir las funciones de lectura/escritura, reemplazar las llamadas a localStorage.

1. **Productos** — la tabla más usada, conviene empezar acá.
   - Reemplazar `loadProducts` y `saveProducts` en `products-app.js` y `admin-app.js`.
   - Migrar las imágenes a Supabase Storage (clave: `openImageModal` → subir el archivo a Storage en vez de guardar base64).
2. **Carrito y favoritos** — decisión de diseño:
   - **Opción A:** dejarlos en localStorage (es estado temporal por navegador).
   - **Opción B:** migrarlos a Supabase si querés que el cliente acceda desde otro dispositivo (requiere login del cliente).
   - Recomendado: empezar con A, evaluar B después.
3. **Autenticación del admin** — reemplazar el sistema actual (contraseña en texto plano + sessionStorage) por **Supabase Auth**.
   - Eliminar `window.ADMIN_PASSWORD` de `products-data.js`.
   - Eliminar las claves `zarah_password_v1` y `zarah_admin_session`.
   - Crear un usuario admin en Supabase Auth con email + contraseña real.
4. **Ajustes (settings, theme, accent)** — tabla `store_settings` con un solo registro.
5. **Ventas** — tabla `sales`. Adicionalmente, considerar que cuando un cliente reserve por WhatsApp se cree un registro pendiente automáticamente.
6. **Clientes** — tabla `clients`. Puede llenarse automáticamente cuando un cliente reserve y proporcione datos.

### Lista concreta de cosas a reemplazar

#### En el código

- [ ] Sustituir cada `localStorage.getItem` y `setItem` por llamadas al cliente de Supabase.
- [ ] Crear un módulo `db.js` (o similar) que encapsule todas las operaciones de base de datos, para no esparcir las llamadas a Supabase por todo el código.
- [ ] Reemplazar `loadProducts/saveProducts` por funciones async (con `await`).
- [ ] Cambiar la subida de imágenes de base64 a upload de Supabase Storage.
- [ ] Reemplazar el login del admin por Supabase Auth.
- [ ] Sustituir el evento `storage` por la suscripción realtime de Supabase para sincronización entre dispositivos (no solo entre pestañas).
- [ ] Quitar `window.ADMIN_PASSWORD` de `products-data.js`.
- [ ] Considerar quitar `INITIAL_PRODUCTS` de `products-data.js` (deberían vivir en la tabla, no en código).

#### Tareas de infraestructura

- [ ] Crear cuenta Supabase y proyecto.
- [ ] Definir esquema de tablas con políticas RLS (Row Level Security) — al menos: lectura pública para productos, escritura solo para admin autenticado.
- [ ] Subir las imágenes de productos actuales a Supabase Storage.
- [ ] Configurar variables de entorno (URL y anon key) sin hardcodearlas en el JS.
- [ ] Si se publica el sitio, asegurarse de NO subir la `service_role` key (solo la `anon`).

#### Decisiones de producto pendientes

- [ ] ¿Carrito y favoritos en localStorage o en Supabase?
- [ ] ¿El cliente va a tener cuenta o sigue siendo invitado?
- [ ] ¿Las reservas por WhatsApp generan un registro automático en `sales`?
- [ ] ¿La dueña va a tener un solo usuario admin o varios (con roles)?

---

## Apéndice: mapeo claves de localStorage a tablas Supabase

Propuesta inicial de esquema. Ajustar antes de implementar.

### Tabla `products` (reemplaza `zarah_products_v1`)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text (PK) | Mantener el formato actual (`p1`, `p2`, ...) o migrar a `uuid`. |
| `name` | text | |
| `price` | numeric | |
| `old_price` | numeric (nullable) | Si está presente, hay oferta. |
| `badge` | text (nullable) | "Oferta", "Nuevo", etc. |
| `img_url` | text | URL de Supabase Storage. |
| `features` | text[] | Array de bullets. |
| `cats` | text[] | Array de IDs de categorías. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** SELECT público; INSERT/UPDATE/DELETE solo para admin autenticado.

### Tabla `categories` (reemplaza `window.CATEGORIES`)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text (PK) | `detalles`, `equipos`, etc. |
| `label` | text | Nombre visible. |
| `position` | integer | Para ordenar los chips. |

### Tabla `sales` (reemplaza `zarah_sales_v1`)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | |
| `created_at` | timestamptz | |
| `summary` | text | Descripción del pedido. |
| `total` | numeric | |
| `customer_name` | text (nullable) | |
| `status` | text | `pending`, `done`, `cancelled`. |
| `items` | jsonb | Array de items del carrito. |

### Tabla `clients` (reemplaza `zarah_clients_v1`)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | text | |
| `phone` | text | Con código de país, solo dígitos. |
| `notes` | text (nullable) | |
| `created_at` | timestamptz | |

### Tabla `store_settings` (reemplaza `zarah_settings_v1`, `zarah_theme_v1`, `zarah_accent_v1`)

Tabla de un solo registro (singleton).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | integer (PK) | Siempre `1`. |
| `store_name` | text | |
| `whatsapp` | text | |
| `hours` | text | |
| `area` | text | |
| `theme` | text | `light`, `dark`, `pink`. |
| `accent_color` | text | Hex (`#c75a87`). |

### Bucket de Storage `productos`

- Acceso público de lectura.
- Escritura solo para admin autenticado.
- Path: `productos/{product_id}.jpg` (o similar).

### Claves que NO se migran

- `zarah_cart_v1` — recomendado dejar en localStorage (estado temporal por navegador).
- `zarah_fav_v1` — recomendado dejar en localStorage (igual razón).
- `zarah_password_v1` — eliminar, reemplazar por Supabase Auth.
- `zarah_admin_session` — eliminar, reemplazar por sesión de Supabase Auth.

### Autenticación

- Crear usuario admin en Supabase Auth (email + contraseña real, encriptada en el servidor).
- Reemplazar `tryLogin()` por `supabase.auth.signInWithPassword({ email, password })`.
- Reemplazar la verificación `isAuth()` por `supabase.auth.getSession()`.
- Reemplazar `setAuth(false)` por `supabase.auth.signOut()`.

---

## Notas finales

- Trabajar en la branch `migracion-supabase` y solo mergear a `main` cuando un dominio esté completo y probado.
- Mantener este archivo actualizado durante la migración (sobre todo el inventario de localStorage, marcando lo migrado).
- Después de migrar todo, eliminar `migrateProducts()` y `CAT_MIGRATE`: ya no harán falta porque el formato vivirá en la base de datos.
