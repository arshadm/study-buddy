export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/up') return

  const { loggedIn, user } = useUserSession()

  if (to.path === '/login') {
    if (loggedIn.value) {
      return navigateTo(user.value?.role === 'admin' ? '/admin' : '/start')
    }
    return
  }

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
