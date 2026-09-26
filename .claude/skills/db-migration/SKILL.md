---
name: db-migration
description: Steps to change the database schema safely in match-padel-api - apply to dev only, update docs/schema.sql, verify RLS and advisors, document the production SQL.
---

# Migración de base de datos

Solo la ejecuta el agente `db-agent`.

1. **Proyecto:** dev (`gyjsdgjaufvoqpfceuhu`). Nunca producción (`ebdnlrwzhthqflsbdzvu`).
2. Inspeccioná el estado actual con `list_tables` antes de cambiar nada.
3. Escribí la migración, idempotente cuando se pueda, con nombre descriptivo.
4. Tabla nueva: **RLS activado + policies**. Extensiones requeridas declaradas (`btree_gist`, `uuid-ossp`, etc.).
5. Aplicá en dev con `apply_migration`.
6. Corré `get_advisors` (seguridad) y resolvé los avisos.
7. Actualizá `docs/schema.sql` para que reproduzca el schema entero desde cero.
8. Si cambian tipos que consume el frontend, avisá para regenerarlos (`packages/types` en `match-padel-web`).
9. Dejá documentado en el PR el SQL exacto que hay que correr en producción y en qué orden respecto del deploy. **No lo corras.**
10. Cambios destructivos: aclaralos explícitamente antes de aplicarlos.
