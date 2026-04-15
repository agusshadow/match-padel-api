# Plan de Implementación de Mejoras en Base de Datos (Backend)

## Objetivo
Implementar las mejoras arquitectónicas y de rendimiento sugeridas por las mejores prácticas de Supabase/PostgreSQL en la API de Match Padel. Dado que el proyecto está en fase de desarrollo, aplicaremos los cambios directamente modificando las migraciones, modelos y seeders existentes, seguido de un reinicio de la base de datos local.

## Alcance (Solo Backend)
Este plan cubre exclusivamente los cambios estructurales en el motor de base de datos (PostgreSQL), la capa ORM (Sequelize) y la lógica de negocio (Controladores y Servicios) dentro del repositorio `match-padel-api`.

---

## Fase 1: Estandarización y Rendimiento (Modificación de Migraciones y Modelos)
**Acciones:**
1.  **Convención Snake Case (`snake_case`):**
    *   Añadir la opción `underscored: true` en las definiciones de configuración de todos los modelos de Sequelize. Esto indicará a Sequelize que use `snake_case` en la BD y `camelCase` en el código JS.
    *   Actualizar todas las migraciones para que los nombres de tablas y columnas utilicen estrictamente `snake_case` (ej. `userId` -> `user_id`, `court_reservations` -> se mantiene, `scheduledDateTime` -> `scheduled_date_time`).
2.  **Escalabilidad de Identificadores:**
    *   Cambiar los tipos de las claves primarias (`id`) y claves foráneas de `Sequelize.INTEGER` a `Sequelize.BIGINT`.
    *   En las migraciones, configurar los IDs para usar `GENERATED ALWAYS AS IDENTITY` en lugar del tipo `SERIAL` tradicional.
3.  **Optimización de Tipos de Datos:**
    *   Sustituir `Sequelize.STRING` (que compila a `VARCHAR(255)`) por `Sequelize.TEXT` para correos, nombres, descripciones y notas.
    *   Asegurar que los campos de fecha utilicen explícitamente zonas horarias (`TIMESTAMPTZ`), mapeando correctamente el tipo `Sequelize.DATE`.
4.  **Integridad de Dominio e Índices:**
    *   Crear índices parciales en las migraciones para estados comunes (ej. un índice para `is_available = true` en `court_slots`).
    *   Añadir restricciones `CHECK` crudas en la migración de `user_profiles` para garantizar que habilidades como `skill_serve` estén en el rango de 0 a 100.

## Fase 2: Refactorización Estructural (Participantes y Overbooking)
**Acciones:**
1.  **Arquitectura de Jugadores (N:M):**
    *   Crear una nueva migración y modelo para `match_participants` que incluya las columnas: `match_id` (BIGINT), `user_id` (BIGINT), `team_number` (INTEGER, check 1 o 2) y `position` (TEXT).
    *   Eliminar las columnas estáticas de los jugadores (`team1_player1_id`, etc.) de la migración y el modelo `Match`.
2.  **Prevención de Overbooking a Nivel de Motor:**
    *   Modificar la migración de `court_reservations` para utilizar rangos de tiempo (`tstzrange`) o implementar un `EXCLUDE USING gist` nativo de PostgreSQL (vía `queryInterface.sequelize.query`) que impida físicamente que dos reservas confirmadas se solapen en la misma cancha.
3.  **Estructura de Marcadores:**
    *   Revisar la relación de `match_scores` para que dependa lógicamente de los equipos (1 o 2) en lugar de IDs fijos, y asegurar que la validación de sets ganados sea consistente.

## Fase 3: Adaptación de la Lógica de Negocio y Datos
**Acciones:**
1.  **Refactorización de Controladores y Servicios:**
    *   Actualizar `matchService.js` y `matchController.js` para crear registros en `match_participants` usando Transacciones de Sequelize al momento de crear un partido.
    *   Ajustar las consultas de búsqueda (ej. `findAll` de partidos) para incluir (`include`) la nueva tabla de participantes y formatear la salida para el cliente.
2.  **Actualización de Seeders:**
    *   Modificar todos los archivos en `/seeders/` para que coincidan con la nueva estructura de nombres (`snake_case`) e inserten los datos relacionales de jugadores en `match_participants` en lugar de la tabla de partidos.
3.  **Ajuste de Validaciones:**
    *   Reescribir las reglas en `utils/matchValidations.js` para que operen sobre el array de participantes y soporten la nueva lógica de equipos.

## Fase 4: Pruebas y Despliegue Local
**Acciones:**
1.  Ejecutar el reseteo completo de la base de datos (drop, re-creación de tablas, migraciones y seeders).
    ```bash
    npm run db:reset # o el comando equivalente (npx sequelize-cli db:migrate:undo:all, etc.)
    ```
2.  Verificar manualmente que los endpoints principales (`/matches`, `/reservations`, `/users`) respondan correctamente con los datos estructurados.
3.  Confirmar que las restricciones de base de datos (`CHECK`, `EXCLUDE`) funcionen intentando insertar datos inválidos de forma intencional.
