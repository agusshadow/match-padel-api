export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]

const EXTENSIONS: Record<ImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function extensionFor(mimeType: ImageMimeType): string {
  return EXTENSIONS[mimeType]
}

/** Pure: do the file's magic bytes match the declared image type? A spoofed Content-Type fails. */
export function matchesImageSignature(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    case 'image/png':
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      )
    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
        buffer.subarray(8, 12).toString('latin1') === 'WEBP'
      )
    default:
      return false
  }
}
