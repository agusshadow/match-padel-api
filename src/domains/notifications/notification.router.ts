import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './notification.controller'

const router = Router()

router.use(requireAuth)

// GET /api/v1/notifications — my notifications (paginated)
router.get('/', getMyNotifications)

// GET /api/v1/notifications/unread-count — unread count
router.get('/unread-count', getUnreadCount)

// PUT /api/v1/notifications/:id/read — mark one as read
router.put('/:id/read', markAsRead)

// PUT /api/v1/notifications/read-all — mark all as read
router.put('/read-all', markAllAsRead)

export default router
