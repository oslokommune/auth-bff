import type {IDToken, TokenEndpointResponse} from "openid-client";

declare module 'express-session' {
  interface SessionData {
    tokenResponse: TokenEndpointResponse
    codeVerifier: string
    stateKey: string
    stateValue: { redirectUrl: string }
    "idp-sid": string
    userClaims: Partial<IDToken>
    accessTokenExpiresAt?: number
  }
  interface Store {
    destroyByIdpSid?: (id: string) => Promise<void>
  }
}

declare module 'express' {
  interface Request {
    tokenResponse: TokenEndpointResponse
    destroySessionByIdpSid?: (id: string) => Promise<void>
  }
}