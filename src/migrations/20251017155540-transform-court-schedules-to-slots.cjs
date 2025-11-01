'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Función para generar slots de 1.5 horas
    function generateTimeSlots(startTime, endTime) {
      const slots = [];
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      
      let current = new Date(start);
      
      while (current < end) {
        const slotEnd = new Date(current.getTime() + 90 * 60 * 1000); // 90 minutos = 1.5 horas
        
        // Si el slot se extiende más allá del horario de cierre, ajustar
        if (slotEnd > end) {
          break;
        }
        
        slots.push({
          start: current.toTimeString().slice(0, 8),
          end: slotEnd.toTimeString().slice(0, 8)
        });
        
        current = slotEnd;
      }
      
      return slots;
    }

    // Obtener todos los horarios actuales
    const currentSchedules = await queryInterface.sequelize.query(
      'SELECT * FROM court_schedules ORDER BY courtId, dayOfWeek',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    console.log(`Procesando ${currentSchedules.length} horarios existentes...`);

    // Crear tabla temporal para los nuevos slots
    const newSlots = [];

    for (const schedule of currentSchedules) {
      const slots = generateTimeSlots(schedule.startTime, schedule.endTime);
      
      for (const slot of slots) {
        newSlots.push({
          courtId: schedule.courtId,
          dayOfWeek: schedule.dayOfWeek,
          startTime: slot.start,
          endTime: slot.end,
          isAvailable: schedule.isAvailable,
          price: schedule.price,
          createdAt: schedule.createdAt,
          updatedAt: new Date()
        });
      }
    }

    console.log(`Generando ${newSlots.length} slots de 1.5 horas...`);

    // Limpiar la tabla actual
    await queryInterface.bulkDelete('court_schedules', null, {});

    // Insertar los nuevos slots solo si hay datos
    if (newSlots.length > 0) {
      await queryInterface.bulkInsert('court_schedules', newSlots);
      console.log('Transformación completada exitosamente!');
    } else {
      console.log('No hay datos para transformar. La tabla está vacía.');
    }
  },

  async down (queryInterface, Sequelize) {
    // Para revertir, necesitamos recrear los horarios completos originales
    // Esto es complejo porque perdemos la información original
    // Por ahora, simplemente limpiamos la tabla
    await queryInterface.bulkDelete('court_schedules', null, {});
    
    console.log('Tabla court_schedules limpiada. Necesitarás ejecutar los seeders nuevamente.');
  }
};
