'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_profiles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      user_id: {
        type: Sequelize.BIGINT,
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
        type: Sequelize.TEXT(255),
        allowNull: true
      },
      favorite_position: {
        type: Sequelize.ENUM('left', 'right'),
        allowNull: true
      },
      game_style: {
        type: Sequelize.ENUM('offensive', 'defensive', 'balanced'),
        allowNull: true
      },
      dominant_hand: {
        type: Sequelize.ENUM('left', 'right', 'ambidextrous'),
        allowNull: true
      },
      skill_serve: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skill_volley: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skill_forehand: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skill_wall: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skill_smash: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      skill_agility: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      picture: {
        type: Sequelize.TEXT(500),
        allowNull: true
      },
      equipped_palette_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'ID de la paleta equipada (foreign key se agregará después de crear cosmetics)'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('user_profiles', ['user_id'], {
      unique: true,
      name: 'user_profiles_user_id_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_profiles');
  }
};
