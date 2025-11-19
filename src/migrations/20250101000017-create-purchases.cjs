'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists('purchases');
    if (tableExists) {
      console.log('Tabla purchases ya existe, omitiendo creación');
      return;
    }

    await queryInterface.createTable('purchases', {
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
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      paymentMethod: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'mock'
      },
      paymentStatus: {
        type: Sequelize.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'completed'
      },
      purchasedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
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

    await queryInterface.addIndex('purchases', ['userId'], {
      name: 'idx_purchases_user'
    });

    await queryInterface.addIndex('purchases', ['cosmeticId'], {
      name: 'idx_purchases_cosmetic'
    });

    await queryInterface.addIndex('purchases', ['paymentStatus'], {
      name: 'idx_purchases_payment_status'
    });

    await queryInterface.addIndex('purchases', ['paymentMethod'], {
      name: 'idx_purchases_payment_method'
    });

    // Agregar foreign key de user_cosmetics.purchaseId a purchases.id
    try {
      await queryInterface.addConstraint('user_cosmetics', {
        fields: ['purchaseId'],
        type: 'foreign key',
        name: 'fk_user_cosmetics_purchase',
        references: {
          table: 'purchases',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      console.log('✅ Foreign key agregada: user_cosmetics.purchaseId -> purchases.id');
    } catch (error) {
      // Si ya existe, ignorar
      if (error.name !== 'SequelizeDatabaseError' || !error.message.includes('already exists')) {
        console.error('Error agregando foreign key:', error);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    try {
      await queryInterface.removeConstraint('user_cosmetics', 'fk_user_cosmetics_purchase');
    } catch (error) {
      // Ignorar si no existe
    }
    await queryInterface.dropTable('purchases');
  }
};

