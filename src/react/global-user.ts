let currentUser: object

export function getCurrentUser() {
  return currentUser
}

export function setCurrentUser(user: object) {
  currentUser = user
}

