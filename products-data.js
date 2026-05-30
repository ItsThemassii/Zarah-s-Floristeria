/* Products data — initial state. Persisted/edited via localStorage.
   Cada producto puede pertenecer a varias categorías (cats: array). */
window.INITIAL_PRODUCTS = [
  { id: "p1",  name: "Mural Globos Toda Ocasión",   cats: ["detalles", "cumple"],           price: 130, oldPrice: 150, badge: "Oferta",
    img: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=700&q=80" },
  { id: "p2",  name: "Centro de Mesa Escarchado",   cats: ["detalles"],                     price: 85,
    img: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=700&q=80" },
  { id: "p3",  name: "Mural Numbers Quince",        cats: ["detalles", "cumple"],           price: 169,
    img: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=700&q=80" },
  { id: "p4",  name: "Decoración Globos con Helio", cats: ["equipos", "cumple"],            price: 480,
    img: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=700&q=80" },
  { id: "p5",  name: "Mural Deluxe I Love You",     cats: ["detalles", "amor"],             price: 169,
    img: "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=700&q=80" },
  { id: "p6",  name: "Mural Arcoíris Colorido",     cats: ["detalles", "ninos"],            price: 149,
    img: "https://images.unsplash.com/photo-1530092285049-1c42085fd395?w=700&q=80" },
  { id: "p7",  name: "Mural Numbers Especial",      cats: ["detalles", "cumple"],           price: 225,
    img: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=700&q=80" },
  { id: "p8",  name: "Arco Clásico Estándar",       cats: ["equipos"],                      price: 85,
    img: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=700&q=80" },
  { id: "p9",  name: "Parante Grande Graduación",   cats: ["equipos", "graduacion"],        price: 195,
    img: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=700&q=80" },
  { id: "p10", name: "Mural HB Rose Gold",          cats: ["detalles", "cumple"],           price: 175,
    img: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=700&q=80" },
  { id: "p11", name: "Mural HB Especial Azul",      cats: ["detalles", "cumple"],           price: 325,
    img: "https://images.unsplash.com/photo-1525013066836-c6090f0ad9d8?w=700&q=80" },
  { id: "p12", name: "Mural Number Especial",       cats: ["detalles", "cumple"],           price: 215, oldPrice: 245, badge: "Oferta",
    img: "https://images.unsplash.com/photo-1612392061787-2d078b3e573a?w=700&q=80" },
  { id: "p13", name: "Caja Sorpresa Premium",       cats: ["cajas", "amor"],                price: 95,
    img: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=700&q=80" },
  { id: "p14", name: "Ramo Aurora Pastel",          cats: ["flores", "amor"],               price: 72,
    img: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=700&q=80" },
  { id: "p15", name: "Rosas de Bohemia",            cats: ["flores", "amor"],               price: 58,
    img: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=700&q=80" },
  { id: "p16", name: "Tulipanes Coral",             cats: ["flores", "amor", "cumple"],     price: 64,
    img: "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=700&q=80" }
];

window.CATEGORIES = [
  { id: "all",        label: "Todos" },
  { id: "detalles",   label: "Detalles" },
  { id: "equipos",    label: "Equipos" },
  { id: "globo-pers", label: "Globo Personalizado" },
  { id: "cumple",     label: "Cumpleaños" },
  { id: "amor",       label: "Amor" },
  { id: "flores",     label: "Flores" },
  { id: "graduacion", label: "Graduación" },
  { id: "cajas",      label: "Cajas regalo" },
  { id: "ninos",      label: "Niños" }
];
