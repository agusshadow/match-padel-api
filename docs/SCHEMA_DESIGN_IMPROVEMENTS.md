# Análisis de Diseño de Esquema - Match Padel API

Este análisis complementa las mejoras técnicas previas, enfocándose en la **arquitectura de datos** y la **escalabilidad**.

---

## 1. Arquitectura de Participantes (`Match Players`)
**Estado Actual:** La tabla `matches` define jugadores en columnas fijas (`team1Player1Id`, `team1Player2Id`, etc.).
**Problema:** Consultar los partidos de un usuario requiere buscar en 4 columnas (`OR`), lo que invalida el uso eficiente de índices simples. Además, no soporta partidos de 1vs1 o formatos alternativos de forma elegante.

**Recomendación:** Mover los jugadores a una tabla `match_participants`.
```sql
CREATE TABLE match_participants (
  match_id bigint REFERENCES matches(id),
  user_id bigint REFERENCES users(id),
  team integer CHECK (team IN (1, 2)),
  position text, -- 'left', 'right', 'single'
  PRIMARY KEY (match_id, user_id)
);
```
*   **Ventaja:** Un solo índice en `user_id` permite obtener todos los partidos de un jugador instantáneamente.

---

## 2. Prevención de Overbooking (Exclusion Constraints)
**Estado Actual:** La disponibilidad se gestiona mediante la lógica de la aplicación comparando `slotId` y fechas.
**Problema:** Existe un riesgo de condiciones de carrera (*race conditions*) donde dos usuarios reservan el mismo slot simultáneamente.

**Recomendación:** Utilizar rangos de tiempo de Postgres (`tstzrange`).
```sql
-- Ejemplo conceptual de restricción
ALTER TABLE court_reservations 
ADD CONSTRAINT no_overlapping_reservations 
EXCLUDE USING gist (court_id WITH =, tsrange(scheduled_date_time, end_date_time) WITH &&)
WHERE (status != 'cancelled');
```
*   **Ventaja:** El motor de la base de datos garantiza físicamente que no haya solapamientos, haciendo el sistema 100% fiable.

---

## 3. Normalización de Marcadores (`Scores`)
**Estado Actual:** `match_scores` guarda el ganador como un entero manual.
**Problema:** No hay garantía de que el `winnerTeam` sea consistente con los sets registrados en `match_score_sets`.

**Recomendación:** 
1.  Calcular el ganador mediante una **Vista Materializada** o una **Generated Column** si la lógica es simple.
2.  Añadir una columna `match_type` en `matches` (ej. 'best_of_3', 'pro_set') para validar que el número de sets en `match_score_sets` sea correcto según el tipo de partido.

---

## 4. Historial de Desempeño y N+1
**Estado Actual:** Las estadísticas de usuario (partidos ganados/perdidos) probablemente se calculan en tiempo real contando registros.
**Problema:** A medida que la base de usuarios crezca, contar miles de filas por cada perfil de usuario será costoso.

**Recomendación:** Implementar **Counter Cache** o **Tablas de Agregación**.
*   Crear una tabla `user_stats` que se actualice mediante un `Trigger` cada vez que un partido pase a estado `completed`.
*   Esto permite que el perfil del usuario cargue instantáneamente.

---

## 5. Auditoría de Seguridad y RLS
**Recomendación:** Dado que Match Padel maneja datos personales y reservas de dinero/crédito.
*   Habilitar `audit logging` mediante una tabla genérica que registre cambios en tablas críticas (`court_reservations`, `match_scores`).
*   Usar `Row Level Security` (RLS) para asegurar que un usuario solo pueda ver sus propias notificaciones y reservas, incluso si hay un bug en el código de la API.
