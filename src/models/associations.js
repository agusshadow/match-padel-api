import User from './User.js';
import Club from './Club.js';
import Court from './Court.js';
import CourtSchedule from './CourtSchedule.js';
import CourtReservation from './CourtReservation.js';
import Match from './Match.js';

// Asociaciones entre modelos

// User associations
User.hasMany(CourtReservation, {
  foreignKey: 'userId',
  as: 'reservations'
});

User.hasMany(Match, {
  foreignKey: 'player1Id',
  as: 'matchesAsPlayer1'
});

User.hasMany(Match, {
  foreignKey: 'player2Id',
  as: 'matchesAsPlayer2'
});

User.hasMany(Match, {
  foreignKey: 'player3Id',
  as: 'matchesAsPlayer3'
});

User.hasMany(Match, {
  foreignKey: 'player4Id',
  as: 'matchesAsPlayer4'
});

// Club associations
Club.hasMany(Court, {
  foreignKey: 'clubId',
  as: 'courts'
});

// Court associations
Court.belongsTo(Club, {
  foreignKey: 'clubId',
  as: 'club'
});

Court.hasMany(CourtSchedule, {
  foreignKey: 'courtId',
  as: 'schedules'
});

Court.hasMany(CourtReservation, {
  foreignKey: 'courtId',
  as: 'reservations'
});

// CourtReservation associations
CourtReservation.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

CourtReservation.belongsTo(Court, {
  foreignKey: 'courtId',
  as: 'court'
});

CourtReservation.hasOne(Match, {
  foreignKey: 'reservationId',
  as: 'match'
});

// Match associations
Match.belongsTo(CourtReservation, {
  foreignKey: 'reservationId',
  as: 'reservation'
});

Match.belongsTo(User, {
  foreignKey: 'player1Id',
  as: 'player1'
});

Match.belongsTo(User, {
  foreignKey: 'player2Id',
  as: 'player2'
});

Match.belongsTo(User, {
  foreignKey: 'player3Id',
  as: 'player3'
});

Match.belongsTo(User, {
  foreignKey: 'player4Id',
  as: 'player4'
});

// CourtSchedule associations
CourtSchedule.belongsTo(Court, {
  foreignKey: 'courtId',
  as: 'court'
});

export {
  User,
  Club,
  Court,
  CourtSchedule,
  CourtReservation,
  Match
};
