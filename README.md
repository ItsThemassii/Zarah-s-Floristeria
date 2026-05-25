# 🌸 Zarah's Floristería

> Sitio web para Zarah's Floristería: catálogo de arreglos florales, globos y regalos personalizados, con panel administrativo privado para gestionar productos, precios, ofertas y categorías.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Responsive](https://img.shields.io/badge/Responsive-✓-c75a87?style=flat-square)

---

## ✨ Características principales

### 🌷 Para los clientes
- **Landing elegante** con hero animado, mosaico flotante de fotos reales, sección de dedicatoria con tarjeta 3D, contacto con mockup de WhatsApp.
- **Catálogo completo** (`Productos.html`) con:
  - Filtros por categoría (chips horizontales)
  - Ordenamiento (precio, nombre, ofertas)
  - Búsqueda en vivo
  - Paginación
- **Modal de producto** con:
  - Zoom de imagen que sigue al cursor
  - Galería de características en mayúsculas
  - Personalización (nombre + dedicatoria de hasta 150 caracteres)
  - Validación en tiempo real
- **Favoritos** persistentes en `localStorage`
- **Carrito completo** con cantidades, personalización por producto y total acumulado
- **Reserva por WhatsApp** con mensaje pre-armado profesional (saluda, lista productos con cantidades, dedicatoria y total)
- **Botón flotante de WhatsApp** en todas las páginas

### 🔐 Para el administrador
- **Panel privado** (`admin.html`) protegido por contraseña
- **4 secciones** funcionales:
  - 📦 **Productos** — edita fotos, nombres, precios, categorías múltiples, ofertas, características
  - 💰 **Ventas** — registro manual de pedidos con estados (pendiente/completada)
  - 👥 **Clientes** — libreta de contactos con WhatsApp directo
  - ⚙️ **Ajustes** — temas (claro/oscuro/rosa), 6 colores de marca, datos de la tienda, contraseña, backup `.json`
- Cada producto puede pertenecer a **múltiples categorías** simultáneamente
- **Sincronización automática** con la tienda pública (mismo `localStorage`)

### 📱 Responsive
Optimizado para desktop, tablet y móvil. Las 3 páginas conservan todas sus funciones en cualquier tamaño de pantalla, con menú hamburguesa, modales adaptados y sidebar admin transformado en barra superior.

---

## 📁 Estructura del proyecto

```
zarah-floristeria/
├── Landing.html              # Página principal
├── Productos.html            # Catálogo + carrito + favoritos
├── admin.html                # Panel administrativo
│
├── styles.css                # Estilos base + nav + hero
├── styles-2.css              # Categorías + productos del landing
├── contact.css               # Sección de contacto del landing
├── whatsapp.css              # Botón flotante de WhatsApp
├── productos.css             # Catálogo (grid, chips, paginación)
├── product-modal.css         # Modal de producto
├── nav-features.css          # Búsqueda, favoritos, carrito (Productos)
├── admin.css                 # Layout admin (sidebar, tabla, modales)
├── admin-views.css           # Vistas Ventas, Clientes, Ajustes + temas
├── mobile.css                # Breakpoints responsive (≤980px)
│
├── products-data.js          # Datos iniciales + categorías + password
├── products-app.js           # Lógica de la tienda pública
├── admin-app.js              # Lógica del panel admin
│
├── hero/                     # Fotos reales de productos
│   ├── gatito.jpg
│   ├── koala.jpg
│   ├── kitty.jpg
│   ├── conejo.jpg
│   ├── pooh.jpg
│   ├── ferrero.jpeg          # Caja de chocolates
│   └── vinos.png             # Vinos & cervezas
│
└── README.md
```

---

## 🚀 Cómo usar

### Acceso de clientes
Abre `Landing.html` en cualquier navegador moderno. No requiere servidor — funciona con doble click.

### Acceso de administrador
1. Abre `admin.html`
2. Ingresa la contraseña (por defecto: `zarah2025`)
3. Gestiona el catálogo desde el panel

> ⚠️ **Importante:** cambia la contraseña por defecto en `products-data.js` (última línea) **antes de publicar** el sitio.

---

## 🔐 Seguridad

Este proyecto guarda todos los datos en `localStorage` del navegador. Es ideal para una vitrina, demo o tienda pequeña.

**Para producción** se recomienda:

1. **Restringir el acceso a `admin.html` por IP** a nivel de servidor:
   - **Nginx:** `allow / deny` en el bloque `location /admin.html`
   - **Apache:** `.htaccess` con `Require ip x.x.x.x`
   - **Vercel / Netlify:** reglas de redirect/headers
   - **Cloudflare:** firewall rules

2. **Cambiar la contraseña de admin** en `products-data.js`:
   ```js
   window.ADMIN_PASSWORD = "tu-contraseña-segura";
   ```

3. **Para una base de datos real** (en lugar de localStorage), conectar con Supabase, Firebase, o un backend propio.

---

## 🎨 Personalización rápida

### Cambiar el número de WhatsApp
Reemplaza `51994684237` por tu número (con código de país) en:
- `Landing.html`
- `Productos.html`
- `products-app.js`

O cámbialo desde el panel admin → **Ajustes → Información de la tienda**.

### Cambiar el tema visual
Panel admin → **Ajustes → Tema de apariencia** ofrece 3 estilos (claro, oscuro, rosa pastel) y 6 colores de marca.

### Añadir productos
Panel admin → click **"+ Añadir producto"** → edita foto, nombre, categorías, precio y características.

---

## 💳 Métodos de pago

Coordinación 100% por **WhatsApp** con cliente.
Aceptamos **Yape**, **Plin** y **transferencia bancaria**.

---

## 📞 Contacto

- WhatsApp: **+51 994 684 237**
- Zona de entrega: **Callao y Lima**
- Horario: **Lun – Sáb · 9:00 a.m. – 6:00 p.m.**

---

## 📄 Licencia

Proyecto privado — uso exclusivo de Zarah's Floristería.

---

*Hecho con 🌸 cariño y mucho café.*
