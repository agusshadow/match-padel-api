require('dotenv').config();

// Función para parsear DATABASE_URL si existe
function parseDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      // Supabase siempre requiere SSL, así que forzamos SSL si es un host de Supabase
      const isSupabase = url.hostname.includes('supabase.co');
      const requiresSSL = url.searchParams.get('sslmode') === 'require' || isSupabase;
      
      return {
        username: url.username || 'postgres',
        password: url.password || '',
        database: url.pathname.slice(1) || 'postgres', // Remover el '/' inicial
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        ssl: requiresSSL
      };
    } catch (error) {
      console.error('Error parsing DATABASE_URL:', error.message);
      return null;
    }
  }
  return null;
}

// Parsear DATABASE_URL o usar variables individuales
const dbConfig = parseDatabaseUrl() || {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'match_padel',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.DB_SSL === 'true'
};

// Configuración para Sequelize CLI
const config = {
  development: {
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: dbConfig.ssl ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  },
  test: {
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database + '_test',
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: dbConfig.ssl ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  },
  production: {
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: dbConfig.ssl ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
};

module.exports = config;

