import { Request, Response, NextFunction } from 'express'
import { supabase } from '@/core/database/supabase'

type Role = 'user' | 'admin' | 'super_admin'

export const requireRole = (roles: Role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token requerido' } })
      return
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token inválido' } })
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !roles.includes(profile.role as Role)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Sin permisos suficientes' } })
      return
    }

    res.locals.user = { ...user, role: profile.role }
    next()
  }
}
