'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Obtener todos los matches completados y pendientes de confirmación que estén completos (4 jugadores)
    const dialect = queryInterface.sequelize.getDialect();
    const query = dialect === 'postgres'
      ? `SELECT id, "team1Player1Id", "team1Player2Id", "team2Player1Id", "team2Player2Id", status, "createdAt"
       FROM matches 
       WHERE status IN ('completed', 'pending_confirmation')
       AND "team1Player1Id" IS NOT NULL
       AND "team1Player2Id" IS NOT NULL
       AND "team2Player1Id" IS NOT NULL
       AND "team2Player2Id" IS NOT NULL
       ORDER BY id`
      : `SELECT id, team1Player1Id, team1Player2Id, team2Player1Id, team2Player2Id, status, createdAt
       FROM matches 
       WHERE status IN ('completed', 'pending_confirmation')
       AND team1Player1Id IS NOT NULL
       AND team1Player2Id IS NOT NULL
       AND team2Player1Id IS NOT NULL
       AND team2Player2Id IS NOT NULL
       ORDER BY id`;
    
    const completedMatches = await queryInterface.sequelize.query(
      query,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (completedMatches.length === 0) {
      console.log('⚠️ No hay partidos completados o pendientes de confirmación para crear scores');
      return;
    }

    // Normalizar datos de matches (PostgreSQL devuelve nombres en minúsculas)
    const normalizedMatches = completedMatches.map(match => ({
      id: match.id,
      team1Player1Id: match.team1Player1Id || match.team1player1id,
      team1Player2Id: match.team1Player2Id || match.team1player2id,
      team2Player1Id: match.team2Player1Id || match.team2player1id,
      team2Player2Id: match.team2Player2Id || match.team2player2id,
      status: match.status,
      createdAt: match.createdAt || match.createdat
    }));

    // Función para generar sets realistas
    const generateSets = (winnerTeam) => {
      const sets = [];
      const numSets = 3; // Mejor de 3 sets
      
      let team1Wins = 0;
      let team2Wins = 0;
      
      // El ganador debe ganar 2 sets
      const targetWins = 2;
      
      for (let set = 1; set <= numSets; set++) {
        let team1Score, team2Score;
        
        // Determinar quién gana este set
        let shouldTeam1Win;
        if (winnerTeam === 1) {
          // Team 1 es el ganador, debe ganar 2 sets
          shouldTeam1Win = team1Wins < targetWins && set <= 3;
        } else {
          // Team 2 es el ganador, debe ganar 2 sets
          shouldTeam1Win = team2Wins >= targetWins || (team1Wins >= targetWins && set > 2);
        }
        
        // Asegurar que el ganador gane exactamente 2 sets
        if (winnerTeam === 1) {
          if (team1Wins < targetWins && set <= 2) {
            shouldTeam1Win = true;
          } else if (team1Wins >= targetWins) {
            shouldTeam1Win = false;
          }
        } else {
          if (team2Wins < targetWins && set <= 2) {
            shouldTeam1Win = false;
          } else if (team2Wins >= targetWins) {
            shouldTeam1Win = true;
          }
        }
        
        if (shouldTeam1Win) {
          // Team 1 gana este set
          team1Score = Math.floor(Math.random() * 2) + 6; // 6-7
          team2Score = Math.floor(Math.random() * 5) + 0; // 0-4
          team1Wins++;
        } else {
          // Team 2 gana este set
          team1Score = Math.floor(Math.random() * 5) + 0; // 0-4
          team2Score = Math.floor(Math.random() * 2) + 6; // 6-7
          team2Wins++;
        }
        
        sets.push({
          setNumber: set,
          team1Score: team1Score,
          team2Score: team2Score
        });
        
        // Si ya tenemos un ganador claro (2 sets ganados), podemos terminar
        if (team1Wins === targetWins || team2Wins === targetWins) {
          // Si quedan sets, el perdedor gana el último (opcional, pero más realista)
          if (set < numSets) {
            const finalSet = numSets;
            if (team1Wins === targetWins) {
              // Team 2 gana el set final
              sets.push({
                setNumber: finalSet,
                team1Score: Math.floor(Math.random() * 5) + 0,
                team2Score: Math.floor(Math.random() * 2) + 6
              });
            } else {
              // Team 1 gana el set final
              sets.push({
                setNumber: finalSet,
                team1Score: Math.floor(Math.random() * 2) + 6,
                team2Score: Math.floor(Math.random() * 5) + 0
              });
            }
          }
          break;
        }
      }
      
      return sets;
    };

    const matchScores = [];
    const matchScoreSets = [];

    for (const match of completedMatches) {
      // Decidir qué equipo ganó (aleatorio pero consistente)
      const winnerTeam = Math.random() > 0.5 ? 1 : 2;
      
      // Determinar el estado del score según el estado del match
      let scoreStatus;
      let confirmedBy = null;
      let rejectedBy = null;
      let confirmedAt = null;
      let rejectedAt = null;
      let confirmationComment = null;
      let rejectionComment = null;
      
      if (match.status === 'completed') {
        // Si el match está completado, el score debe estar confirmado
        scoreStatus = 'confirmed';
        
        // Seleccionar un jugador del equipo contrario (team 2) como quien confirmó
        // Puede ser team2Player1 o team2Player2
        confirmedBy = Math.random() > 0.5 ? match.team2Player1Id : match.team2Player2Id;
        confirmedAt = new Date(match.createdAt);
        confirmedAt.setHours(confirmedAt.getHours() + 1); // 1 hora después del match
        confirmationComment = 'Resultado confirmado correctamente';
      } else {
        // Si el match está pendiente de confirmación, el score está pendiente
        scoreStatus = 'pending_confirmation';
      }
      
      // Generar los sets
      const sets = generateSets(winnerTeam);
      
      // Crear el MatchScore
      const matchScore = {
        matchId: match.id,
        winnerTeam: winnerTeam,
        status: scoreStatus,
        confirmedBy: confirmedBy,
        rejectedBy: rejectedBy,
        confirmationComment: confirmationComment,
        rejectionComment: rejectionComment,
        confirmedAt: confirmedAt,
        rejectedAt: rejectedAt,
        createdAt: match.createdAt,
        updatedAt: match.createdAt
      };
      
      matchScores.push(matchScore);
    }

    // Insertar los MatchScores
    if (matchScores.length > 0) {
      const insertedScores = await queryInterface.bulkInsert('match_scores', matchScores, {
        returning: true
      });
      
      // Obtener los IDs de los scores insertados
      const matchIdsQuery = dialect === 'postgres'
        ? `SELECT id, "matchId" FROM match_scores WHERE "matchId" IN (${normalizedMatches.map(m => m.id).join(',')})`
        : `SELECT id, matchId FROM match_scores WHERE matchId IN (${normalizedMatches.map(m => m.id).join(',')})`;
      
      const matchScoreIds = await queryInterface.sequelize.query(
        matchIdsQuery,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      // Crear un mapa de matchId -> matchScoreId
      const matchIdToScoreId = {};
      matchScoreIds.forEach(score => {
        const matchId = score.matchId || score.matchid;
        matchIdToScoreId[matchId] = score.id;
      });
      
      // Crear los MatchScoreSets para cada score
      for (const match of normalizedMatches) {
        const matchScoreId = matchIdToScoreId[match.id];
        if (!matchScoreId) continue;
        
        // Determinar qué equipo ganó
        const winnerTeam = Math.random() > 0.5 ? 1 : 2;
        const sets = generateSets(winnerTeam);
        
        // Actualizar el winnerTeam en el MatchScore si aún no se hizo
        const updateQuery = dialect === 'postgres'
          ? `UPDATE match_scores SET "winnerTeam" = ${winnerTeam} WHERE id = ${matchScoreId}`
          : `UPDATE match_scores SET winnerTeam = ${winnerTeam} WHERE id = ${matchScoreId}`;
        
        await queryInterface.sequelize.query(updateQuery);
        
        // Crear los sets
        for (const set of sets) {
          matchScoreSets.push({
            matchScoreId: matchScoreId,
            setNumber: set.setNumber,
            team1Score: set.team1Score,
            team2Score: set.team2Score,
            createdAt: match.createdAt,
            updatedAt: match.createdAt
          });
        }
      }
      
      // Insertar los MatchScoreSets
      if (matchScoreSets.length > 0) {
        await queryInterface.bulkInsert('match_score_sets', matchScoreSets);
      }
      
      console.log(`✅ ${matchScores.length} match scores creados exitosamente`);
      console.log(`✅ ${matchScoreSets.length} match score sets creados exitosamente`);
      
      // Contar por estado
      const statusCount = matchScores.reduce((acc, score) => {
        acc[score.status] = (acc[score.status] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`📊 Distribución de scores:`);
      console.log(`   - pending_confirmation: ${statusCount.pending_confirmation || 0}`);
      console.log(`   - confirmed: ${statusCount.confirmed || 0}`);
      console.log(`   - rejected: ${statusCount.rejected || 0}`);
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('match_score_sets', null, {});
    await queryInterface.bulkDelete('match_scores', null, {});
  }
};

