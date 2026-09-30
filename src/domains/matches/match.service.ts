import { matchRepository, ScoreData } from './match.repository'
import type { CreateMatchRequest } from './match.validator'
import * as reservationRepository from '../reservations/reservation.repository'
import {
  createMatchPaymentPreference,
  refundPayment,
  findApprovedPayment,
  findApprovedPaymentsForReservation,
} from '../payments/payment.service'
import { logger } from '../../lib/logger'
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../types/errors'
import { AppError } from '../../types/errors'
import { notifications } from '../notifications/notification.service'

const REFUND_CUTOFF_HOURS = 24

export const matchService = {
  async getMyMatches(userId: string, options: { status?: string; type?: string; page?: number }) {
    return matchRepository.findByUser(userId, options)
  },

  // Card #23 (R14): a match's detail — including the other players' info —
  // was readable by anyone who knew its id, participant or not.
  async getMatchById(id: string, userId: string) {
    const match = await matchRepository.findById(id)
    if (!match) {
      throw new NotFoundError('Match')
    }

    const players = (match as any).match_players ?? []
    const isParticipant = players.some((p: any) => p.user_id === userId)
    const isCreator = (match as any).created_by === userId
    if (!isParticipant && !isCreator) {
      throw new ForbiddenError('You can only view matches you participate in')
    }

    return match
  },

  // Card #57: a match is now tied to a real court reservation, and the price is
  // split 4 ways. The creator, like every joiner, pays their 1/4 share — they
  // aren't added as a player until the payment is confirmed (see
  // payment.service.ts's webhook handling), so this returns a checkout link
  // instead of a ready-to-play match.
  async createMatch(data: CreateMatchRequest, createdBy: string) {
    const startTime = new Date(data.start_time)
    const endTime = new Date(data.end_time)
    const now = new Date()

    if (startTime <= now) {
      throw new ValidationError('start_time must be in the future')
    }
    if (endTime <= startTime) {
      throw new ValidationError('end_time must be after start_time')
    }

    const court = await reservationRepository.getCourtForBooking(data.court_id)
    if (!court) {
      throw new NotFoundError('Court')
    }
    if (!court.is_active) {
      throw new ValidationError('This court is not available for reservations')
    }

    const overlap = await reservationRepository.hasOverlap(
      data.court_id,
      data.start_time,
      data.end_time,
    )
    if (overlap) {
      throw new ConflictError('This time slot conflicts with an existing reservation')
    }

    const durationHours =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    const totalPrice = Math.round(court.price_per_hour * durationHours * 100) / 100

    const reservation = await reservationRepository.create({
      court_id: data.court_id,
      start_time: data.start_time,
      end_time: data.end_time,
      userId: createdBy,
      clubId: court.club_id,
      totalPrice,
    })

    const match = await matchRepository.create(
      {
        type: data.type,
        is_ranked: data.is_ranked,
        club_id: court.club_id,
        reservation_id: reservation.id,
      },
      createdBy,
    )

    let payment
    try {
      payment = await createMatchPaymentPreference(match.id, createdBy)
    } catch (err) {
      // Don't leave an orphaned match + reservation behind if the creator's own
      // payment preference fails to create.
      await matchRepository.cancel(match.id).catch(() => {})
      await reservationRepository.updateStatus(reservation.id, 'cancelled').catch(() => {})
      throw err
    }

    return { match, payment }
  },

  // Card #57: replaces immediate joining — reserves nothing on its own, just
  // hands back a checkout link for the player's 1/4 share. The player only
  // becomes a match_players row once the webhook confirms that payment.
  async joinByLobbyUrl(lobbyUrl: string, userId: string) {
    const match = await matchRepository.findByLobbyUrl(lobbyUrl)

    if (!match) {
      throw new NotFoundError('Match')
    }

    return createMatchPaymentPreference(match.id, userId)
  },

  // Card #58: replaces the old submit → accept/reject flow. Each team submits
  // its own claimed score independently; the DB function
  // (submit_match_score_draft) confirms it automatically once both teams'
  // drafts agree exactly, or clears both and counts a mismatch otherwise.
  // Ranked and friendly matches go through the exact same flow — the only
  // difference is whether the confirmed result touches ELO (is_ranked).
  async submitScore(matchId: string, score: ScoreData, userId: string) {
    const match = await matchRepository.findById(matchId)

    if (!match) {
      throw new NotFoundError('Match')
    }

    if (match.status === 'cancelled') {
      throw new AppError('Match is cancelled', 400, 'MATCH_CANCELLED')
    }

    const userTeam = await matchRepository.getPlayerTeam(matchId, userId)
    if (!userTeam) {
      throw new ForbiddenError('Not a player in this match')
    }

    let result
    try {
      result = await matchRepository.submitScoreDraft(matchId, userTeam, score)
    } catch (err) {
      const message = (err as Error).message ?? ''
      if (message.includes('MATCH_PERMANENTLY_DISPUTED')) {
        throw new AppError(
          'This match is permanently disputed after repeated mismatched results',
          400,
          'MATCH_PERMANENTLY_DISPUTED',
        )
      }
      if (message.includes('SCORE_ALREADY_ACCEPTED')) {
        throw new AppError('Score already accepted', 400, 'SCORE_ACCEPTED')
      }
      throw err
    }

    const players = await matchRepository.getPlayers(matchId)
    const otherPlayerIds = players
      .filter((p: any) => p.user_id !== userId)
      .map((p: any) => p.user_id)

    if (result.score_status === 'accepted') {
      const playerIds = players.map((p: any) => p.user_id)
      notifications.scoreAccepted(playerIds, matchId, 0).catch((err) =>
        logger.error(err, 'Failed to send scoreAccepted notification'),
      )
    } else if (otherPlayerIds.length > 0) {
      // Covers both "waiting on the other team's draft" and "drafts didn't
      // match, try again" — the response body's score_status/dispute count
      // already tells the client which one it is.
      notifications.scoreSubmitted(otherPlayerIds, matchId).catch((err) =>
        logger.error(err, 'Failed to send scoreSubmitted notification'),
      )
    }

    return result
  },

  // Card #57: the creator cancelling the whole match now also releases the
  // court and applies the same 24h refund window as a player leaving —
  // everyone who already paid gets refunded if there's still more than a day
  // to go, nobody does if the match is being cancelled last-minute.
  async cancelMatch(matchId: string, userId: string) {
    const match = await matchRepository.findById(matchId)

    if (!match) {
      throw new NotFoundError('Match')
    }

    if (match.created_by !== userId) {
      throw new ForbiddenError('Only the creator can cancel this match')
    }

    if (match.status === 'completed') {
      throw new AppError('Cannot cancel a completed match', 400, 'MATCH_COMPLETED')
    }

    if (match.reservation_id) {
      const reservation = await reservationRepository.findById(match.reservation_id)
      if (reservation) {
        const hoursUntilStart =
          (new Date(reservation.start_time).getTime() - Date.now()) / (1000 * 60 * 60)

        if (hoursUntilStart >= REFUND_CUTOFF_HOURS) {
          const approvedPayments = await findApprovedPaymentsForReservation(match.reservation_id)
          for (const payment of approvedPayments) {
            await refundPayment(payment.id).catch((err) =>
              logger.error(err, `Failed to refund payment ${payment.id} on match cancel`),
            )
          }
        }

        await reservationRepository.updateStatus(match.reservation_id, 'cancelled')
      }
    }

    const cancelledMatch = await matchRepository.cancel(matchId)

    // Notify other players
    const players = await matchRepository.getPlayers(matchId)
    const otherPlayerIds = players
      .filter((p: any) => p.user_id !== userId)
      .map((p: any) => p.user_id)
    if (otherPlayerIds.length > 0) {
      notifications.matchCancelled(otherPlayerIds, matchId).catch((err) => logger.error(err, 'Failed to send matchCancelled notification'))
    }

    return cancelledMatch
  },

  // Card #57 (new): a player leaves their own spot instead of the creator
  // cancelling everything. >24h before the match, they get their share back;
  // under 24h, no refund — either way the spot reopens for someone else. If
  // the match had already filled to 4/4, it drops back to `waiting` (the
  // reservation itself stays alive, just short one player) instead of being
  // cancelled outright.
  async leaveMatch(matchId: string, userId: string) {
    const match = await matchRepository.findById(matchId)

    if (!match) {
      throw new NotFoundError('Match')
    }

    if (match.status === 'completed' || match.status === 'cancelled') {
      throw new AppError('This match already ended', 400, 'MATCH_ENDED')
    }

    const isPlayer = await matchRepository.isPlayer(matchId, userId)
    if (!isPlayer) {
      throw new ForbiddenError('You are not part of this match')
    }

    let refunded = false

    if (match.reservation_id) {
      const reservation = await reservationRepository.findById(match.reservation_id)
      if (reservation) {
        const hoursUntilStart =
          (new Date(reservation.start_time).getTime() - Date.now()) / (1000 * 60 * 60)

        const payment = await findApprovedPayment(match.reservation_id, userId)
        if (payment && hoursUntilStart >= REFUND_CUTOFF_HOURS) {
          refunded = await refundPayment(payment.id)
        }
      }
    }

    await matchRepository.removePlayer(matchId, userId)

    if (match.status === 'in_progress') {
      await matchRepository.updateStatus(matchId, 'waiting')
      if (match.reservation_id) {
        await reservationRepository.updateStatus(match.reservation_id, 'pending')
      }
    }

    const players = await matchRepository.getPlayers(matchId)
    const otherPlayerIds = players
      .filter((p: any) => p.user_id !== userId)
      .map((p: any) => p.user_id)
    if (otherPlayerIds.length > 0) {
      notifications.matchCancelled(otherPlayerIds, matchId).catch((err) =>
        logger.error(err, 'Failed to send player-left notification'),
      )
    }

    return { refunded }
  },

  // Called by the scheduled job (src/jobs/auto-cancel-unfilled-matches.job.ts).
  // A match whose court time already started without reaching 4 confirmed
  // players is never going to be played — free the court and refund whoever
  // already paid their share. Returns the cancelled match ids, for logging.
  async autoCancelUnfilledMatches(): Promise<string[]> {
    const stale = await matchRepository.findUnfilledPastMatches()
    const cancelledIds: string[] = []

    for (const { id, reservation_id } of stale) {
      const approvedPayments = await findApprovedPaymentsForReservation(reservation_id)
      for (const payment of approvedPayments) {
        await refundPayment(payment.id).catch((err) =>
          logger.error(err, `Failed to refund payment ${payment.id} on auto-cancel`),
        )
      }

      await reservationRepository.updateStatus(reservation_id, 'cancelled')
      await matchRepository.cancel(id)

      const players = await matchRepository.getPlayers(id)
      const playerIds = players.map((p: any) => p.user_id)
      if (playerIds.length > 0) {
        notifications.matchCancelled(playerIds, id).catch((err) =>
          logger.error(err, 'Failed to send auto-cancel notification'),
        )
      }

      cancelledIds.push(id)
    }

    return cancelledIds
  },
}
