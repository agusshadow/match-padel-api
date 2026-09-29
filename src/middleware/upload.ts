import multer from 'multer'
import { ValidationError } from '../types/errors'

// Card #53: profile picture upload. Memory storage — the file never touches
// disk, it's uploaded straight to Supabase Storage from the buffer. Limits
// mirror the `avatars` bucket's own file_size_limit/allowed_mime_types so a
// rejected upload fails fast in Express instead of round-tripping to Storage
// first.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new ValidationError('Avatar must be a JPEG, PNG or WebP image'))
      return
    }
    cb(null, true)
  },
}).single('avatar')
