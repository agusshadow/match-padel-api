'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Crear tabla cosmetics
    const cosmeticsTableExists = await queryInterface.tableExists('cosmetics');
    if (!cosmeticsTableExists) {
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
    }

    // Crear tabla user_cosmetics
    const userCosmeticsTableExists = await queryInterface.tableExists('user_cosmetics');
    if (!userCosmeticsTableExists) {
      await queryInterface.createTable('user_cosmetics', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'ID del usuario'
        },
        cosmeticId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'cosmetics',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'ID del cosmético'
        },
        acquiredAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          comment: 'Fecha de adquisición'
        },
        acquiredMethod: {
          type: Sequelize.ENUM('free', 'challenge', 'purchase'),
          allowNull: false,
          comment: 'Método de adquisición'
        },
        purchaseId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'ID de la compra si fue adquirido por compra'
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
          comment: 'ID del desafío si fue adquirido por desafío'
        },
        isEquipped: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
          comment: 'Si el cosmético está equipado'
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

      await queryInterface.addIndex('user_cosmetics', ['userId'], {
        name: 'idx_user_cosmetics_user_id'
      });

      await queryInterface.addIndex('user_cosmetics', ['userId', 'isEquipped'], {
        name: 'idx_user_cosmetics_user_id_is_equipped'
      });

      await queryInterface.addIndex('user_cosmetics', ['cosmeticId'], {
        name: 'idx_user_cosmetics_cosmetic_id'
      });

      await queryInterface.addConstraint('user_cosmetics', {
        fields: ['userId', 'cosmeticId'],
        type: 'unique',
        name: 'user_cosmetics_userId_cosmeticId_unique'
      });
    }

    // Agregar foreign key de rewardCosmeticId en challenges si no existe
    const challengeTableInfo = await queryInterface.describeTable('challenges');
    if (challengeTableInfo.rewardCosmeticId && !challengeTableInfo.rewardCosmeticId.references) {
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
    }
  },

  async down (queryInterface, Sequelize) {
    // Eliminar foreign key de challenges primero
    try {
      await queryInterface.removeConstraint('challenges', 'challenges_rewardCosmeticId_fkey');
    } catch (error) {
      // Ignorar si no existe
    }

    // Eliminar tablas
    await queryInterface.dropTable('user_cosmetics');
    await queryInterface.dropTable('cosmetics');
  }
};

