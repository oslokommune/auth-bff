import {React, ReactNode, useEffect, useRef, useState} from "react";
import {AuthContext, AuthContextProps} from "./AuthContext";
import {setCurrentUser} from "./global-user";
import * as poller from './poller'

type AuthContextProviderProps = {
  children: ReactNode
  authRequired?: boolean
  loaderComponent: ReactNode
  baseUrl?: string
  pollInterval?: number
}

type User = {
  [k: string]: string
}

export function AuthContextProvider({
                                      children,
                                      authRequired = false,
                                      loaderComponent = null,
                                      baseUrl = '',
                                      pollInterval
                                    }: AuthContextProviderProps) {
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

  async function getUser(): Promise<User> {
    const res = await fetch(`${baseUrl}/auth/user`)
    if (res.ok) {
      try {
        return await res.json()
      } catch (e) {
        console.error('failed to parse user', e)
        return null
      }
    } else {
      return null
    }
  }

  function startPoller() {
    const setExpiredIfNoUser = (user: User) => {
      if(!user) setState('expired')
    }
    poller.start(getUser, setExpiredIfNoUser, pollInterval)
  }

  function stopPoller() {
    poller.stop()
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      startPoller()
    } else {
      stopPoller()
    }
  }

  useEffect(() => {
    if (pollInterval && pollInterval > 0 && state === 'authenticated') {
      startPoller()
      document.addEventListener('visibilitychange', onVisibilityChange)
      return () => {
        stopPoller()
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }
  }, [pollInterval, state])

  useEffect(() => {
    userPromise.current ??= getUser().then(user => {
      if (user) {
        setUser(user)
        setCurrentUser(user)
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

  function getChildComponent() {
    if(state === 'pending') {
      return loaderComponent
    } else if(state === 'authenticated' || state === 'expired') {
      return children
    } else if(state=== 'unauthenticated' && !authRequired) {
      return children
    } else {
      //here you should already have been redirected to login
      console.warn('not authenticated')
      return undefined
    }
  }
  useEffect(()=>{
    console.log('state', state)
  }, [state])

  return (
    <AuthContext.Provider value={{user, state, login, logout}}>
      {getChildComponent()}
    </AuthContext.Provider>
  )
}