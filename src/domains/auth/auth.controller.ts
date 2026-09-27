import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { supabase, supabaseAuth } from '../../lib/supabase'
import { AuthenticatedRequest } from '../../middleware/auth'
import { AppError, NotFoundError } from '../../types/errors'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  username: z.string().min(3).regex(/^[a-z0-9_]+$/),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = RegisterSchema.parse(req.body)

    // Check username uniqueness
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', body.username)
      .single()

    if (existing) {
      throw new AppError('Username already taken', 409, 'USERNAME_TAKEN')
    }

    // Create Supabase auth user using admin API — pass metadata so the DB trigger
    // handle_new_user() inserts public.users with the correct full_name and username.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        username: body.username,
      },
    })

    if (authError || !authData.user) {
      throw new AppError(authError?.message ?? 'Failed to create auth user', 400)
    }

    // The DB trigger handle_new_user() already inserted public.users using user_metadata.
    // Update the row to ensure full_name and username are correct.
    const { data: user, error: userError } = await supabase
      .from('users')
      .update({ full_name: body.full_name, username: body.username })
      .eq('id', authData.user.id)
      .select()
      .single()

    if (userError || !user) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw new AppError('Failed to update user profile', 500)
    }

    // Sign in to get tokens. Use the isolated anon-key client (supabaseAuth),
    // never `supabase` — that would swap the shared service_role client's
    // Authorization header to this user's token for the rest of the process.
    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })

    if (sessionError || !sessionData.session) {
      throw new AppError('Failed to create session', 500)
    }

    res.status(201).json({
      success: true,
      data: {
        user,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = LoginSchema.parse(req.body)

    // Same isolated client as register() — see the comment there.
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })

    if (error || !data.session) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')
    }

    // Fetch user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select()
      .eq('id', data.user.id)
      .single()

    if (userError || !user) {
      throw new NotFoundError('User profile')
    }

    res.json({
      success: true,
      data: {
        user,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: { message: 'Logged out' } })
  } catch (err) {
    next(err)
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest

    const { data: user, error } = await supabase
      .from('users')
      .select()
      .eq('id', userId)
      .single()

    if (error || !user) {
      throw new NotFoundError('User profile')
    }

    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}
