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
        allowNull: true
      },
      favoritePosition: {
        type: Sequelize.ENUM('left', 'right'),
        allowNull: true
      },
      gameStyle: {
        type: Sequelize.ENUM('offensive', 'defensive', 'balanced'),
        allowNull: true
      },
      dominantHand: {
        type: Sequelize.ENUM('left', 'right', 'ambidextrous'),
        allowNull: true
      },
      skillServe: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skillVolley: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skillForehand: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skillWall: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skillSmash: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skillAgility: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      picture: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      equippedPaletteId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID de la paleta equipada (foreign key se agregará después de crear cosmetics)'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('user_profiles', ['userId'], {
      unique: true,
      name: 'user_profiles_userId_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_profiles');
  }
};
