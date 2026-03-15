const DICEBEAR_BASE = 'https://api.dicebear.com/7.x/shapes/svg'

export function buildDicebearUrl(seed = 'user', size = 80) {
  const safeSeed = encodeURIComponent(String(seed || 'user'))
  const safeSize = Number.isFinite(size) ? Math.max(16, Math.min(512, Math.floor(size))) : 80
  return `${DICEBEAR_BASE}?seed=${safeSeed}&size=${safeSize}&radius=50`
}

export function resolveAvatarUrl(avatarUrl: string, seed: string | undefined, size = 80) {
  const trimmed = typeof avatarUrl === 'string' ? avatarUrl.trim() : ''
  if (trimmed) {
    return trimmed
  }
  return buildDicebearUrl(seed, size)
}