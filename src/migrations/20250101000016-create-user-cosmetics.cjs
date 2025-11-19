'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists('user_cosmetics');
    if (tableExists) {
      console.log('Tabla user_cosmetics ya existe, omitiendo creación');
      return;
    }

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
        onDelete: 'CASCADE'
      },
      cosmeticId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cosmetics',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      acquiredAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      acquiredMethod: {
        type: Sequelize.ENUM('free', 'challenge', 'purchase'),
        allowNull: false
      },
      purchaseId: {
        type: Sequelize.INTEGER,
        allowNull: true
        // La foreign key se agregará después de crear la tabla purchases
      },
      challengeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'challenges',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      isEquipped: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
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
      name: 'idx_user_cosmetics_user'
    });

    await queryInterface.addIndex('user_cosmetics', ['userId', 'isEquipped'], {
      name: 'idx_user_cosmetics_user_equipped'
    });

    await queryInterface.addIndex('user_cosmetics', ['cosmeticId'], {
      name: 'idx_user_cosmetics_cosmetic'
    });

    await queryInterface.addIndex('user_cosmetics', ['userId', 'cosmeticId'], {
      unique: true,
      name: 'idx_user_cosmetics_user_cosmetic_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_cosmetics');
  }
};

