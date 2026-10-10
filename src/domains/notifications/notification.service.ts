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

  // Card #71: the club cancelled a reservation (or the match played on it).
  // `refunded` tells the player whether money is being returned.
  reservationCancelledByClub(
    userIds: string[],
    input: { reservationId: string; matchId: string | null; when: string; courtName: string; reason: string | null; refunded: boolean },
  ) {
    const reason = input.reason ? ` Motivo: ${input.reason}.` : ''
    const refund = input.refunded ? ' Se te reembolsa el importe pagado.' : ''
    return notificationRepository.createBulk(
      userIds.map((userId) => ({
        user_id: userId,
        type: 'reservation_cancelled' as NotificationType,
        title: 'Reserva cancelada por el club',
        body: `El club canceló la reserva del ${input.when} en ${input.courtName}.${reason}${refund}`,
        data: {
          reservation_id: input.reservationId,
          match_id: input.matchId,
          cancelled_by: 'club',
          reason: input.reason,
          refunded: input.refunded,
        },
      })),
    )
  },

  // Card #71: the club moved a reservation to another court and/or time.
  reservationMoved(
    userIds: string[],
    input: {
      reservationId: string
      matchId: string | null
      courtName: string
      from: { when: string; court_id: string; start_time: string; end_time: string }
      to: { when: string; court_id: string; start_time: string; end_time: string }
    },
  ) {
    return notificationRepository.createBulk(
      userIds.map((userId) => ({
        user_id: userId,
        type: 'system' as NotificationType,
        title: 'Tu reserva fue reprogramada',
        body: `El club movió tu reserva del ${input.from.when} al ${input.to.when} en ${input.courtName}.`,
        data: {
          kind: 'reservation_moved',
          reservation_id: input.reservationId,
          match_id: input.matchId,
          from: input.from,
          to: input.to,
        },
      })),
    )
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
