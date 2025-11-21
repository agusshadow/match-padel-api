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
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Nombre del cosmético'
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Descripción del cosmético'
      },
      type: {
        type: Sequelize.ENUM('palette'),
        allowNull: false,
        defaultValue: 'palette',
        comment: 'Tipo de cosmético'
      },
      imageUrl: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'URL completa de la imagen en el bucket público'
      },
      acquisitionMethod: {
        type: Sequelize.ENUM('free', 'challenge', 'purchase'),
        allowNull: false,
        comment: 'Método de adquisición: free, challenge, purchase'
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Precio si es comprable (NULL si no es comprable)'
      },
      challengeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'challenges',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID del desafío si se obtiene por desafío'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Si el cosmético está activo y disponible'
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

    await queryInterface.addIndex('cosmetics', ['acquisitionMethod'], {
      name: 'idx_cosmetics_acquisition_method'
    });

    await queryInterface.addIndex('cosmetics', ['challengeId'], {
      name: 'idx_cosmetics_challenge_id'
    });

    await queryInterface.addIndex('cosmetics', ['isActive'], {
      name: 'idx_cosmetics_is_active'
    });

    await queryInterface.addIndex('cosmetics', ['type'], {
      name: 'idx_cosmetics_type'
    });

    // Agregar foreign key de rewardCosmeticId en challenges
    await queryInterface.addConstraint('challenges', {
      fields: ['rewardCosmeticId'],
      type: 'foreign key',
      name: 'challenges_rewardCosmeticId_fkey',
      references: {
        table: 'cosmetics',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Agregar foreign key de equippedPaletteId en user_profiles
    await queryInterface.addConstraint('user_profiles', {
      fields: ['equippedPaletteId'],
      type: 'foreign key',
      name: 'user_profiles_equippedPaletteId_fkey',
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
      await queryInterface.removeConstraint('challenges', 'challenges_rewardCosmeticId_fkey');
    } catch (error) {
      // Ignorar si no existe
    }

    try {
      await queryInterface.removeConstraint('user_profiles', 'user_profiles_equippedPaletteId_fkey');
    } catch (error) {
      // Ignorar si no existe
    }

    // Eliminar tabla
    await queryInterface.dropTable('cosmetics');
  }
};

