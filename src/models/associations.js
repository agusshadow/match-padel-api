import User from './User.js';
import Club from './Club.js';
import Court from './Court.js';
import CourtSlot from './CourtSlot.js';
import CourtReservation from './CourtReservation.js';
import Match from './Match.js';

// Asociaciones entre modelos

// User associations
User.hasMany(CourtReservation, {
  foreignKey: 'userId',
  as: 'reservations'
});

User.hasMany(Match, {
  foreignKey: 'createdBy',
  as: 'createdMatches'
});

User.hasMany(Match, {
  foreignKey: 'team1Player1Id',
  as: 'matchesAsTeam1Player1'
});

User.hasMany(Match, {
  foreignKey: 'team1Player2Id',
  as: 'matchesAsTeam1Player2'
});

User.hasMany(Match, {
  foreignKey: 'team2Player1Id',
  as: 'matchesAsTeam2Player1'
});

User.hasMany(Match, {
  foreignKey: 'team2Player2Id',
  as: 'matchesAsTeam2Player2'
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

Court.hasMany(CourtSlot, {
  foreignKey: 'courtId',
  as: 'slots'
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

CourtReservation.belongsTo(CourtSlot, {
  foreignKey: 'slotId',
  as: 'slot'
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
  foreignKey: 'createdBy',
  as: 'creator'
});

Match.belongsTo(User, {
  foreignKey: 'team1Player1Id',
  as: 'team1Player1'
});

Match.belongsTo(User, {
  foreignKey: 'team1Player2Id',
  as: 'team1Player2'
});

Match.belongsTo(User, {
  foreignKey: 'team2Player1Id',
  as: 'team2Player1'
});

Match.belongsTo(User, {
  foreignKey: 'team2Player2Id',
  as: 'team2Player2'
});

// CourtSlot associations
CourtSlot.belongsTo(Court, {
  foreignKey: 'courtId',
  as: 'court'
});

CourtSlot.hasMany(CourtReservation, {
  foreignKey: 'slotId',
  as: 'reservations'
});

export {
  User,
  Club,
  Court,
  CourtSlot,
  CourtReservation,
  Match
};
