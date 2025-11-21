'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const isPostgres = dialect === 'postgres';
    
    const slots = await queryInterface.sequelize.query(
      isPostgres
        ? `SELECT cs.id, cs."courtId", cs."startTime", cs."endTime", cs.price
           FROM court_slots cs
           WHERE cs."isAvailable" = true
           ORDER BY cs."courtId", cs."dayOfWeek", cs."startTime"
           LIMIT 30`
        : `SELECT cs.id, cs.courtId, cs.startTime, cs.endTime, cs.price
           FROM court_slots cs
           WHERE cs.isAvailable = true
           ORDER BY cs.courtId, cs.dayOfWeek, cs.startTime
           LIMIT 30`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const users = await queryInterface.sequelize.query(
      'SELECT id FROM users ORDER BY id LIMIT 5',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (slots.length === 0 || users.length === 0) {
      return;
    }

    const reservations = [];
    const today = new Date();

    for (let i = 0; i < Math.min(30, slots.length); i++) {
      const slot = slots[i];
      const user = users[i % users.length];
      
      const slotId = isPostgres ? (slot.id || slot.Id) : slot.id;
      const courtId = isPostgres ? (slot.courtId || slot.courtid) : slot.courtId;
      const startTime = isPostgres ? (slot.startTime || slot.starttime) : slot.startTime;
      const endTime = isPostgres ? (slot.endTime || slot.endtime) : slot.endTime;
      
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + Math.floor(Math.random() * 30) + 1);
      
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      
      const scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(startH, startM, 0, 0);
      
      const endDateTime = new Date(scheduledDate);
      endDateTime.setHours(endH, endM, 0, 0);
      
      reservations.push({
        courtId,
        userId: user.id,
        scheduledDate: scheduledDate.toISOString().split('T')[0],
        slotId,
        scheduledDateTime,
        endDateTime,
        price: slot.price,
        status: 'confirmed',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await queryInterface.bulkInsert('court_reservations', reservations);
    
    const slotIds = reservations.map(r => r.slotId);
    await queryInterface.sequelize.query(
      isPostgres
        ? `UPDATE court_slots SET "isAvailable" = false WHERE id IN (${slotIds.join(',')})`
        : `UPDATE court_slots SET isAvailable = false WHERE id IN (${slotIds.join(',')})`
    );
    
    console.log(`✅ ${reservations.length} reservas creadas`);
  },

  async down (queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const isPostgres = dialect === 'postgres';
    
    await queryInterface.sequelize.query(
      isPostgres
        ? 'UPDATE court_slots SET "isAvailable" = true WHERE id IN (SELECT "slotId" FROM court_reservations WHERE "slotId" IS NOT NULL)'
        : 'UPDATE court_slots SET isAvailable = true WHERE id IN (SELECT slotId FROM court_reservations WHERE slotId IS NOT NULL)'
    );
    
    await queryInterface.bulkDelete('court_reservations', null, {});
  }
};
