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

// Card #67: club application documents (private `club-documents` bucket). Same
// memory storage; limits mirror the bucket's file_size_limit/allowed_mime_types.
const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export const uploadClubDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      cb(new ValidationError('Document must be a PDF, JPEG, PNG or WebP file'))
      return
    }
    cb(null, true)
  },
}).single('file')

// Card #78: gamification catalog images (public `catalog-assets` bucket). Only
// png/jpg/webp (no SVG: it can carry scripts), up to 2 MB; the same limits are
// set on the bucket. The route also checks the magic bytes.
const CATALOG_ASSET_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const uploadCatalogAsset = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!CATALOG_ASSET_MIME_TYPES.includes(file.mimetype)) {
      cb(new ValidationError('Image must be a JPEG, PNG or WebP file'))
      return
    }
    cb(null, true)
  },
}).single('file')
