import { notificationRepository, CreateNotificationData, NotificationType } from './notification.repository'

export const notificationService = {
  async getMyNotifications(userId: string, options: { page?: number; limit?: number } = {}) {
    return notificationRepository.findByUser(userId, options)
  },

  async getUnreadCount(userId: string) {
    return notificationRepository.countUnread(userId)
  },

  async markAsRead(id: string, userId: string) {
    await notificationRepository.markAsRead(id, userId)
  },

  async markAllAsRead(userId: string) {
    await notificationRepository.markAllAsRead(userId)
  },

  // Used internally by other services to create notifications
  async notify(data: CreateNotificationData) {
    return notificationRepository.create(data)
  },

  async notifyMany(notifications: CreateNotificationData[]) {
    return notificationRepository.createBulk(notifications)
  },
}

// Convenience functions for creating typed notifications from other domains
export const notifications = {
  matchStarted(userIds: string[], matchId: string) {
    return notificationRepository.createBulk(
      userIds.map((userId) => ({
        user_id: userId,
        type: 'match_started' as NotificationType,
        title: '¡El partido está completo!',
        body: 'El lobby está lleno. ¡Hora de jugar!',
        data: { match_id: matchId },
      })),
    )
  },

  matchCancelled(userIds: string[], matchId: string) {
    return notificationRepository.createBulk(
      userIds.map((userId) => ({
        user_id: userId,
        type: 'match_cancelled' as NotificationType,
        title: 'Partido cancelado',
        body: 'El partido al que estabas unido fue cancelado.',
        data: { match_id: matchId },
      })),
    )
  },

  scoreSubmitted(userIds: string[], matchId: string) {
    return notificationRepository.createBulk(
      userIds.map((userId) => ({
        user_id: userId,
        type: 'score_submitted' as NotificationType,
        title: 'Resultado cargado',
        body: 'Se cargó el resultado del partido. ¡Revisalo y confirmalo!',
        data: { match_id: matchId },
      })),
    )
  },

  scoreAccepted(userIds: string[], matchId: string, eloChange: number) {
    return notificationRepository.createBulk(
      userIds.map((userId) => ({
        user_id: userId,
        type: 'score_accepted' as NotificationType,
        title: 'Resultado confirmado',
        body: `El resultado fue aceptado. ${eloChange > 0 ? `+${eloChange}` : eloChange} ELO.`,
        data: { match_id: matchId, elo_change: eloChange },
      })),
    )
  },

  reservationConfirmed(userId: string, reservationId: string, courtName: string) {
    return notificationRepository.create({
      user_id: userId,
      type: 'reservation_confirmed' as NotificationType,
      title: 'Reserva confirmada',
      body: `Tu reserva en ${courtName} fue confirmada.`,
      data: { reservation_id: reservationId },
    })
  },

  reservationCancelled(userId: string, reservationId: string) {
    return notificationRepository.create({
      user_id: userId,
      type: 'reservation_cancelled' as NotificationType,
      title: 'Reserva cancelada',
      body: 'Tu reserva fue cancelada.',
      data: { reservation_id: reservationId },
    })
  },

  // Card #23 (R14): a partner used to be registered into a tournament team
  // without ever being told.
  tournamentTeamRegistered(partnerId: string, tournamentId: string, teamName: string | null) {
    return notificationRepository.create({
      user_id: partnerId,
      type: 'tournament_update' as NotificationType,
      title: 'Te inscribieron en un torneo',
      body: teamName
        ? `Te sumaron al equipo "${teamName}" en un torneo.`
        : 'Te sumaron a un equipo en un torneo.',
      data: { tournament_id: tournamentId },
    })
  },
}
