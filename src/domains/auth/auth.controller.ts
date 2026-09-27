import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { supabase, supabaseAuth } from '../../lib/supabase'
import { AuthenticatedRequest } from '../../middleware/auth'
import { AppError, NotFoundError } from '../../types/errors'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced']),
  preferred_hand: z.enum(['drive', 'backhand']),
  phone: z.string().min(6).max(20).optional(),
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
    // email_confirm: false — the account stays unconfirmed until the user enters
    // the code from the "Confirm signup" email (see verifyEmail() below). Admin
    // API creations never trigger that email themselves, so it's sent explicitly
    // a few lines down via supabaseAuth.auth.resend().
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false,
      user_metadata: {
        first_name: body.first_name,
        last_name: body.last_name,
        username: body.username,
        skill_level: body.skill_level,
        preferred_hand: body.preferred_hand,
      },
    })

    if (authError || !authData.user) {
      throw new AppError(authError?.message ?? 'Failed to create auth user', 400)
    }

    // The DB trigger handle_new_user() already inserted public.users using user_metadata.
    // Update the row to ensure every field is correct (full_name is a generated
    // column and is never written to directly).
    const { data: user, error: userError } = await supabase
      .from('users')
      .update({
        first_name: body.first_name,
        last_name: body.last_name,
        username: body.username,
        skill_level: body.skill_level,
        preferred_hand: body.preferred_hand,
        phone: body.phone ?? null,
      })
      .eq('id', authData.user.id)
      .select()
      .single()

    if (userError || !user) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw new AppError('Failed to update user profile', 500)
    }

    // Send the "Confirm signup" email (6-digit code). Use the isolated
    // anon-key client (supabaseAuth), never `supabase` — see the comment on
    // that client in lib/supabase.ts.
    const { error: resendError } = await supabaseAuth.auth.resend({
      type: 'signup',
      email: body.email,
    })

    if (resendError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw new AppError('Failed to send verification email', 500)
    }

    // No session yet — the client calls supabase.auth.verifyOtp() directly
    // (anon key) with the code the user received, which both confirms the
    // email and returns the session in one step.
    res.status(201).json({
      success: true,
      data: {
        user,
        email_verification_required: true,
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

    if (error?.code === 'email_not_confirmed') {
      throw new AppError('Confirmá tu email antes de iniciar sesión', 403, 'EMAIL_NOT_CONFIRMED')
    }

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
