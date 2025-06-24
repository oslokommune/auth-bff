import {React, ReactNode, useEffect, useRef, useState} from "react";
import {AuthContext, AuthContextProps} from "./AuthContext";
import {setCurrentUser} from "./global-user";

type AuthContextProviderProps = {
  children: ReactNode,
  authRequired?: boolean,
  loaderComponent: ReactNode
}

export function AuthContextProvider({children, authRequired = false, loaderComponent = null}: AuthContextProviderProps) {
  const [user, setUser] = useState<AuthContextProps['user']>(undefined)
  const [state, setState] = useState<AuthContextProps['state']>('pending')
  const userPromise = useRef<Promise<unknown | void> | undefined>(undefined)

  useEffect(() => {
    (userPromise.current ??= fetch('/auth/user').then(res => res.ok && res.json()))
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
      const currentRelativeLocation = window.location.pathname + window.location.search + window.location.hash
      window.location.assign(`/auth/login?redirectUrl=${encodeURIComponent(currentRelativeLocation)}`)
    }
  }, [authRequired, state])

  return (
    <AuthContext.Provider value={{user, state}}>
      {(authRequired && state !== 'authenticated' || !authRequired && state === 'pending') && loaderComponent}
      {(authRequired && state === 'authenticated' || !authRequired && state !== 'pending') && children}
    </AuthContext.Provider>
  )
}