# Propuesta de Mejoras de Base de Datos - Match Padel API

Este documento detalla las sugerencias de optimización para la base de datos de Match Padel API, basadas en las mejores prácticas de **Supabase** y **PostgreSQL**.

---

## 1. Estrategia de Identificadores y Claves Primarias
**Impacto: ALTO**

### Recomendación: Cambiar a `BIGINT` con `IDENTITY`
Actualmente, las tablas utilizan `Sequelize.INTEGER` con `autoIncrement`. En PostgreSQL, el tipo `INTEGER` tiene un límite de ~2.1 mil millones, lo cual podría ser insuficiente para tablas de alta rotación como `court_reservations` o `notifications`.

*   **Sugerencia:** Utilizar `BIGINT` para todas las claves primarias y foráneas.
*   **Sugerencia:** Usar `GENERATED ALWAYS AS IDENTITY` (estándar SQL) en lugar del tipo `SERIAL` heredado.

```sql
-- Ejemplo en migración manual o SQL directo
id bigint generated always as identity primary key
```

---

## 2. Convenciones de Nomenclatura (Naming)
**Impacto: MEDIO**

### Recomendación: Adoptar `snake_case` para Identificadores
PostgreSQL convierte automáticamente todos los identificadores sin comillas a minúsculas. El uso de `camelCase` en columnas (ej. `reservationId`, `team1Player1Id`) obliga a usar comillas dobles (`"reservationId"`) en todas las consultas SQL directas, lo que dificulta el uso de herramientas de análisis, BI y el editor de SQL de Supabase.

*   **Sugerencia:** Renombrar columnas de `camelCase` a `snake_case` (ej. `reservation_id`, `created_by`, `team1_player1_id`).
*   **Sequelize Tip:** Puedes configurar Sequelize para que use `snake_case` en la base de datos manteniendo `camelCase` en el código JS usando el atributo `field` en el modelo o la opción `underscored: true`.

---

## 3. Tipos de Datos Optimizados
**Impacto: ALTO**

### Recomendación: Preferir `TEXT` sobre `VARCHAR(255)`
En PostgreSQL, no hay penalización de rendimiento por usar `TEXT` en comparación con `VARCHAR(n)`. El uso de `VARCHAR(255)` es una limitación arbitraria heredada de otros motores de DB.

*   **Sugerencia:** Cambiar `Sequelize.STRING` (VARCHAR(255)) por `Sequelize.TEXT` para correos, nombres y descripciones.

### Recomendación: Usar `TIMESTAMPTZ` para Fechas
Actualmente se usa `Sequelize.DATE`, que por defecto crea columnas `TIMESTAMP WITHOUT TIME ZONE`. Esto puede causar problemas de inconsistencia cuando el servidor y el cliente están en zonas horarias diferentes.

*   **Sugerencia:** Asegurarse de que todas las columnas de tiempo usen `TIMESTAMP WITH TIME ZONE` (`TIMESTAMPTZ`).

---

## 4. Índices y Rendimiento
**Impacto: ALTO**

### Recomendación: Índices Parciales
Para tablas con estados (como `court_reservations` o `court_slots`), los índices parciales pueden reducir drásticamente el tamaño del índice y mejorar la velocidad de búsqueda.

*   **Sugerencia:** Crear un índice parcial para turnos disponibles:
```sql
CREATE INDEX idx_court_slots_available ON court_slots (court_id, start_time) 
WHERE is_available = true;
```

### Recomendación: Índices en Claves Foráneas
He notado que muchas tablas ya tienen índices en FKs (ej. `matches`), lo cual es excelente. Asegúrate de que **todas** las relaciones tengan un índice para evitar *sequential scans* durante los JOINs.

---

## 5. Integridad de Datos y Restricciones (Constraints)
**Impacto: MEDIO**

### Recomendación: Check Constraints
Para campos como habilidades de usuario (`skillServe`, `skillSmash`, etc.) en `user_profiles`, que parecen ser enteros, se deben añadir restricciones para asegurar que los valores estén en un rango válido (ej. 0-100).

```sql
-- Ejemplo SQL
ALTER TABLE user_profiles ADD CONSTRAINT check_skill_serve RANGE (skill_serve >= 0 AND skill_serve <= 100);
```

---

## 6. Seguridad: Row Level Security (RLS)
**Impacto: CRÍTICO (si se usa Supabase directamente)**

Si planeas consumir la base de datos desde el frontend usando el cliente de Supabase (y no solo a través de esta API de Node.js), es obligatorio activar RLS.

*   **Sugerencia:** Habilitar RLS en todas las tablas y definir políticas basadas en `auth.uid()`.
*   **Defensa en Profundidad:** Incluso si usas una API, RLS añade una capa extra de seguridad contra errores en el código del backend o inyecciones.

---

## Resumen de Próximos Pasos Sugeridos

1.  **Migración de Nombres:** Configurar `underscored: true` en los modelos de Sequelize.
2.  **Auditoría de Tipos:** Cambiar `INTEGER` por `BIGINT` en las migraciones de claves.
3.  **Refuerzo de Esquema:** Añadir `CHECK CONSTRAINTS` para validación a nivel de motor de DB.
4.  **Optimización de Búsqueda:** Implementar índices parciales en columnas booleanas de disponibilidad.
