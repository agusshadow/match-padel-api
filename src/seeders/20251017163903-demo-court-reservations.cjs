'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener algunos slots disponibles para crear reservas de ejemplo
    const availableSlots = await queryInterface.sequelize.query(
      `SELECT cs.id as slotId, cs.courtId, cs.startTime, cs.endTime, cs.price, 
              c.name as courtName, cl.name as clubName
       FROM court_slots cs
       JOIN courts c ON cs.courtId = c.id
       JOIN clubs cl ON c.clubId = cl.id
       WHERE cs.isAvailable = true
       ORDER BY cs.courtId, cs.dayOfWeek, cs.startTime
       LIMIT 20`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // Obtener algunos usuarios para las reservas
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM users ORDER BY id LIMIT 5',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (availableSlots.length === 0 || users.length === 0) {
      console.log('⚠️ No hay slots disponibles o usuarios para crear reservas de ejemplo');
      return;
    }

    const reservations = [];
    const today = new Date();
    
    // Crear algunas reservas de ejemplo
    for (let i = 0; i < Math.min(10, availableSlots.length); i++) {
      const slot = availableSlots[i];
      const user = users[i % users.length];
      
      // Crear fechas futuras para las reservas
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + Math.floor(Math.random() * 30) + 1);
      
      reservations.push({
        courtId: slot.courtId,
        userId: user.id,
        scheduledDate: scheduledDate.toISOString().split('T')[0], // YYYY-MM-DD
        slotId: slot.slotId,
        status: 'confirmed', // Todas confirmadas para poder crear matches
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await queryInterface.bulkInsert('court_reservations', reservations);
    console.log(`✅ ${reservations.length} reservas de ejemplo creadas exitosamente`);

    // Marcar los slots usados como no disponibles
    const usedSlotIds = reservations.map(r => r.slotId);
    await queryInterface.sequelize.query(
      `UPDATE court_slots SET isAvailable = false WHERE id IN (${usedSlotIds.join(',')})`
    );
    console.log(`🔒 ${usedSlotIds.length} slots marcados como no disponibles`);
  },

  async down (queryInterface, Sequelize) {
    // Marcar los slots como disponibles nuevamente
    await queryInterface.sequelize.query(
      'UPDATE court_slots SET isAvailable = true WHERE id IN (SELECT slotId FROM court_reservations WHERE slotId IS NOT NULL)'
    );
    
    await queryInterface.bulkDelete('court_reservations', null, {});
  }
};
