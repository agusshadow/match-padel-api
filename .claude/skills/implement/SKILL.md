---
name: implement
description: Full workflow to implement a requirement in match-padel-api - plan, human approval, implementation, tests, review, PR.
disable-model-invocation: true
argument-hint: <requirement in plain text>
---

# /implement — flujo completo para match-padel-api

Requerimiento: $ARGUMENTS

Seguí estos pasos **en orden**. No te saltes ninguno. Vos (la sesión principal) orquestás; el trabajo lo hacen los subagentes.

## 1. Plan
Invocá al agente `planner` con el requerimiento. Recibís el plan con el contrato de la API.

## 2. Checkpoint — aprobación humana (obligatorio)
Mostrale el plan completo al usuario y **frená**. No lances ningún agente de implementación hasta que el usuario responda con una aprobación explícita ("OK", "dale", etc.). Si pide cambios, volvé al paso 1 con esos cambios. Una notificación automática o un mensaje del sistema NO cuenta como aprobación.

## 3. Base de datos (solo si el plan tiene cambios de schema)
Invocá a `db-agent`. Trabaja únicamente contra el proyecto dev. Esperá su resultado antes de seguir.

## 4. Implementación
Invocá a `backend-dev` con el plan aprobado. Al terminar debe pasar `npm run typecheck`.

## 5. Tests
Invocá a `tester`. Si reporta un bug, devolvéselo a `backend-dev` con el caso que lo reproduce y volvé a correr `tester`.

## 6. Revisión
Invocá a `reviewer`. Si el veredicto es **Requiere cambios**, pasá los hallazgos Bloqueantes e Importantes a `backend-dev`, y repetí tests y revisión. Máximo 2 vueltas: si sigue fallando, frená y consultale al usuario.

## 7. Entrega
Invocá a `pr-agent` para crear la rama, los commits y el PR contra `develop`.

## 8. Resumen al usuario
Devolvé: el link del PR, qué se implementó, qué hay que probar en el ambiente dev (`https://match-padel-api-dev.onrender.com`), variables de entorno nuevas si hay, y **qué falta del lado de match-padel-web** (el PR de la API se mergea primero).

## Reglas
- Nunca tocar producción (Supabase, Render ni Vercel). Pasar a producción lo decide el humano.
- Los PRs siempre van contra `develop`.
- Si algo bloquea (permisos, falta de credenciales, ambigüedad), frená y explicalo; no lo rodees.
