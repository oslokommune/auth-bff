import {createContext} from "react";

//the user contains a subset of keys from the id-token claims (configured in `userClaims`)
export type User = {
  [k: string]: string | number
}

export type AuthContextProps = {
  state: 'pending' | 'authenticated' | 'unauthenticated' | 'expired' | 'error',
  user?: User
  login: () => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextProps | undefined>(undefined)

