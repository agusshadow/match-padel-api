'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener todos los matches completados y pendientes de confirmación
    const completedMatches = await queryInterface.sequelize.query(
      `SELECT id, status, created_at FROM matches WHERE status IN ('completed', 'pending_confirmation') ORDER BY id`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (completedMatches.length === 0) {
      console.log('⚠️ No hay partidos completados o pendientes de confirmación para crear scores');
      return;
    }

    // Obtener todos los participantes de estos matches
    const matchIds = completedMatches.map(m => m.id);
    const participants = await queryInterface.sequelize.query(
      `SELECT match_id, user_id, team_number FROM match_participants WHERE match_id IN (${matchIds.join(',')})`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // Agrupar participantes por match_id
    const matchParticipantsMap = {};
    participants.forEach(p => {
      if (!matchParticipantsMap[p.match_id]) {
        matchParticipantsMap[p.match_id] = { team1: [], team2: [] };
      }
      if (p.team_number === 1) matchParticipantsMap[p.match_id].team1.push(p.user_id);
      else matchParticipantsMap[p.match_id].team2.push(p.user_id);
    });

    // Filtrar matches que tengan al menos 2 jugadores por equipo (para un partido de padel estándar)
    const validMatches = completedMatches.filter(m => {
      const p = matchParticipantsMap[m.id];
      return p && p.team1.length >= 1 && p.team2.length >= 1;
    });

    if (validMatches.length === 0) {
      console.log('⚠️ No hay partidos con suficientes participantes para crear scores');
      return;
    }

    // Función para generar sets realistas
    const generateSets = (winnerTeam) => {
      const sets = [];
      const numSets = 3;
      let team1Wins = 0;
      let team2Wins = 0;
      const targetWins = 2;
      
      for (let set = 1; set <= numSets; set++) {
        let team1Score, team2Score;
        let shouldTeam1Win = winnerTeam === 1 ? (team1Wins < targetWins && (set < 3 || team2Wins < targetWins)) : (team1Wins >= targetWins || (team2Wins < targetWins && set > 2));
        
        // Simplified win logic for seeder
        if (winnerTeam === 1) {
            shouldTeam1Win = (set === 1 || (set === 2 && Math.random() > 0.3) || (set === 3 && team1Wins < 2));
        } else {
            shouldTeam1Win = (set === 1 && Math.random() < 0.3);
        }

        if (shouldTeam1Win && team1Wins < targetWins) {
          team1Score = 6; team2Score = Math.floor(Math.random() * 5); team1Wins++;
        } else if (team2Wins < targetWins) {
          team1Score = Math.floor(Math.random() * 5); team2Score = 6; team2Wins++;
        } else {
          break;
        }
        
        sets.push({ set_number: set, team1_score: team1Score, team2_score: team2Score });
        if (team1Wins === targetWins || team2Wins === targetWins) break;
      }
      return sets;
    };

    const matchScores = [];
    const matchScoreSets = [];

    for (const match of validMatches) {
      const winnerTeam = Math.random() > 0.5 ? 1 : 2;
      const p = matchParticipantsMap[match.id];
      
      let scoreStatus = match.status === 'completed' ? 'confirmed' : 'pending_confirmation';
      let confirmed_by = null;
      let confirmed_at = null;
      let confirmation_comment = null;
      
      if (scoreStatus === 'confirmed') {
        // Confirmado por un jugador del equipo 2 (o cualquier otro si equipo 2 está vacío)
        confirmed_by = p.team2.length > 0 ? p.team2[0] : p.team1[0];
        confirmed_at = new Date(match.created_at);
        confirmed_at.setHours(confirmed_at.getHours() + 1);
        confirmation_comment = 'Resultado confirmado correctamente';
      }
      
      matchScores.push({
        match_id: match.id,
        winner_team: winnerTeam,
        status: scoreStatus,
        confirmed_by,
        confirmation_comment,
        confirmed_at,
        created_at: match.created_at,
        updated_at: match.created_at
      });
    }

    if (matchScores.length > 0) {
      await queryInterface.bulkInsert('match_scores', matchScores);
      
      const matchScoreIds = await queryInterface.sequelize.query(
        `SELECT id, match_id, winner_team FROM match_scores WHERE match_id IN (${validMatches.map(m => m.id).join(',')})`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      for (const score of matchScoreIds) {
        const sets = generateSets(score.winner_team);
        const match = validMatches.find(m => m.id === score.match_id);
        
        for (const set of sets) {
          matchScoreSets.push({
            match_score_id: score.id,
            set_number: set.set_number,
            team1_score: set.team1_score,
            team2_score: set.team2_score,
            created_at: match.created_at,
            updated_at: match.created_at
          });
        }
      }
      
      if (matchScoreSets.length > 0) {
        await queryInterface.bulkInsert('match_score_sets', matchScoreSets);
      }
      
      console.log(`✅ ${matchScores.length} match scores y ${matchScoreSets.length} sets creados`);
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('match_score_sets', null, {});
    await queryInterface.bulkDelete('match_scores', null, {});
  }
};
