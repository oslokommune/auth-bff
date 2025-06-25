import {createContext} from "react";

export type AuthContextProps = {
  state: 'pending' | 'authenticated' | 'unauthenticated',
  user?: {pid: string}
  login: () => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextProps | undefined>(undefined)

