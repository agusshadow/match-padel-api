'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists('cosmetics');
    if (tableExists) {
      console.log('Tabla cosmetics ya existe, omitiendo creación');
      return;
    }

    await queryInterface.createTable('cosmetics', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('palette'),
        allowNull: false,
        defaultValue: 'palette'
      },
      imageUrl: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      acquisitionMethod: {
        type: Sequelize.ENUM('free', 'challenge', 'purchase'),
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
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
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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

    await queryInterface.addIndex('cosmetics', ['acquisitionMethod'], {
      name: 'idx_cosmetics_acquisition_method'
    });

    await queryInterface.addIndex('cosmetics', ['challengeId'], {
      name: 'idx_cosmetics_challenge'
    });

    await queryInterface.addIndex('cosmetics', ['isActive'], {
      name: 'idx_cosmetics_is_active'
    });

    await queryInterface.addIndex('cosmetics', ['type'], {
      name: 'idx_cosmetics_type'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('cosmetics');
  }
};

