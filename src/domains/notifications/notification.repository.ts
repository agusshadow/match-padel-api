import { supabase } from '../../lib/supabase'

export type NotificationType =
  | 'match_invite'
  | 'match_started'
  | 'match_cancelled'
  | 'score_submitted'
  | 'score_accepted'
  | 'reservation_confirmed'
  | 'reservation_cancelled'
  | 'elo_updated'
  | 'tournament_update'

export interface CreateNotificationData {
  user_id: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
}

export const notificationRepository = {
  async findByUser(userId: string, { page = 0, limit = 20 }: { page?: number; limit?: number } = {}) {
    const from = page * limit
    const to = from + limit - 1

    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    return { items: data ?? [], total: count ?? 0 }
  },

  async countUnread(userId: string) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return count ?? 0
  },

  async markAsRead(id: string, userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  },

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
  },

  async create(data: CreateNotificationData) {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data ?? {},
        is_read: false,
      })
      .select()
      .single()

    if (error) throw error
    return notification
  },

  async createBulk(notifications: CreateNotificationData[]) {
    if (notifications.length === 0) return []

    const { data, error } = await supabase
      .from('notifications')
      .insert(
        notifications.map((n) => ({
          user_id: n.user_id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data ?? {},
          is_read: false,
        })),
      )
      .select()

    if (error) throw error
    return data ?? []
  },
}
