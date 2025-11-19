import User from './User.js';
import UserProfile from './UserProfile.js';
import UserLevel from './UserLevel.js';
import UserExperience from './UserExperience.js';
import Notification from './Notification.js';
import Club from './Club.js';
import Court from './Court.js';
import CourtSlot from './CourtSlot.js';
import CourtReservation from './CourtReservation.js';
import Match from './Match.js';
import MatchScore from './MatchScore.js';
import MatchScoreSet from './MatchScoreSet.js';
import Challenge from './Challenge.js';
import UserChallenge from './UserChallenge.js';
import Cosmetic from './Cosmetic.js';
import UserCosmetic from './UserCosmetic.js';
import Purchase from './Purchase.js';

// Asociaciones entre modelos

// User associations
User.hasOne(UserProfile, {
  foreignKey: 'userId',
  as: 'profile'
});

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

User.hasMany(MatchScore, {
  foreignKey: 'confirmedBy',
  as: 'confirmedScores'
});

User.hasMany(MatchScore, {
  foreignKey: 'rejectedBy',
  as: 'rejectedScores'
});

User.hasOne(UserLevel, {
  foreignKey: 'userId',
  as: 'level'
});

User.hasMany(UserExperience, {
  foreignKey: 'userId',
  as: 'experienceLog'
});

User.hasMany(Notification, {
  foreignKey: 'userId',
  as: 'notifications'
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

Match.hasOne(MatchScore, {
  foreignKey: 'matchId',
  as: 'score'
});

// MatchScore associations
MatchScore.belongsTo(Match, {
  foreignKey: 'matchId',
  as: 'match'
});

MatchScore.belongsTo(User, {
  foreignKey: 'confirmedBy',
  as: 'confirmer'
});

MatchScore.belongsTo(User, {
  foreignKey: 'rejectedBy',
  as: 'rejecter'
});

MatchScore.hasMany(MatchScoreSet, {
  foreignKey: 'matchScoreId',
  as: 'sets'
});

// MatchScoreSet associations
MatchScoreSet.belongsTo(MatchScore, {
  foreignKey: 'matchScoreId',
  as: 'matchScore'
});

// UserProfile associations
UserProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
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

// UserLevel associations
UserLevel.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// UserExperience associations
UserExperience.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Notification associations
Notification.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Challenge associations
Challenge.hasMany(UserChallenge, {
  foreignKey: 'challengeId',
  as: 'userChallenges'
});

Challenge.belongsTo(Cosmetic, {
  foreignKey: 'rewardCosmeticId',
  as: 'rewardCosmetic'
});

// UserChallenge associations
UserChallenge.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

UserChallenge.belongsTo(Challenge, {
  foreignKey: 'challengeId',
  as: 'challenge'
});

// Cosmetic associations
Cosmetic.hasMany(UserCosmetic, {
  foreignKey: 'cosmeticId',
  as: 'userCosmetics'
});

Cosmetic.hasMany(Purchase, {
  foreignKey: 'cosmeticId',
  as: 'purchases'
});

Cosmetic.belongsTo(Challenge, {
  foreignKey: 'challengeId',
  as: 'challenge'
});

// UserCosmetic associations
UserCosmetic.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

UserCosmetic.belongsTo(Cosmetic, {
  foreignKey: 'cosmeticId',
  as: 'cosmetic'
});

UserCosmetic.belongsTo(Purchase, {
  foreignKey: 'purchaseId',
  as: 'purchase'
});

UserCosmetic.belongsTo(Challenge, {
  foreignKey: 'challengeId',
  as: 'challenge'
});

// Purchase associations
Purchase.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

Purchase.belongsTo(Cosmetic, {
  foreignKey: 'cosmeticId',
  as: 'cosmetic'
});

// User associations adicionales
User.hasMany(UserChallenge, {
  foreignKey: 'userId',
  as: 'challenges'
});

User.hasMany(UserCosmetic, {
  foreignKey: 'userId',
  as: 'cosmetics'
});

User.hasMany(Purchase, {
  foreignKey: 'userId',
  as: 'purchases'
});

// UserProfile associations adicionales
UserProfile.belongsTo(Cosmetic, {
  foreignKey: 'equippedPaletteId',
  as: 'equippedPalette'
});

export {
  User,
  UserProfile,
  UserLevel,
  UserExperience,
  Notification,
  Club,
  Court,
  CourtSlot,
  CourtReservation,
  Match,
  MatchScore,
  MatchScoreSet,
  Challenge,
  UserChallenge,
  Cosmetic,
  UserCosmetic,
  Purchase
};
