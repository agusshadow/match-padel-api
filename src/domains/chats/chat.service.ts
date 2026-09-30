import { chatRepository } from './chat.repository'
import { matchRepository } from '../matches/match.repository'
import { NotFoundError, ForbiddenError } from '../../types/errors'

// Card #59: a simple chat scoped to a match's 4 players — for coordinating
// before the match, and for sorting out a disputed score afterward. Plain
// REST, no realtime infrastructure (Socket.io isn't wired up in this
// deployment yet — see src/lib/socket.ts); the client polls.
async function assertParticipant(matchId: string, userId: string): Promise<void> {
  const match = await matchRepository.findById(matchId)
  if (!match) {
    throw new NotFoundError('Match')
  }
  const isPlayer = await matchRepository.isPlayer(matchId, userId)
  if (!isPlayer) {
    throw new ForbiddenError('You can only view the chat of matches you participate in')
  }
}

export const chatService = {
  async getMessages(matchId: string, userId: string) {
    await assertParticipant(matchId, userId)
    return chatRepository.findByMatch(matchId)
  },

  async sendMessage(matchId: string, userId: string, message: string) {
    await assertParticipant(matchId, userId)
    return chatRepository.create(matchId, userId, message)
  },
}
