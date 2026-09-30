import { supabase } from '../../lib/supabase'

export interface ChatMessage {
  id: string
  match_id: string
  user_id: string
  message: string
  created_at: string
  users: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

const MESSAGE_SELECT = 'id, match_id, user_id, message, created_at, users (id, username, full_name, avatar_url)'

export const chatRepository = {
  async findByMatch(matchId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('match_chats')
      .select(MESSAGE_SELECT)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []) as unknown as ChatMessage[]
  },

  async create(matchId: string, userId: string, message: string): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('match_chats')
      .insert({ match_id: matchId, user_id: userId, message })
      .select(MESSAGE_SELECT)
      .single()

    if (error) throw error
    return data as unknown as ChatMessage
  },
}
