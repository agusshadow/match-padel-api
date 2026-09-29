import { matchRepository, CreateMatchData, ScoreData } from './match.repository'
import { logger } from '../../lib/logger'
import { NotFoundError, ForbiddenError } from '../../types/errors'
import { AppError } from '../../types/errors'
import { notifications } from '../notifications/notification.service'

const ELO_WIN_DELTA = 15
const ELO_LOSS_DELTA = -15

export const matchService = {
  async getMyMatches(userId: string, options: { status?: string; type?: string; page?: number }) {
    return matchRepository.findByUser(userId, options)
  },

  async getMatchById(id: string) {
    return matchRepository.findById(id)
  },

  async createMatch(data: CreateMatchData, createdBy: string) {
    return matchRepository.create(data, createdBy)
  },

  async joinByLobbyUrl(lobbyUrl: string, userId: string) {
    const match = await matchRepository.findByLobbyUrl(lobbyUrl)

    if (!match) {
      throw new NotFoundError('Match')
    }

    if (match.status !== 'waiting') {
      throw new AppError('Match is not open for joining', 400, 'MATCH_NOT_OPEN')
    }

    const players = (match as any).match_players ?? []

    const alreadyIn = players.some((p: any) => p.user_id === userId)
    if (alreadyIn) {
      throw new AppError('Already in this match', 400, 'ALREADY_JOINED')
    }

    if (players.length >= 4) {
      throw new AppError('Match is full', 400, 'MATCH_FULL')
    }

    const team1Count = players.filter((p: any) => p.team === 1).length
    const team2Count = players.filter((p: any) => p.team === 2).length
    const team = team1Count <= team2Count ? 1 : 2

    await matchRepository.join(match.id, userId, team)

    if (players.length + 1 >= 4) {
      await matchRepository.updateStatus(match.id, 'in_progress')
      // Notify all players that the match is ready
      const allPlayerIds = [...players.map((p: any) => p.user_id), userId]
      notifications.matchStarted(allPlayerIds, match.id).catch((err) => logger.error(err, 'Failed to send matchStarted notification'))
    }

    return matchRepository.findById(match.id)
  },

  async submitScore(matchId: string, score: ScoreData, userId: string) {
    const match = await matchRepository.findById(matchId)

    if (!match) {
      throw new NotFoundError('Match')
    }

    if (match.status === 'cancelled') {
      throw new AppError('Match is cancelled', 400, 'MATCH_CANCELLED')
    }

    if (match.score_status === 'accepted') {
      throw new AppError('Score already accepted', 400, 'SCORE_ACCEPTED')
    }

    const userTeam = await matchRepository.getPlayerTeam(matchId, userId)
    if (!userTeam) {
      throw new ForbiddenError('Not a player in this match')
    }

    const result = await matchRepository.submitScore(matchId, score, userId)

    // Notify other players that a score was submitted
    const players = await matchRepository.getPlayers(matchId)
    const otherPlayerIds = players
      .filter((p: any) => p.user_id !== userId)
      .map((p: any) => p.user_id)
    if (otherPlayerIds.length > 0) {
      notifications.scoreSubmitted(otherPlayerIds, matchId).catch((err) => logger.error(err, 'Failed to send scoreSubmitted notification'))
    }

    return result
  },

  async acceptScore(matchId: string, userId: string) {
    const match = await matchRepository.findById(matchId)

    if (!match) {
      throw new NotFoundError('Match')
    }

    if (match.score_status !== 'pending') {
      throw new AppError('No pending score to accept', 400, 'NO_PENDING_SCORE')
    }

    const userTeam = await matchRepository.getPlayerTeam(matchId, userId)
    if (!userTeam) {
      throw new ForbiddenError('Not a player in this match')
    }

    if (match.score_submitted_by === userId) {
      throw new ForbiddenError('You cannot accept the score you submitted yourself')
    }

    // Determine winner by comparing sets won
    const score1 = (match.score_team1 as number[]) ?? []
    const score2 = (match.score_team2 as number[]) ?? []

    let sets1 = 0
    let sets2 = 0
    for (let i = 0; i < Math.min(score1.length, score2.length); i++) {
      if (score1[i] > score2[i]) sets1++
      else if (score2[i] > score1[i]) sets2++
    }

    const winnerTeam = sets1 > sets2 ? 1 : 2

    const updatedMatch = await matchRepository.acceptScore(matchId, winnerTeam)

    if (match.is_ranked) {
      await this._applyEloChanges(matchId, winnerTeam)
    }

    // Notify all players that the score was accepted
    const players = await matchRepository.getPlayers(matchId)
    const playerIds = players.map((p: any) => p.user_id)
    // ELO change differs per player; send generic notification
    notifications.scoreAccepted(playerIds, matchId, 0).catch((err) => logger.error(err, 'Failed to send scoreAccepted notification'))

    return updatedMatch
  },

  // Card #51: the player on the other team rejects a score loaded wrong (or
  // in bad faith) instead of it either being force-accepted or stuck forever.
  async rejectScore(matchId: string, userId: string) {
    const match = await matchRepository.findById(matchId)

    if (!match) {
      throw new NotFoundError('Match')
    }

    if (match.score_status !== 'pending') {
      throw new AppError('No pending score to reject', 400, 'NO_PENDING_SCORE')
    }

    const userTeam = await matchRepository.getPlayerTeam(matchId, userId)
    if (!userTeam) {
      throw new ForbiddenError('Not a player in this match')
    }

    if (match.score_submitted_by === userId) {
      throw new ForbiddenError('You cannot reject the score you submitted yourself')
    }

    return matchRepository.rejectScore(matchId)
  },

  async _applyEloChanges(matchId: string, winnerTeam: number) {
    const players = await matchRepository.getPlayers(matchId)

    for (const player of players) {
      const isWinner = player.team === winnerTeam
      const delta = isWinner ? ELO_WIN_DELTA : ELO_LOSS_DELTA
      const eloBefore = await matchRepository.getUserElo(player.user_id)
      const eloAfter = Math.max(0, eloBefore + delta)

      await matchRepository.updateUserElo(player.user_id, eloAfter)
      await matchRepository.insertEloHistory({
        user_id: player.user_id,
        match_id: matchId,
        elo_before: eloBefore,
        elo_after: eloAfter,
        delta,
      })
    }
  },

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
}
