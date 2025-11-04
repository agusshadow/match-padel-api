'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_profiles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Ubicación del usuario (ciudad, país)'
      },
      favoritePosition: {
        type: Sequelize.ENUM('left', 'right'),
        allowNull: true,
        comment: 'Posición favorita en la cancha'
      },
      gameStyle: {
        type: Sequelize.ENUM('offensive', 'defensive', 'balanced'),
        allowNull: true,
        comment: 'Estilo de juego preferido'
      },
      dominantHand: {
        type: Sequelize.ENUM('left', 'right', 'ambidextrous'),
        allowNull: true,
        comment: 'Mano hábil del usuario'
      },
      skillServe: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Nivel de saque (1-10)'
      },
      skillVolley: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Nivel de volea (1-10)'
      },
      skillForehand: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Nivel de derecha (1-10)'
      },
      skillWall: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Nivel de pared (1-10)'
      },
      skillSmash: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Nivel de remate (1-10)'
      },
      skillAgility: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Nivel de agilidad (1-10)'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Crear índice único para userId
    await queryInterface.addIndex('user_profiles', ['userId'], {
      unique: true,
      name: 'user_profiles_userId_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_profiles');
  }
};

