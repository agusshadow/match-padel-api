'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
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

    await queryInterface.bulkInsert('court_schedules', [
      // Horarios para Cancha 1 (Club Pádel Central - ID: 1)
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        dayOfWeek: 1, // Lunes
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        dayOfWeek: 2, // Martes
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        dayOfWeek: 3, // Miércoles
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        dayOfWeek: 4, // Jueves
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        dayOfWeek: 5, // Viernes
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        dayOfWeek: 6, // Sábado
        startTime: '09:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 1'],
        dayOfWeek: 0, // Domingo
        startTime: '09:00:00',
        endTime: '21:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha 2 (Club Pádel Central - ID: 2)
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        dayOfWeek: 1, // Lunes
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        dayOfWeek: 2, // Martes
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        dayOfWeek: 3, // Miércoles
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        dayOfWeek: 4, // Jueves
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        dayOfWeek: 5, // Viernes
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        dayOfWeek: 6, // Sábado
        startTime: '09:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Pádel Central - Cancha 2'],
        dayOfWeek: 0, // Domingo
        startTime: '09:00:00',
        endTime: '21:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha Central (Pádel Norte - ID: 3)
      {
        courtId: courtIds['Pádel Norte - Cancha Central'],
        dayOfWeek: 1, // Lunes
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Central'],
        dayOfWeek: 2, // Martes
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Central'],
        dayOfWeek: 3, // Miércoles
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Central'],
        dayOfWeek: 4, // Jueves
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Central'],
        dayOfWeek: 5, // Viernes
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Central'],
        dayOfWeek: 6, // Sábado
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Central'],
        dayOfWeek: 0, // Domingo
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha Norte (Pádel Norte - ID: 4)
      {
        courtId: courtIds['Pádel Norte - Cancha Norte'],
        dayOfWeek: 1, // Lunes
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Norte'],
        dayOfWeek: 2, // Martes
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Norte'],
        dayOfWeek: 3, // Miércoles
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Norte'],
        dayOfWeek: 4, // Jueves
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Norte'],
        dayOfWeek: 5, // Viernes
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Norte'],
        dayOfWeek: 6, // Sábado
        startTime: '09:00:00',
        endTime: '21:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Norte - Cancha Norte'],
        dayOfWeek: 0, // Domingo
        startTime: '09:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha Principal (Club Deportivo Sur - ID: 5)
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Principal'],
        dayOfWeek: 1, // Lunes
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Principal'],
        dayOfWeek: 2, // Martes
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Principal'],
        dayOfWeek: 3, // Miércoles
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Principal'],
        dayOfWeek: 4, // Jueves
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Principal'],
        dayOfWeek: 5, // Viernes
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3600.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Principal'],
        dayOfWeek: 6, // Sábado
        startTime: '09:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Principal'],
        dayOfWeek: 0, // Domingo
        startTime: '09:00:00',
        endTime: '21:00:00',
        isAvailable: true,
        price: 4200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha Secundaria (Club Deportivo Sur - ID: 6)
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Secundaria'],
        dayOfWeek: 1, // Lunes
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Secundaria'],
        dayOfWeek: 2, // Martes
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Secundaria'],
        dayOfWeek: 3, // Miércoles
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Secundaria'],
        dayOfWeek: 4, // Jueves
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Secundaria'],
        dayOfWeek: 5, // Viernes
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Secundaria'],
        dayOfWeek: 6, // Sábado
        startTime: '09:00:00',
        endTime: '21:00:00',
        isAvailable: true,
        price: 3600.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Club Deportivo Sur - Cancha Secundaria'],
        dayOfWeek: 0, // Domingo
        startTime: '09:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 3600.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha Premium (Pádel Oeste - ID: 7)
      {
        courtId: courtIds['Pádel Oeste - Cancha Premium'],
        dayOfWeek: 1, // Lunes
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha Premium'],
        dayOfWeek: 2, // Martes
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha Premium'],
        dayOfWeek: 3, // Miércoles
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha Premium'],
        dayOfWeek: 4, // Jueves
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha Premium'],
        dayOfWeek: 5, // Viernes
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha Premium'],
        dayOfWeek: 6, // Sábado
        startTime: '09:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha Premium'],
        dayOfWeek: 0, // Domingo
        startTime: '09:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 4500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha VIP (Pádel Oeste - ID: 8)
      {
        courtId: courtIds['Pádel Oeste - Cancha VIP'],
        dayOfWeek: 1, // Lunes
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha VIP'],
        dayOfWeek: 2, // Martes
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha VIP'],
        dayOfWeek: 3, // Miércoles
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha VIP'],
        dayOfWeek: 4, // Jueves
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha VIP'],
        dayOfWeek: 5, // Viernes
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha VIP'],
        dayOfWeek: 6, // Sábado
        startTime: '09:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 5000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Pádel Oeste - Cancha VIP'],
        dayOfWeek: 0, // Domingo
        startTime: '09:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 5000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha A (Mega Pádel Center - ID: 9)
      {
        courtId: courtIds['Mega Pádel Center - Cancha A'],
        dayOfWeek: 1, // Lunes
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha A'],
        dayOfWeek: 2, // Martes
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha A'],
        dayOfWeek: 3, // Miércoles
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha A'],
        dayOfWeek: 4, // Jueves
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha A'],
        dayOfWeek: 5, // Viernes
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha A'],
        dayOfWeek: 6, // Sábado
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha A'],
        dayOfWeek: 0, // Domingo
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha B (Mega Pádel Center - ID: 10)
      {
        courtId: courtIds['Mega Pádel Center - Cancha B'],
        dayOfWeek: 1, // Lunes
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha B'],
        dayOfWeek: 2, // Martes
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha B'],
        dayOfWeek: 3, // Miércoles
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha B'],
        dayOfWeek: 4, // Jueves
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha B'],
        dayOfWeek: 5, // Viernes
        startTime: '07:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 3500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha B'],
        dayOfWeek: 6, // Sábado
        startTime: '08:00:00',
        endTime: '23:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha B'],
        dayOfWeek: 0, // Domingo
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 4000.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha C (Mega Pádel Center - ID: 11)
      {
        courtId: courtIds['Mega Pádel Center - Cancha C'],
        dayOfWeek: 1, // Lunes
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha C'],
        dayOfWeek: 2, // Martes
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha C'],
        dayOfWeek: 3, // Miércoles
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha C'],
        dayOfWeek: 4, // Jueves
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha C'],
        dayOfWeek: 5, // Viernes
        startTime: '08:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha C'],
        dayOfWeek: 6, // Sábado
        startTime: '09:00:00',
        endTime: '22:00:00',
        isAvailable: true,
        price: 3600.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha C'],
        dayOfWeek: 0, // Domingo
        startTime: '09:00:00',
        endTime: '21:00:00',
        isAvailable: true,
        price: 3600.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Horarios para Cancha D (Mega Pádel Center - ID: 12)
      {
        courtId: courtIds['Mega Pádel Center - Cancha D'],
        dayOfWeek: 1, // Lunes
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha D'],
        dayOfWeek: 2, // Martes
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha D'],
        dayOfWeek: 3, // Miércoles
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha D'],
        dayOfWeek: 4, // Jueves
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha D'],
        dayOfWeek: 5, // Viernes
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 2800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha D'],
        dayOfWeek: 6, // Sábado
        startTime: '09:00:00',
        endTime: '21:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        courtId: courtIds['Mega Pádel Center - Cancha D'],
        dayOfWeek: 0, // Domingo
        startTime: '09:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        price: 3200.00,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('court_schedules', null, {});
  }
};
