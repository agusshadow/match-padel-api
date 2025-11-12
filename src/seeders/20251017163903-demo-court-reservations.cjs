'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener más slots disponibles para crear reservas de ejemplo (aumentado para más partidos)
    const dialect = queryInterface.sequelize.getDialect();
    const query = dialect === 'postgres'
      ? `SELECT cs.id as "slotId", cs."courtId", cs."startTime", cs."endTime", cs.price, 
              c.name as "courtName", cl.name as "clubName"
       FROM court_slots cs
       JOIN courts c ON cs."courtId" = c.id
       JOIN clubs cl ON c."clubId" = cl.id
       WHERE cs."isAvailable" = true
       ORDER BY cs."courtId", cs."dayOfWeek", cs."startTime"
       LIMIT 40`
      : `SELECT cs.id as slotId, cs.courtId, cs.startTime, cs.endTime, cs.price, 
              c.name as courtName, cl.name as clubName
       FROM court_slots cs
       JOIN courts c ON cs.courtId = c.id
       JOIN clubs cl ON c.clubId = cl.id
       WHERE cs.isAvailable = true
       ORDER BY cs.courtId, cs.dayOfWeek, cs.startTime
       LIMIT 40`;
    
    const availableSlots = await queryInterface.sequelize.query(
      query,
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
    
    // Crear más reservas de ejemplo (aumentado de 10 a 30)
    for (let i = 0; i < Math.min(30, availableSlots.length); i++) {
      const slot = availableSlots[i];
      const user = users[i % users.length];
      
      // PostgreSQL devuelve los nombres en minúsculas, normalizar
      const slotId = slot.slotId || slot.slotid;
      const courtId = slot.courtId || slot.courtid;
      const userId = user.id;
      
      // Crear fechas futuras para las reservas
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + Math.floor(Math.random() * 30) + 1);
      const scheduledDateStr = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Parsear hora de inicio y fin del slot
      const startTime = slot.startTime || slot.starttime;
      const endTime = slot.endTime || slot.endtime;
      const price = slot.price;
      
      // Calcular scheduledDateTime y endDateTime
      // Formato de startTime/endTime: "HH:mm:ss" o "HH:mm"
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(startHours, startMinutes, 0, 0);
      
      const endDateTime = new Date(scheduledDate);
      endDateTime.setHours(endHours, endMinutes, 0, 0);
      
      reservations.push({
        courtId: courtId,
        userId: userId,
        scheduledDate: scheduledDateStr,
        slotId: slotId,
        scheduledDateTime: scheduledDateTime, // ⭐ Campo denormalizado
        endDateTime: endDateTime,              // ⭐ Campo denormalizado
        price: price,                         // ⭐ Precio al momento de reserva
        status: 'confirmed', // Todas confirmadas para poder crear matches
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await queryInterface.bulkInsert('court_reservations', reservations);
    console.log(`✅ ${reservations.length} reservas de ejemplo creadas exitosamente`);

    // Marcar los slots usados como no disponibles
    const usedSlotIds = reservations.map(r => r.slotId);
    const updateQuery = dialect === 'postgres'
      ? `UPDATE court_slots SET "isAvailable" = false WHERE id IN (${usedSlotIds.join(',')})`
      : `UPDATE court_slots SET isAvailable = false WHERE id IN (${usedSlotIds.join(',')})`;
    
    await queryInterface.sequelize.query(updateQuery);
    console.log(`🔒 ${usedSlotIds.length} slots marcados como no disponibles`);
  },

  async down (queryInterface, Sequelize) {
    // Marcar los slots como disponibles nuevamente
    const dialect = queryInterface.sequelize.getDialect();
    const updateQuery = dialect === 'postgres'
      ? 'UPDATE court_slots SET "isAvailable" = true WHERE id IN (SELECT "slotId" FROM court_reservations WHERE "slotId" IS NOT NULL)'
      : 'UPDATE court_slots SET isAvailable = true WHERE id IN (SELECT slotId FROM court_reservations WHERE slotId IS NOT NULL)';
    
    await queryInterface.sequelize.query(updateQuery);
    
    await queryInterface.bulkDelete('court_reservations', null, {});
  }
};
