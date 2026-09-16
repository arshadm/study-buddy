declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    displayName: string
    role: 'admin' | 'student'
  }

  interface UserSession {
    loggedInAt: number
  }
}

export {}
