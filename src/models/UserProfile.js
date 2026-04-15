import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Constantes para posiciones favoritas
const FAVORITE_POSITION = {
  LEFT: 'left',
  RIGHT: 'right'
};

const FAVORITE_POSITION_VALUES = Object.values(FAVORITE_POSITION);

// Constantes para estilos de juego
const GAME_STYLE = {
  OFFENSIVE: 'offensive',
  DEFENSIVE: 'defensive',
  BALANCED: 'balanced'
};

const GAME_STYLE_VALUES = Object.values(GAME_STYLE);

// Constantes para mano hábil
const DOMINANT_HAND = {
  LEFT: 'left',
  RIGHT: 'right',
  AMBIDEXTROUS: 'ambidextrous'
};

const DOMINANT_HAND_VALUES = Object.values(DOMINANT_HAND);

const UserProfile = sequelize.define('UserProfile', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  location: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Ubicación del usuario (ciudad, país)'
  },
  favorite_position: {
    type: DataTypes.ENUM(...FAVORITE_POSITION_VALUES),
    allowNull: true,
    comment: 'Posición favorita en la cancha',
    validate: {
      isIn: [FAVORITE_POSITION_VALUES]
    }
  },
  game_style: {
    type: DataTypes.ENUM(...GAME_STYLE_VALUES),
    allowNull: true,
    comment: 'Estilo de juego preferido',
    validate: {
      isIn: [GAME_STYLE_VALUES]
    }
  },
  dominant_hand: {
    type: DataTypes.ENUM(...DOMINANT_HAND_VALUES),
    allowNull: true,
    comment: 'Mano hábil del usuario',
    validate: {
      isIn: [DOMINANT_HAND_VALUES]
    }
  },
  skill_serve: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Nivel de saque (1-10)'
  },
  skill_volley: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Nivel de volea (1-10)'
  },
  skill_forehand: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Nivel de derecha (1-10)'
  },
  skill_wall: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Nivel de pared (1-10)'
  },
  skill_smash: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Nivel de remate (1-10)'
  },
  skill_agility: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Nivel de agilidad (1-10)'
  },
  picture: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'URL de la foto de perfil'
  },
  equipped_palette_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'cosmetics',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'ID de la paleta equipada'
  }
}, {
  tableName: 'user_profiles',
  timestamps: true,
  underscored: true
});

// Exportar constantes para uso en otros archivos
UserProfile.FAVORITE_POSITION = FAVORITE_POSITION;
UserProfile.FAVORITE_POSITION_VALUES = FAVORITE_POSITION_VALUES;
UserProfile.GAME_STYLE = GAME_STYLE;
UserProfile.GAME_STYLE_VALUES = GAME_STYLE_VALUES;
UserProfile.DOMINANT_HAND = DOMINANT_HAND;
UserProfile.DOMINANT_HAND_VALUES = DOMINANT_HAND_VALUES;

export default UserProfile;
