export async function requireRole(event: Parameters<typeof requireUserSession>[0], role: 'admin' | 'student') {
  const session = await requireUserSession(event)
  if (session.user?.role !== role) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
