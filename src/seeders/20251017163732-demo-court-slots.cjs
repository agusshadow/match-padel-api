'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    function generateTimeSlots(startTime, endTime) {
      const slots = [];
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      let current = new Date(start);
      
      while (current < end) {
        const slotEnd = new Date(current.getTime() + 90 * 60 * 1000);
        if (slotEnd > end) break;
        
        const prices = [50000, 55000, 60000];
        slots.push({
          start: current.toTimeString().slice(0, 8),
          end: slotEnd.toTimeString().slice(0, 8),
          price: prices[Math.floor(Math.random() * prices.length)]
        });
        current = slotEnd;
      }
      return slots;
    }

    const dialect = queryInterface.sequelize.getDialect();
    const isPostgres = dialect === 'postgres';
    
    const courts = await queryInterface.sequelize.query(
      isPostgres
        ? 'SELECT c.id, c.name, cl.name as "clubName" FROM courts c JOIN clubs cl ON c."clubId" = cl.id ORDER BY c.id'
        : 'SELECT c.id, c.name, cl.name as clubName FROM courts c JOIN clubs cl ON c.clubId = cl.id ORDER BY c.id',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const courtIds = {};
    courts.forEach(court => {
      const clubName = isPostgres ? (court.clubName || court.clubname) : court.clubName;
      courtIds[`${clubName} - ${court.name}`] = court.id;
    });

    const slots = [];

    const schedules = [
      { court: 'Club Pádel Central - Cancha 1', weekdays: { start: '08:00:00', end: '22:00:00' }, friday: { start: '08:00:00', end: '23:00:00' }, saturday: { start: '09:00:00', end: '23:00:00' }, sunday: { start: '09:00:00', end: '21:00:00' } },
      { court: 'Club Pádel Central - Cancha 2', weekdays: { start: '08:00:00', end: '22:00:00' }, friday: { start: '08:00:00', end: '23:00:00' }, saturday: { start: '09:00:00', end: '23:00:00' }, sunday: { start: '09:00:00', end: '21:00:00' } },
      { court: 'Pádel Norte - Cancha Central', weekdays: { start: '07:00:00', end: '23:00:00' }, friday: { start: '07:00:00', end: '23:00:00' }, saturday: { start: '08:00:00', end: '23:00:00' }, sunday: { start: '08:00:00', end: '22:00:00' } },
      { court: 'Pádel Norte - Cancha Norte', weekdays: { start: '08:00:00', end: '20:00:00' }, friday: { start: '08:00:00', end: '20:00:00' }, saturday: { start: '09:00:00', end: '21:00:00' }, sunday: { start: '09:00:00', end: '20:00:00' } },
      { court: 'Club Deportivo Sur - Cancha Principal', weekdays: { start: '08:00:00', end: '22:00:00' }, friday: { start: '08:00:00', end: '23:00:00' }, saturday: { start: '09:00:00', end: '23:00:00' }, sunday: { start: '09:00:00', end: '21:00:00' } },
      { court: 'Club Deportivo Sur - Cancha Secundaria', weekdays: { start: '08:00:00', end: '20:00:00' }, friday: { start: '08:00:00', end: '20:00:00' }, saturday: { start: '09:00:00', end: '21:00:00' }, sunday: { start: '09:00:00', end: '20:00:00' } },
      { court: 'Pádel Oeste - Cancha Premium', weekdays: { start: '08:00:00', end: '23:00:00' }, friday: { start: '08:00:00', end: '23:00:00' }, saturday: { start: '09:00:00', end: '23:00:00' }, sunday: { start: '09:00:00', end: '22:00:00' } },
      { court: 'Pádel Oeste - Cancha VIP', weekdays: { start: '08:00:00', end: '23:00:00' }, friday: { start: '08:00:00', end: '23:00:00' }, saturday: { start: '09:00:00', end: '23:00:00' }, sunday: { start: '09:00:00', end: '22:00:00' } },
      { court: 'Mega Pádel Center - Cancha A', weekdays: { start: '07:00:00', end: '23:00:00' }, friday: { start: '07:00:00', end: '23:00:00' }, saturday: { start: '08:00:00', end: '23:00:00' }, sunday: { start: '08:00:00', end: '22:00:00' } },
      { court: 'Mega Pádel Center - Cancha B', weekdays: { start: '07:00:00', end: '23:00:00' }, friday: { start: '07:00:00', end: '23:00:00' }, saturday: { start: '08:00:00', end: '23:00:00' }, sunday: { start: '08:00:00', end: '22:00:00' } },
      { court: 'Mega Pádel Center - Cancha C', weekdays: { start: '08:00:00', end: '22:00:00' }, friday: { start: '08:00:00', end: '22:00:00' }, saturday: { start: '09:00:00', end: '22:00:00' }, sunday: { start: '09:00:00', end: '21:00:00' } },
      { court: 'Mega Pádel Center - Cancha D', weekdays: { start: '08:00:00', end: '20:00:00' }, friday: { start: '08:00:00', end: '20:00:00' }, saturday: { start: '09:00:00', end: '21:00:00' }, sunday: { start: '09:00:00', end: '20:00:00' } }
    ];

    for (const schedule of schedules) {
      const courtId = courtIds[schedule.court];
      if (!courtId) continue;

      const dayConfigs = [
        { days: [1, 2, 3, 4], time: schedule.weekdays },
        { days: [5], time: schedule.friday },
        { days: [6], time: schedule.saturday },
        { days: [0], time: schedule.sunday }
      ];

      for (const dayConfig of dayConfigs) {
        const timeSlots = generateTimeSlots(dayConfig.time.start, dayConfig.time.end);
        for (const day of dayConfig.days) {
          for (const slot of timeSlots) {
            slots.push({
              courtId,
              dayOfWeek: day,
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
    }

    await queryInterface.bulkInsert('court_slots', slots);
    console.log(`✅ ${slots.length} slots creados`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('court_slots', null, {});
  }
};

