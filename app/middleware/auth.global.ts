export default defineNuxtRouteMiddleware((to) => {
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
