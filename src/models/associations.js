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
import MatchParticipant from './MatchParticipant.js';
import MatchScore from './MatchScore.js';
import MatchScoreSet from './MatchScoreSet.js';
import Challenge from './Challenge.js';
import UserChallenge from './UserChallenge.js';
import Cosmetic from './Cosmetic.js';

// Asociaciones entre modelos

// User associations
User.hasOne(UserProfile, {
  foreignKey: 'user_id',
  as: 'profile'
});

User.hasMany(CourtReservation, {
  foreignKey: 'user_id',
  as: 'reservations'
});

User.hasMany(Match, {
  foreignKey: 'created_by',
  as: 'createdMatches'
});

User.hasMany(MatchParticipant, {
  foreignKey: 'user_id',
  as: 'matchParticipations'
});

User.hasMany(MatchScore, {
  foreignKey: 'confirmed_by',
  as: 'confirmedScores'
});

User.hasMany(MatchScore, {
  foreignKey: 'rejected_by',
  as: 'rejectedScores'
});

User.hasOne(UserLevel, {
  foreignKey: 'user_id',
  as: 'level'
});

User.hasMany(UserExperience, {
  foreignKey: 'user_id',
  as: 'experienceLog'
});

User.hasMany(Notification, {
  foreignKey: 'user_id',
  as: 'notifications'
});

// Club associations
Club.hasMany(Court, {
  foreignKey: 'club_id',
  as: 'courts'
});

// Court associations
Court.belongsTo(Club, {
  foreignKey: 'club_id',
  as: 'club'
});

Court.hasMany(CourtSlot, {
  foreignKey: 'court_id',
  as: 'slots'
});

Court.hasMany(CourtReservation, {
  foreignKey: 'court_id',
  as: 'reservations'
});

// CourtReservation associations
CourtReservation.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

CourtReservation.belongsTo(Court, {
  foreignKey: 'court_id',
  as: 'court'
});

CourtReservation.belongsTo(CourtSlot, {
  foreignKey: 'slot_id',
  as: 'slot'
});

CourtReservation.hasOne(Match, {
  foreignKey: 'reservation_id',
  as: 'match'
});

// Match associations
Match.belongsTo(CourtReservation, {
  foreignKey: 'reservation_id',
  as: 'reservation'
});

Match.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator'
});

Match.hasMany(MatchParticipant, {
  foreignKey: 'match_id',
  as: 'participants'
});

Match.hasOne(MatchScore, {
  foreignKey: 'match_id',
  as: 'score'
});

// MatchParticipant associations
MatchParticipant.belongsTo(Match, {
  foreignKey: 'match_id',
  as: 'match'
});

MatchParticipant.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// MatchScore associations
MatchScore.belongsTo(Match, {
  foreignKey: 'match_id',
  as: 'match'
});

MatchScore.belongsTo(User, {
  foreignKey: 'confirmed_by',
  as: 'confirmer'
});

MatchScore.belongsTo(User, {
  foreignKey: 'rejected_by',
  as: 'rejecter'
});

MatchScore.hasMany(MatchScoreSet, {
  foreignKey: 'match_score_id',
  as: 'sets'
});

// MatchScoreSet associations
MatchScoreSet.belongsTo(MatchScore, {
  foreignKey: 'match_score_id',
  as: 'matchScore'
});

// UserProfile associations
UserProfile.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// CourtSlot associations
CourtSlot.belongsTo(Court, {
  foreignKey: 'court_id',
  as: 'court'
});

CourtSlot.hasMany(CourtReservation, {
  foreignKey: 'slot_id',
  as: 'reservations'
});

// UserLevel associations
UserLevel.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// UserExperience associations
UserExperience.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// Notification associations
Notification.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// Challenge associations
Challenge.hasMany(UserChallenge, {
  foreignKey: 'challenge_id',
  as: 'userChallenges'
});

Challenge.belongsTo(Cosmetic, {
  foreignKey: 'reward_cosmetic_id',
  as: 'rewardCosmetic'
});

// UserChallenge associations
UserChallenge.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

UserChallenge.belongsTo(Challenge, {
  foreignKey: 'challenge_id',
  as: 'challenge'
});

// Cosmetic associations
Cosmetic.belongsTo(Challenge, {
  foreignKey: 'challenge_id',
  as: 'challenge'
});

// User associations adicionales
User.hasMany(UserChallenge, {
  foreignKey: 'user_id',
  as: 'challenges'
});


// UserProfile associations adicionales
UserProfile.belongsTo(Cosmetic, {
  foreignKey: 'equipped_palette_id',
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
  MatchParticipant,
  MatchScore,
  MatchScoreSet,
  Challenge,
  UserChallenge,
  Cosmetic
};
