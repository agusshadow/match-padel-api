import type { Server } from 'socket.io'
import { logger } from './logger'

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket connected')

    // Unirse a una room
    socket.on('join', (room: string) => {
      socket.join(room)
      logger.debug({ socketId: socket.id, room }, 'Socket joined room')
    })

    // Salir de una room
    socket.on('leave', (room: string) => {
      socket.leave(room)
    })

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket disconnected')
    })
  })
}
