import {useContext} from "react";
import {AuthContext} from "./AuthContext";

export function useAuthContext(required: boolean = false) {
  const authContext = useContext(AuthContext)
  if (required && authContext?.state === 'unauthenticated') {
    window.location.assign('/auth/login')
    return
  }
  return authContext
}