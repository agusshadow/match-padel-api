'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Crear tabla cosmetics
    await queryInterface.createTable('cosmetics', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      name: {
        type: Sequelize.TEXT(255),
        allowNull: false,
        comment: 'Nombre del cosmético'
      },
      description: {
        type: Sequelize.TEXT(500),
        allowNull: true,
        comment: 'Descripción del cosmético'
      },
      type: {
        type: Sequelize.ENUM('palette'),
        allowNull: false,
        defaultValue: 'palette',
        comment: 'Tipo de cosmético'
      },
      image_url: {
        type: Sequelize.TEXT(500),
        allowNull: false,
        comment: 'URL completa de la imagen en el bucket público'
      },
      acquisition_method: {
        type: Sequelize.ENUM('free', 'challenge', 'purchase'),
        allowNull: false,
        comment: 'Método de adquisición: free, challenge, purchase'
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Precio si es comprable (NULL si no es comprable)'
      },
      challenge_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'challenges',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID del desafío si se obtiene por desafío'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Si el cosmético está activo y disponible'
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

    await queryInterface.addIndex('cosmetics', ['acquisition_method'], {
      name: 'idx_cosmetics_acquisition_method'
    });

    await queryInterface.addIndex('cosmetics', ['challenge_id'], {
      name: 'idx_cosmetics_challenge_id'
    });

    await queryInterface.addIndex('cosmetics', ['is_active'], {
      name: 'idx_cosmetics_is_active'
    });

    await queryInterface.addIndex('cosmetics', ['type'], {
      name: 'idx_cosmetics_type'
    });

    // Agregar foreign key de reward_cosmetic_id en challenges
    await queryInterface.addConstraint('challenges', {
      fields: ['reward_cosmetic_id'],
      type: 'foreign key',
      name: 'challenges_reward_cosmetic_id_fkey',
      references: {
        table: 'cosmetics',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Agregar foreign key de equipped_palette_id en user_profiles
    await queryInterface.addConstraint('user_profiles', {
      fields: ['equipped_palette_id'],
      type: 'foreign key',
      name: 'user_profiles_equipped_palette_id_fkey',
      references: {
        table: 'cosmetics',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down (queryInterface, Sequelize) {
    // Eliminar foreign keys primero
    try {
      await queryInterface.removeConstraint('challenges', 'challenges_reward_cosmetic_id_fkey');
    } catch (error) {
      // Ignorar si no existe
    }

    try {
      await queryInterface.removeConstraint('user_profiles', 'user_profiles_equipped_palette_id_fkey');
    } catch (error) {
      // Ignorar si no existe
    }

    // Eliminar tabla
    await queryInterface.dropTable('cosmetics');
  }
};

