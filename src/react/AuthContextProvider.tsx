import {React, ReactNode, useEffect, useRef, useState} from "react";
import {AuthContext, AuthContextProps} from "./AuthContext";
import {setCurrentUser} from "./global-user";

type AuthContextProviderProps = {
  children: ReactNode,
  authRequired?: boolean,
  loaderComponent: ReactNode
  baseUrl?: string
}

export function AuthContextProvider({children, authRequired = false, loaderComponent = null, baseUrl = ''}: AuthContextProviderProps) {
  const [user, setUser] = useState<AuthContextProps['user']>(undefined)
  const [state, setState] = useState<AuthContextProps['state']>('pending')
  const userPromise = useRef<Promise<unknown | void> | undefined>(undefined)

  function logout() {
    window.location.assign(`${baseUrl}/auth/logout`)
  }

  function login() {
    const currentRelativeLocation = window.location.pathname + window.location.search + window.location.hash
    window.location.assign(`${baseUrl}/auth/login?redirectUrl=${encodeURIComponent(currentRelativeLocation)}`)
  }

  useEffect(() => {
    (userPromise.current ??= fetch(`${baseUrl}/auth/user`).then(res => res.ok && res.json()))
    .then(json => {
      if (json) {
        setUser(json)
        setCurrentUser(json)
        setState('authenticated')
      } else {
        setState('unauthenticated')
      }
    })
  }, [])

  useEffect(() => {
    if (authRequired && state === 'unauthenticated') {
      login()
    }
  }, [authRequired, state])

  return (
    <AuthContext.Provider value={{user, state, login, logout}}>
      {(authRequired && state !== 'authenticated' || !authRequired && state === 'pending') && loaderComponent}
      {(authRequired && state === 'authenticated' || !authRequired && state !== 'pending') && children}
    </AuthContext.Provider>
  )
}