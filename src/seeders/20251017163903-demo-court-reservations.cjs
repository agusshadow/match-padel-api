'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const isPostgres = dialect === 'postgres';
    
    const slots = await queryInterface.sequelize.query(
      isPostgres
        ? `SELECT cs.id, cs.court_id, cs.start_time, cs.end_time, cs.price
           FROM court_slots cs
           WHERE cs.is_available = true
           ORDER BY cs.court_id, cs.day_of_week, cs.start_time
           LIMIT 30`
        : `SELECT cs.id, cs.court_id, cs.start_time, cs.end_time, cs.price
           FROM court_slots cs
           WHERE cs.is_available = true
           ORDER BY cs.court_id, cs.day_of_week, cs.start_time
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
      
      const slotId = slot.id;
      const courtId = slot.court_id || slot.courtId;
      const startTime = slot.start_time || slot.startTime;
      const endTime = slot.end_time || slot.endTime;
      
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + Math.floor(Math.random() * 30) + 1);
      
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      
      const scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(startH, startM, 0, 0);
      
      const endDateTime = new Date(scheduledDate);
      endDateTime.setHours(endH, endM, 0, 0);
      
      reservations.push({
        court_id: courtId,
        user_id: user.id,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        slot_id: slotId,
        scheduled_date_time: scheduledDateTime,
        end_date_time: endDateTime,
        price: slot.price,
        status: 'confirmed',
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    await queryInterface.bulkInsert('court_reservations', reservations);
    
    const slotIds = reservations.map(r => r.slot_id);
    await queryInterface.sequelize.query(
      `UPDATE court_slots SET is_available = false WHERE id IN (${slotIds.join(',')})`
    );
    
    console.log(`✅ ${reservations.length} reservas creadas`);
  },

  async down (queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const isPostgres = dialect === 'postgres';
    
    await queryInterface.sequelize.query(
      `UPDATE court_slots SET is_available = true WHERE id IN (SELECT slot_id FROM court_reservations WHERE slot_id IS NOT NULL)`
    );
    
    await queryInterface.bulkDelete('court_reservations', null, {});
  }
};
