import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Configuración de conexión para la aplicación (PostgreSQL/Supabase)
// Requiere DATABASE_URL en el archivo .env
const needsSSL = process.env.DATABASE_URL?.includes('supabase.co') || process.env.DB_SSL === 'true';

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: needsSSL ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {},
  logging: false, // Cambiar a console.log para ver las consultas SQL
});

export { sequelize };
