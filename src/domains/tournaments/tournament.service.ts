import { tournamentRepository, CreateTournamentData } from './tournament.repository'
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../types/errors'

export const tournamentService = {
  async listTournaments(options: { status?: string; page?: number; limit?: number } = {}) {
    return tournamentRepository.findAll(options)
  },

  async getTournamentById(id: string) {
    const tournament = await tournamentRepository.findById(id)
    if (!tournament) throw new NotFoundError('Tournament')
    return tournament
  },

  async createTournament(data: Omit<CreateTournamentData, 'created_by'>, userId: string) {
    return tournamentRepository.create({ ...data, created_by: userId })
  },

  async registerTeam(
    tournamentId: string,
    userId: string,
    partner2Id: string,
    teamName?: string,
  ) {
    const tournament = await tournamentRepository.findById(tournamentId)
    if (!tournament) throw new NotFoundError('Tournament')

    if (tournament.status !== 'open') {
      throw new AppError('Tournament is not open for registration', 400, 'TOURNAMENT_NOT_OPEN')
    }

    // Check if already registered
    const alreadyRegistered = await tournamentRepository.isUserRegistered(tournamentId, userId)
    if (alreadyRegistered) {
      throw new ConflictError('You are already registered in this tournament')
    }

    const partner2Registered = await tournamentRepository.isUserRegistered(
      tournamentId,
      partner2Id,
    )
    if (partner2Registered) {
      throw new ConflictError('Your partner is already registered in this tournament')
    }

    // Check team capacity
    const teamCount = await tournamentRepository.getTeamCount(tournamentId)
    if (teamCount >= (tournament as any).max_teams) {
      throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL')
    }

    return tournamentRepository.registerTeam(tournamentId, userId, partner2Id, teamName)
  },

  async withdrawTeam(tournamentId: string, userId: string) {
    const tournament = await tournamentRepository.findById(tournamentId)
    if (!tournament) throw new NotFoundError('Tournament')

    if (tournament.status === 'completed') {
      throw new AppError('Cannot withdraw from a completed tournament', 400, 'TOURNAMENT_COMPLETED')
    }

    const registered = await tournamentRepository.isUserRegistered(tournamentId, userId)
    if (!registered) {
      throw new AppError('You are not registered in this tournament', 400, 'NOT_REGISTERED')
    }

    await tournamentRepository.withdrawTeam(tournamentId, userId)
    return { success: true }
  },

  async startTournament(tournamentId: string, userId: string) {
    const tournament = await tournamentRepository.findById(tournamentId)
    if (!tournament) throw new NotFoundError('Tournament')

    if ((tournament as any).created_by !== userId) {
      throw new ForbiddenError('Only the creator can start this tournament')
    }

    if (tournament.status !== 'open') {
      throw new AppError('Tournament is already started or completed', 400, 'INVALID_STATUS')
    }

    const teamCount = await tournamentRepository.getTeamCount(tournamentId)
    if (teamCount < 2) {
      throw new AppError('Need at least 2 teams to start', 400, 'NOT_ENOUGH_TEAMS')
    }

    return tournamentRepository.updateStatus(tournamentId, 'in_progress')
  },
}
