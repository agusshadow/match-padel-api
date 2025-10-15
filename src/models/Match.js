const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/connection');

const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reservationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'court_reservations',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  player1Id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  player2Id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  player3Id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  player4Id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  matchType: {
    type: DataTypes.ENUM('singles', 'doubles'),
    allowNull: false,
    defaultValue: 'doubles',
    validate: {
      isIn: [['singles', 'doubles']]
    }
  },
  skillLevel: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced', 'professional'),
    allowNull: false,
    defaultValue: 'intermediate',
    validate: {
      isIn: [['beginner', 'intermediate', 'advanced', 'professional']]
    }
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'scheduled',
    allowNull: false,
    validate: {
      isIn: [['scheduled', 'in_progress', 'completed', 'cancelled']]
    }
  },
  score: {
    type: DataTypes.JSON,
    allowNull: true,
    validate: {
      isValidScore(value) {
        if (value && typeof value === 'object') {
          if (!value.sets || !Array.isArray(value.sets)) {
            throw new Error('Score debe tener un array de sets');
          }
          if (!value.winner || !['team1', 'team2'].includes(value.winner)) {
            throw new Error('Score debe tener un winner válido (team1 o team2)');
          }
        }
      }
    }
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 300 // Máximo 5 horas
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'matches',
  timestamps: true,
  paranoid: false,
  validate: {
    validatePlayers() {
      if (this.matchType === 'singles') {
        if (this.player3Id || this.player4Id) {
          throw new Error('Partidos singles no pueden tener más de 2 jugadores');
        }
      } else if (this.matchType === 'doubles') {
        if (!this.player3Id || !this.player4Id) {
          throw new Error('Partidos doubles requieren 4 jugadores');
        }
      }
    },
    validateUniquePlayers() {
      const players = [this.player1Id, this.player2Id, this.player3Id, this.player4Id].filter(Boolean);
      const uniquePlayers = [...new Set(players)];
      if (players.length !== uniquePlayers.length) {
        throw new Error('Los jugadores deben ser únicos');
      }
    }
  }
});

module.exports = Match;
