# 🚀 Guía de Despliegue en Render

## 📋 Pasos para Desplegar en Render

### 1. Preparar el Repositorio

Asegúrate de que tu código esté en GitHub/GitLab/Bitbucket y que todas las migraciones estén corregidas.

### 2. Crear un Nuevo Servicio Web en Render

1. Ve a [render.com](https://render.com) y crea una cuenta (si no tienes)
2. Haz clic en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub
4. Selecciona el repositorio `match-padel-api`

### 3. Configurar el Servicio

**Configuración básica:**
- **Name:** `match-padel-api` (o el nombre que prefieras)
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Plan:** `Free` (o el plan que prefieras)

### 4. Variables de Entorno en Render

Ve a **Environment** en la configuración del servicio y agrega estas variables:

```env
# Servidor
NODE_ENV=production
PORT=10000

# JWT
JWT_SECRET=tu_jwt_secret_muy_seguro_aqui_cambiar
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Base de datos PostgreSQL (Supabase)
# ⚠️ IMPORTANTE: Render NO soporta IPv6 de Supabase
# Usa la connection string de "Transaction mode" de Supabase (Settings → Database → Connection string → Transaction mode)
# Formato del pooler: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
# Ejemplo: postgresql://postgres.abcdefghijklmnop:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[TU_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Frontend (URL de Vercel donde está tu frontend)
FRONTEND_URL=https://tu-frontend.vercel.app

# Base de datos adicional (opcional, si no usas DATABASE_URL)
DB_SSL=true
```

**⚠️ IMPORTANTE:**
- Reemplaza `[TU_PASSWORD]` con tu contraseña real de Supabase
- Cambia `JWT_SECRET` por un valor seguro y aleatorio
- Cambia `FRONTEND_URL` por la URL de tu frontend en Vercel

### 5. Ejecutar Migraciones en Render

Render no ejecuta migraciones automáticamente. Tienes dos opciones:

#### Opción A: Ejecutar migraciones manualmente (Recomendado)

1. Una vez que el servicio esté desplegado, ve a **Shell** en Render
2. Ejecuta:
```bash
npm run db:migrate
```

#### Opción B: Agregar migraciones al build (Alternativa)

Puedes modificar el **Build Command** en Render a:
```bash
npm install && npm run db:migrate
```

**Nota:** Esto ejecutará las migraciones en cada deploy. Úsalo solo si quieres que se ejecuten automáticamente.

### 6. Verificar el Despliegue

1. Una vez desplegado, Render te dará una URL como: `https://match-padel-api.onrender.com`
2. Prueba el endpoint de health:
```bash
curl https://tu-app.onrender.com/api/health
```

### 7. Configurar Auto-Deploy

En Render, asegúrate de que **Auto-Deploy** esté habilitado para que se despliegue automáticamente cuando hagas push a tu rama principal.

## 🔧 Configuración Adicional

### Health Check Endpoint

Asegúrate de tener un endpoint de health check. Si no lo tienes, Render lo necesita para saber que tu app está funcionando.

### Logs

Puedes ver los logs en tiempo real en Render:
- Ve a tu servicio → **Logs**
- Ahí verás todos los console.log y errores

### Variables de Entorno Sensibles

Render permite marcar variables como **Secret** para mayor seguridad. Marca `JWT_SECRET` y `DATABASE_URL` como secretas.

## ⚠️ Limitaciones del Plan Gratuito

- **Sleep después de 15 minutos de inactividad**: El servicio se "duerme" y tarda ~30-60 segundos en despertar
- **Recursos limitados**: 512MB RAM, 0.5 CPU
- **Build time limitado**: 10 minutos máximo

## 🐛 Troubleshooting

### Error: "Cannot connect to database" o "ENETUNREACH"

**⚠️ PROBLEMA CONOCIDO:** Supabase usa IPv6 y Render no lo soporta completamente

**✅ SOLUCIÓN:**

1. **Obtener la contraseña de la base de datos:**
   - Ve a tu proyecto en Supabase → **Settings** → **Database**
   - En la sección **"Database password"** (la que viste en la imagen)
   - Si no recuerdas la contraseña, haz clic en **"Reset database password"**
   - **IMPORTANTE:** Esta es la contraseña que debes usar en la connection string
   - Guarda esta contraseña de forma segura

2. **Obtener la Connection String correcta:**
   - En la misma página, busca la sección **"Connection string"** o **"Connection info"**
   - Si no la ves, busca en otra pestaña o sección de Database Settings
   - Deberías ver varias opciones:
     - **URI** (directo, usa IPv6 - no funciona con Render)
     - **Transaction mode** (pooler - ✅ usa este)
     - **Session mode** (pooler alternativo)
   - **USA la opción "Transaction mode"** - Esta es la que funciona mejor con Render
   - Copia la connection string completa
   - **Reemplaza `[YOUR-PASSWORD]` con la contraseña que obtuviste en el paso 1**

2. **Si no ves "Transaction mode":**
   - Ve a **Settings** → **Database** → Busca la sección de **Connection Pooling**
   - Asegúrate de usar el **pooler** en lugar de la conexión directa
   - El formato debería ser algo como: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
   - **NOTA:** El puerto es **6543** (pooler) en lugar de **5432** (directo)

3. **Configurar en Render:**
   - Ve a tu servicio en Render → **Environment**
   - Actualiza `DATABASE_URL` con la connection string de **Transaction mode**
   - Guarda y espera a que se redepliegue automáticamente

4. **Alternativa: Usar variables individuales (si Transaction mode no funciona):**
   Si la connection string no funciona, puedes usar variables separadas:
   ```env
   DB_HOST=aws-0-[REGION].pooler.supabase.com
   DB_PORT=6543
   DB_NAME=postgres
   DB_USER=postgres.[PROJECT_REF]
   DB_PASSWORD=tu_password
   DB_SSL=true
   ```
   (No uses `DATABASE_URL` si usas estas variables)

5. **Verificar firewall de Supabase:**
   - Ve a **Settings** → **Database** → **Connection Pooling**
   - Asegúrate de que no haya restricciones de IP que bloqueen Render
   - Si hay restricciones, desactívalas temporalmente o agrega las IPs de Render

### Error: "password authentication failed for user postgres"

**Problema:** La contraseña en `DATABASE_URL` es incorrecta

**Solución:**

1. **Obtener la contraseña correcta de Supabase:**
   - Ve a **Settings** → **Database** → **Database password**
   - Si no recuerdas la contraseña, haz clic en **"Reset database password"**
   - Copia la nueva contraseña (solo la verás una vez)

2. **Actualizar DATABASE_URL en Render:**
   - Ve a tu servicio en Render → **Environment**
   - Actualiza `DATABASE_URL` con la contraseña correcta
   - Formato: `postgresql://postgres.[PROJECT_REF]:[CONTRASEÑA_CORRECTA]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
   - **IMPORTANTE:** La contraseña debe ser exactamente la que aparece en Supabase
   - Si la contraseña tiene caracteres especiales, puede que necesites codificarla (URL encode)

3. **Si la contraseña tiene caracteres especiales:**
   - Caracteres que necesitan codificación: `@`, `#`, `$`, `%`, `&`, `+`, `/`, `:`, `=`, `?`
   - Ejemplo: `@` se convierte en `%40`
   - O mejor aún: cambia la contraseña en Supabase a una sin caracteres especiales

4. **Verificar la connection string:**
   - La connection string debería verse así:
   ```
   postgresql://postgres.fsyrlranrtkrnovmlvja:TU_CONTRASEÑA_AQUI@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
   - Reemplaza `TU_CONTRASEÑA_AQUI` con la contraseña real (sin espacios)

### Error: "Migrations failed"
- Ejecuta las migraciones manualmente desde el Shell de Render
- Verifica que `database.cjs` exista y esté correctamente configurado

### Error: "CORS error"
- Verifica que `FRONTEND_URL` esté configurada correctamente
- Asegúrate de que la URL no tenga `/` al final

### El servicio se "duerme"
- Es normal en el plan gratuito después de 15 min de inactividad
- Considera usar un servicio de ping para mantenerlo activo (opcional)

## 📝 Checklist Pre-Deploy

- [ ] Código en GitHub/GitLab
- [ ] Variables de entorno configuradas en Render
- [ ] `DATABASE_URL` correcta con contraseña real
- [ ] `JWT_SECRET` cambiado por uno seguro
- [ ] `FRONTEND_URL` configurada (URL de Vercel)
- [ ] Migraciones ejecutadas en Supabase
- [ ] Health check endpoint funcionando
- [ ] CORS configurado correctamente

## 🎉 ¡Listo!

Una vez completados estos pasos, tu API estará desplegada en Render y podrás conectarla con tu frontend en Vercel.

