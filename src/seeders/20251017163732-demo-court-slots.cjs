'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Función para generar slots de 1.5 horas
    function generateTimeSlots(startTime, endTime, price) {
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
          end: slotEnd.toTimeString().slice(0, 8),
          price: price
        });
        
        current = slotEnd;
      }
      
      return slots;
    }

    // Obtener los IDs de las canchas
    const courts = await queryInterface.sequelize.query(
      'SELECT c.id, c.name, cl.name as clubName FROM courts c JOIN clubs cl ON c.clubId = cl.id ORDER BY c.id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const courtIds = {};
    courts.forEach(court => {
      const key = `${court.clubName} - ${court.name}`;
      courtIds[key] = court.id;
    });

    const slots = [];

    // Generar slots para cada cancha y día de la semana
    const courtSchedules = [
      // Club Pádel Central - Cancha 1
      { court: 'Club Pádel Central - Cancha 1', day: 1, start: '08:00:00', end: '22:00:00', price: 3000.00 },
      { court: 'Club Pádel Central - Cancha 1', day: 2, start: '08:00:00', end: '22:00:00', price: 3000.00 },
      { court: 'Club Pádel Central - Cancha 1', day: 3, start: '08:00:00', end: '22:00:00', price: 3000.00 },
      { court: 'Club Pádel Central - Cancha 1', day: 4, start: '08:00:00', end: '22:00:00', price: 3000.00 },
      { court: 'Club Pádel Central - Cancha 1', day: 5, start: '08:00:00', end: '23:00:00', price: 3500.00 },
      { court: 'Club Pádel Central - Cancha 1', day: 6, start: '09:00:00', end: '23:00:00', price: 4000.00 },
      { court: 'Club Pádel Central - Cancha 1', day: 0, start: '09:00:00', end: '21:00:00', price: 4000.00 },

      // Club Pádel Central - Cancha 2
      { court: 'Club Pádel Central - Cancha 2', day: 1, start: '08:00:00', end: '22:00:00', price: 3000.00 },
      { court: 'Club Pádel Central - Cancha 2', day: 2, start: '08:00:00', end: '22:00:00', price: 3000.00 },
      { court: 'Club Pádel Central - Cancha 2', day: 3, start: '08:00:00', end: '22:00:00', price: 3000.00 },
      { court: 'Club Pádel Central - Cancha 2', day: 4, start: '08:00:00', end: '22:00:00', price: 3000.00 },
      { court: 'Club Pádel Central - Cancha 2', day: 5, start: '08:00:00', end: '23:00:00', price: 3500.00 },
      { court: 'Club Pádel Central - Cancha 2', day: 6, start: '09:00:00', end: '23:00:00', price: 4000.00 },
      { court: 'Club Pádel Central - Cancha 2', day: 0, start: '09:00:00', end: '21:00:00', price: 4000.00 },

      // Pádel Norte - Cancha Central
      { court: 'Pádel Norte - Cancha Central', day: 1, start: '07:00:00', end: '23:00:00', price: 2800.00 },
      { court: 'Pádel Norte - Cancha Central', day: 2, start: '07:00:00', end: '23:00:00', price: 2800.00 },
      { court: 'Pádel Norte - Cancha Central', day: 3, start: '07:00:00', end: '23:00:00', price: 2800.00 },
      { court: 'Pádel Norte - Cancha Central', day: 4, start: '07:00:00', end: '23:00:00', price: 2800.00 },
      { court: 'Pádel Norte - Cancha Central', day: 5, start: '07:00:00', end: '23:00:00', price: 3200.00 },
      { court: 'Pádel Norte - Cancha Central', day: 6, start: '08:00:00', end: '23:00:00', price: 3800.00 },
      { court: 'Pádel Norte - Cancha Central', day: 0, start: '08:00:00', end: '22:00:00', price: 3800.00 },

      // Pádel Norte - Cancha Norte
      { court: 'Pádel Norte - Cancha Norte', day: 1, start: '08:00:00', end: '20:00:00', price: 2500.00 },
      { court: 'Pádel Norte - Cancha Norte', day: 2, start: '08:00:00', end: '20:00:00', price: 2500.00 },
      { court: 'Pádel Norte - Cancha Norte', day: 3, start: '08:00:00', end: '20:00:00', price: 2500.00 },
      { court: 'Pádel Norte - Cancha Norte', day: 4, start: '08:00:00', end: '20:00:00', price: 2500.00 },
      { court: 'Pádel Norte - Cancha Norte', day: 5, start: '08:00:00', end: '20:00:00', price: 2800.00 },
      { court: 'Pádel Norte - Cancha Norte', day: 6, start: '09:00:00', end: '21:00:00', price: 3200.00 },
      { court: 'Pádel Norte - Cancha Norte', day: 0, start: '09:00:00', end: '20:00:00', price: 3200.00 },

      // Club Deportivo Sur - Cancha Principal
      { court: 'Club Deportivo Sur - Cancha Principal', day: 1, start: '08:00:00', end: '22:00:00', price: 3200.00 },
      { court: 'Club Deportivo Sur - Cancha Principal', day: 2, start: '08:00:00', end: '22:00:00', price: 3200.00 },
      { court: 'Club Deportivo Sur - Cancha Principal', day: 3, start: '08:00:00', end: '22:00:00', price: 3200.00 },
      { court: 'Club Deportivo Sur - Cancha Principal', day: 4, start: '08:00:00', end: '22:00:00', price: 3200.00 },
      { court: 'Club Deportivo Sur - Cancha Principal', day: 5, start: '08:00:00', end: '23:00:00', price: 3600.00 },
      { court: 'Club Deportivo Sur - Cancha Principal', day: 6, start: '09:00:00', end: '23:00:00', price: 4200.00 },
      { court: 'Club Deportivo Sur - Cancha Principal', day: 0, start: '09:00:00', end: '21:00:00', price: 4200.00 },

      // Club Deportivo Sur - Cancha Secundaria
      { court: 'Club Deportivo Sur - Cancha Secundaria', day: 1, start: '08:00:00', end: '20:00:00', price: 2800.00 },
      { court: 'Club Deportivo Sur - Cancha Secundaria', day: 2, start: '08:00:00', end: '20:00:00', price: 2800.00 },
      { court: 'Club Deportivo Sur - Cancha Secundaria', day: 3, start: '08:00:00', end: '20:00:00', price: 2800.00 },
      { court: 'Club Deportivo Sur - Cancha Secundaria', day: 4, start: '08:00:00', end: '20:00:00', price: 2800.00 },
      { court: 'Club Deportivo Sur - Cancha Secundaria', day: 5, start: '08:00:00', end: '20:00:00', price: 3200.00 },
      { court: 'Club Deportivo Sur - Cancha Secundaria', day: 6, start: '09:00:00', end: '21:00:00', price: 3600.00 },
      { court: 'Club Deportivo Sur - Cancha Secundaria', day: 0, start: '09:00:00', end: '20:00:00', price: 3600.00 },

      // Pádel Oeste - Cancha Premium
      { court: 'Pádel Oeste - Cancha Premium', day: 1, start: '08:00:00', end: '23:00:00', price: 3500.00 },
      { court: 'Pádel Oeste - Cancha Premium', day: 2, start: '08:00:00', end: '23:00:00', price: 3500.00 },
      { court: 'Pádel Oeste - Cancha Premium', day: 3, start: '08:00:00', end: '23:00:00', price: 3500.00 },
      { court: 'Pádel Oeste - Cancha Premium', day: 4, start: '08:00:00', end: '23:00:00', price: 3500.00 },
      { court: 'Pádel Oeste - Cancha Premium', day: 5, start: '08:00:00', end: '23:00:00', price: 4000.00 },
      { court: 'Pádel Oeste - Cancha Premium', day: 6, start: '09:00:00', end: '23:00:00', price: 4500.00 },
      { court: 'Pádel Oeste - Cancha Premium', day: 0, start: '09:00:00', end: '22:00:00', price: 4500.00 },

      // Pádel Oeste - Cancha VIP
      { court: 'Pádel Oeste - Cancha VIP', day: 1, start: '08:00:00', end: '23:00:00', price: 4000.00 },
      { court: 'Pádel Oeste - Cancha VIP', day: 2, start: '08:00:00', end: '23:00:00', price: 4000.00 },
      { court: 'Pádel Oeste - Cancha VIP', day: 3, start: '08:00:00', end: '23:00:00', price: 4000.00 },
      { court: 'Pádel Oeste - Cancha VIP', day: 4, start: '08:00:00', end: '23:00:00', price: 4000.00 },
      { court: 'Pádel Oeste - Cancha VIP', day: 5, start: '08:00:00', end: '23:00:00', price: 4500.00 },
      { court: 'Pádel Oeste - Cancha VIP', day: 6, start: '09:00:00', end: '23:00:00', price: 5000.00 },
      { court: 'Pádel Oeste - Cancha VIP', day: 0, start: '09:00:00', end: '22:00:00', price: 5000.00 },

      // Mega Pádel Center - Cancha A
      { court: 'Mega Pádel Center - Cancha A', day: 1, start: '07:00:00', end: '23:00:00', price: 3000.00 },
      { court: 'Mega Pádel Center - Cancha A', day: 2, start: '07:00:00', end: '23:00:00', price: 3000.00 },
      { court: 'Mega Pádel Center - Cancha A', day: 3, start: '07:00:00', end: '23:00:00', price: 3000.00 },
      { court: 'Mega Pádel Center - Cancha A', day: 4, start: '07:00:00', end: '23:00:00', price: 3000.00 },
      { court: 'Mega Pádel Center - Cancha A', day: 5, start: '07:00:00', end: '23:00:00', price: 3500.00 },
      { court: 'Mega Pádel Center - Cancha A', day: 6, start: '08:00:00', end: '23:00:00', price: 4000.00 },
      { court: 'Mega Pádel Center - Cancha A', day: 0, start: '08:00:00', end: '22:00:00', price: 4000.00 },

      // Mega Pádel Center - Cancha B
      { court: 'Mega Pádel Center - Cancha B', day: 1, start: '07:00:00', end: '23:00:00', price: 3000.00 },
      { court: 'Mega Pádel Center - Cancha B', day: 2, start: '07:00:00', end: '23:00:00', price: 3000.00 },
      { court: 'Mega Pádel Center - Cancha B', day: 3, start: '07:00:00', end: '23:00:00', price: 3000.00 },
      { court: 'Mega Pádel Center - Cancha B', day: 4, start: '07:00:00', end: '23:00:00', price: 3000.00 },
      { court: 'Mega Pádel Center - Cancha B', day: 5, start: '07:00:00', end: '23:00:00', price: 3500.00 },
      { court: 'Mega Pádel Center - Cancha B', day: 6, start: '08:00:00', end: '23:00:00', price: 4000.00 },
      { court: 'Mega Pádel Center - Cancha B', day: 0, start: '08:00:00', end: '22:00:00', price: 4000.00 },

      // Mega Pádel Center - Cancha C
      { court: 'Mega Pádel Center - Cancha C', day: 1, start: '08:00:00', end: '22:00:00', price: 2800.00 },
      { court: 'Mega Pádel Center - Cancha C', day: 2, start: '08:00:00', end: '22:00:00', price: 2800.00 },
      { court: 'Mega Pádel Center - Cancha C', day: 3, start: '08:00:00', end: '22:00:00', price: 2800.00 },
      { court: 'Mega Pádel Center - Cancha C', day: 4, start: '08:00:00', end: '22:00:00', price: 2800.00 },
      { court: 'Mega Pádel Center - Cancha C', day: 5, start: '08:00:00', end: '22:00:00', price: 3200.00 },
      { court: 'Mega Pádel Center - Cancha C', day: 6, start: '09:00:00', end: '22:00:00', price: 3600.00 },
      { court: 'Mega Pádel Center - Cancha C', day: 0, start: '09:00:00', end: '21:00:00', price: 3600.00 },

      // Mega Pádel Center - Cancha D
      { court: 'Mega Pádel Center - Cancha D', day: 1, start: '08:00:00', end: '20:00:00', price: 2500.00 },
      { court: 'Mega Pádel Center - Cancha D', day: 2, start: '08:00:00', end: '20:00:00', price: 2500.00 },
      { court: 'Mega Pádel Center - Cancha D', day: 3, start: '08:00:00', end: '20:00:00', price: 2500.00 },
      { court: 'Mega Pádel Center - Cancha D', day: 4, start: '08:00:00', end: '20:00:00', price: 2500.00 },
      { court: 'Mega Pádel Center - Cancha D', day: 5, start: '08:00:00', end: '20:00:00', price: 2800.00 },
      { court: 'Mega Pádel Center - Cancha D', day: 6, start: '09:00:00', end: '21:00:00', price: 3200.00 },
      { court: 'Mega Pádel Center - Cancha D', day: 0, start: '09:00:00', end: '20:00:00', price: 3200.00 }
    ];

    // Generar slots para cada configuración
    for (const schedule of courtSchedules) {
      const courtId = courtIds[schedule.court];
      if (courtId) {
        const timeSlots = generateTimeSlots(schedule.start, schedule.end, schedule.price);
        
        for (const slot of timeSlots) {
          slots.push({
            courtId: courtId,
            dayOfWeek: schedule.day,
            startTime: slot.start,
            endTime: slot.end,
            isAvailable: true,
            price: slot.price,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }

    await queryInterface.bulkInsert('court_slots', slots);
    console.log(`✅ ${slots.length} slots de 1.5 horas creados exitosamente`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('court_slots', null, {});
  }
};
