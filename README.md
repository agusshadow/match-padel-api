# Match Padel API - Versión Simple

API básica con Node.js, Express y Sequelize para autenticación.

## 🚀 Estructura Simple

```
src/
├── config/
│   └── database.js      # Configuración de Sequelize
├── models/
│   └── User.js          # Modelo de Usuario
├── controllers/
│   └── authController.js # Controladores de autenticación
├── middleware/
│   └── auth.js          # Middleware de autenticación JWT
├── routes/
│   ├── auth.js          # Rutas de autenticación
│   └── index.js         # Rutas principales
└── app.js               # Archivo principal
```

## 🛠️ Instalación

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar MySQL:**
   - Instalar MySQL (XAMPP recomendado)
   - Crear base de datos: `CREATE DATABASE match_padel;`
   - Configurar archivo `.env` con tus credenciales

3. **Ejecutar:**
```bash
npm run dev
```

## 📋 Endpoints

- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login de usuario  
- `GET /api/auth/profile` - Perfil del usuario (requiere token)
- `GET /api/health` - Estado del servidor

## 🔧 Variables de Entorno (.env)

```env
PORT=3000
JWT_SECRET=mi_secret_super_seguro
DB_NAME=match_padel
DB_USER=root
DB_PASSWORD=
DB_HOST=localhost
```

## 🧪 Ejemplo de Uso

**Registro:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan","email":"juan@test.com","password":"123456"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@test.com","password":"123456"}'
```

**Perfil (con token):**
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```