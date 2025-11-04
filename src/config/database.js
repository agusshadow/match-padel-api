import dotenv from 'dotenv';

dotenv.config();

// Función para parsear connection string
function parseDatabaseUrl(url) {
  if (!url) {
    throw new Error('DATABASE_URL es requerida en el archivo .env');
  }
  
  try {
    const urlObj = new URL(url);
    return {
      username: urlObj.username,
      password: urlObj.password,
      database: urlObj.pathname.slice(1), // Remover el '/' inicial
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 5432,
      ssl: urlObj.hostname.includes('supabase.co') || process.env.DB_SSL === 'true'
    };
  } catch (error) {
    throw new Error(`DATABASE_URL inválida: ${error.message}`);
  }
}

// Parsear connection string
const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);

// Configuración para Sequelize CLI (PostgreSQL/Supabase)
// Requiere DATABASE_URL en el archivo .env
const config = {
  development: {
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    dialectOptions: dbConfig.ssl ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    logging: false
  },
  test: {
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database + '_test',
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    dialectOptions: dbConfig.ssl ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    logging: false
  },
  production: {
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    dialectOptions: dbConfig.ssl ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    logging: false
  }
};

export default config;