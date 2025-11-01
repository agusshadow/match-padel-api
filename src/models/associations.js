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

User.hasMany(Match, {
  foreignKey: 'createdBy',
  as: 'createdMatches'
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

Match.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
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
