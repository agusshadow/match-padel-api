import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Función para parsear DATABASE_URL y crear configuración de conexión
function getDatabaseConfig() {
  // Si hay DATABASE_URL, parsearla y extraer componentes
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      const isSupabase = url.hostname.includes('supabase.co') || url.hostname.includes('pooler.supabase.com');
      
      return {
        database: url.pathname.slice(1) || 'postgres',
        username: url.username || 'postgres',
        password: url.password || '',
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        dialect: 'postgres',
        dialectOptions: {
          ssl: (isSupabase || url.searchParams.get('sslmode') === 'require') ? {
            require: true,
            rejectUnauthorized: false
          } : false
        },
        logging: false
      };
    } catch (error) {
      console.error('Error parsing DATABASE_URL:', error.message);
      throw new Error(`DATABASE_URL inválida: ${error.message}`);
    }
  }
  
  // Si no hay DATABASE_URL, usar variables individuales
  const isSupabase = process.env.DB_HOST?.includes('supabase.co') || process.env.DB_HOST?.includes('pooler.supabase.com');
  return {
    database: process.env.DB_NAME || 'match_padel',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: (isSupabase || process.env.DB_SSL === 'true') ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    logging: false
  };
}

// Crear instancia de Sequelize con configuración parseada
const dbConfig = getDatabaseConfig();
const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: dbConfig.dialect,
  dialectOptions: dbConfig.dialectOptions,
  logging: dbConfig.logging
});

export { sequelize };
