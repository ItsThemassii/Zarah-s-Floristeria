-- ============================================================
-- Zarah's Floristería — Valores iniciales de configuración
-- ============================================================
-- Inserta los ajustes base del sitio en la tabla `configuracion`.
-- Cada fila es un par (clave, valor).
-- Idempotente: si la clave ya existe, actualiza su valor.
-- Listo para pegar en el SQL Editor de Supabase.
-- ============================================================

insert into public.configuracion (clave, valor) values
    ('nombre_tienda', 'Zarah''s'),
    ('whatsapp',      '51994684237'),
    ('horario',      'Lun – Sáb · 9:00 a.m. – 6:00 p.m.'),
    ('area_entrega', 'Callao y Lima'),
    ('tema',         'light'),
    ('color_marca',  '#c75a87')
on conflict (clave) do update
    set valor = excluded.valor;
