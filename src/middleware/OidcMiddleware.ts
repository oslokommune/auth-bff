import * as openIdClient from "openid-client";
import {OpenIdConfigManager} from "../OpenIdConfigManager.js";
import {redact} from "../utils.js";
import {BffConfig} from "../config/config.js";
import type {Request, Response, NextFunction} from 'express'
import {IDToken, TokenEndpointResponse, TokenEndpointResponseHelpers} from "openid-client"

export class LoginError extends Error {
  originalError: Error
  constructor(message: string,  original: Error) {
    super(message)
    this.originalError = original
  }
}

export class OidcMiddleware {
  #configManager: OpenIdConfigManager
  #bffConfig: BffConfig
  #refreshPromises = {}

  /**
   * @private
   * @param config
   * @param configManager
   */
  constructor(config: BffConfig, configManager: OpenIdConfigManager) {
    this.#configManager = configManager
    this.#bffConfig = config
  }

  async #openIdConfig() {
    if(!this.#configManager.openIdConfig) {
      await this.#configManager.init()
    }
    return this.#configManager.openIdConfig
  }

  static async create(config: BffConfig) {
    const configManager = new OpenIdConfigManager(config)
    try {
      await configManager.init()
    } catch (e) {
      console.error("Initial OpenID Config initialization failed", e)
      if(config.requireOpenIdConfigAtStartup) {
        throw e
      }
    }
    return new OidcMiddleware(config, configManager)

  }

  async #refreshTokens(req: Request, tokenResponse: TokenEndpointResponse) {
    const openIdConfig = await this.#openIdConfig()
    const sessionId = req.session.id
    const refreshToken = tokenResponse.refresh_token

    const doRefresh = async () => {
      console.log(`Token refresh starting. sid=${redact(sessionId)}`)
      try {
        const tokenResponse = await openIdClient.refreshTokenGrant(
          openIdConfig,
          refreshToken
        )
        console.log(`Token refresh OK. sid=${redact(sessionId)}`)
        return tokenResponse
      } catch (err) {
        console.log(`Token refresh failed. sid=${redact(sessionId)}`, err)
        return null
      }
    }

    const refreshPromise = this.#refreshPromises[refreshToken] ??= doRefresh().finally(() => {
      console.log(`Token refresh finished. Cleaning up. sid=${redact(sessionId)}`)
      setTimeout(() => {
        delete this.#refreshPromises[refreshToken]
      }, 10000)
    })
    const refreshedTokenResponse = await refreshPromise
    if (refreshedTokenResponse) {
      Object.assign(req.session.tokenResponse, refreshedTokenResponse)
      req.session.accessTokenExpiresAt = this.#getAccessTokenExpiryTime(refreshedTokenResponse)
    } else {
      req.session.tokenResponse = null
    }
    return req.session.tokenResponse
  }

  async #getFreshTokens(req: Request) {
    const tokenResponse = req.session.tokenResponse
    if (!tokenResponse) {
      console.log(`No tokenResponse found in session sid=${redact(req.session.id)}`)
      return
    }
    const now = new Date().getTime()
    const expiresAt = req.session.accessTokenExpiresAt || 0
    /*if(!expiresAt) {
      //For at ting ikke skal eksplodere hvis man får inn en gammel session.
      //TODO: denne kan fjernes når den har kjørt i prod i et døgn+
      console.error('accessTokenExpiresAt was not set')
      return
    }*/
    const expiresInSeconds = (expiresAt - now) / 1000
    if (expiresInSeconds < 5) {
      console.log(`Access token expired. sid=${redact(req.session.id)}, expiresInSeconds=${expiresInSeconds}`)
      return await this.#refreshTokens(req, tokenResponse)
    } else {
      return tokenResponse
    }
  }

  get ensureFreshToken() {
    return (req: Request, res: Response, next: NextFunction) => {
      this.#getFreshTokens(req).then(tokenResponse => {
        if (tokenResponse) {
          req.tokenResponse = tokenResponse
          next()
        } else {
          console.warn(`401: No valid tokens in session sid=${redact(req.session.id)}`)
          res.sendStatus(401)
        }
      }).catch(next)
    }
  }

  get login() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const codeVerifier = openIdClient.randomPKCECodeVerifier()
        const codeChallenge = await openIdClient.calculatePKCECodeChallenge(codeVerifier)
        const stateKey = openIdClient.randomState()
        const redirectUrl = req.query.redirectUrl as string //TODO: håndtering av andre typer her?
        const openIdConfig = await this.#openIdConfig()

        const params = new URLSearchParams()
        params.append('scope', this.#bffConfig.scope)
        params.append('code_challenge', codeChallenge)
        params.append('code_challenge_method', 'S256')
        params.append('redirect_uri', this.#bffConfig.redirectUri)
        params.append('state', stateKey)
        this.#bffConfig.resources?.forEach(resource => {
          params.append('resource', resource)
        })
        const authorizationUrl = openIdClient.buildAuthorizationUrl(openIdConfig, params)

        req.session.codeVerifier = codeVerifier
        req.session.stateKey = stateKey
        req.session.stateValue = {redirectUrl}

        req.session.save(() => {
          res.redirect(authorizationUrl.toString())
        })
      } catch (e) {
        next(new LoginError("Feil i login", e))
      }

    }
  }

  #getUserClaims(tokenResponse: TokenEndpointResponse & TokenEndpointResponseHelpers) {
    let claims: Partial<IDToken> = tokenResponse.claims()
    if (this.#bffConfig.userClaims) {
      claims = this.#bffConfig.userClaims.reduce((acc, claim) => {
        acc[claim] = claims[claim]
        return acc
      }, {})
    }
    return claims
  }

  #getAccessTokenExpiryTime(tokenResponse: TokenEndpointResponse & TokenEndpointResponseHelpers) {
    if(tokenResponse.expires_in !== undefined) {
      const now = new Date()
      now.setSeconds(now.getSeconds() + tokenResponse.expires_in)
      return now.getTime()
    }
  }

  get callback() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const openIdConfig = await this.#openIdConfig()
        const {codeVerifier, stateKey, stateValue} = req.session
        const url = new URL(`${req.protocol}://${req.headers.host}${req.originalUrl}`)
        const tokenResponse = await openIdClient.authorizationCodeGrant(
          openIdConfig,
          url,
          {
            expectedState: stateKey,
            pkceCodeVerifier: codeVerifier
          }
        )

        req.session.tokenResponse = tokenResponse
        req.session["idp-sid"] = tokenResponse.claims().sid as string
        req.session.userClaims = this.#getUserClaims(tokenResponse)
        req.session.accessTokenExpiresAt = this.#getAccessTokenExpiryTime(tokenResponse)

        delete req.session.codeVerifier
        delete req.session.stateKey
        delete req.session.stateValue

        req.session.save(() => {
          let redirectUrl = stateValue.redirectUrl
          //only allow relative redirecturls:
          const absoluteUrlRegex = /^(?:[a-z+]+:)?\/\//
          if (!redirectUrl || absoluteUrlRegex.test(redirectUrl)) {
            redirectUrl = this.#bffConfig.basePath || "/"
          }
          res.redirect(redirectUrl)
        })

      } catch (e) {
        req.session.destroy(() => {
          next(new LoginError("Feil i callback", e))
        })
      }
    }
  }

  get user() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tokenResponse = await this.#getFreshTokens(req)
        if (!tokenResponse) {
          console.log('/user 401: No tokenset')
          return res.sendStatus(401)
        }

        return res.send(req.session.userClaims)
      } catch (e) {
        next(new LoginError(`Feil i /user (sid=${redact(req.session?.id)})`, e))
      }
    }
  }

  get logout() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tokenResponse = req.session.tokenResponse
        const openIdConfig = await this.#openIdConfig()
        req.session.destroy(() => {
          const idTokenHint = tokenResponse?.id_token
          const endSessionUrl = openIdClient.buildEndSessionUrl(openIdConfig, idTokenHint ? {
            id_token_hint: idTokenHint,
          } : {})
          res.redirect(endSessionUrl.toString())
        })
      } catch (e) {
        next(e)
      }
    }
  }

  get frontChannelLogout() {
    return async (req: Request, res: Response) => {
      const {iss, sid} = req.query as { iss: string, sid: string }
      console.log(`Front channel logout: params iss=${iss}, sid=${redact(sid)}`)
      if (sid) {
        try {
          await req.destroySessionByIdpSid?.(sid)
        } catch (e) {
          console.error("Failed to destroy session", e)
        }
      }

      res.sendStatus(200)

    }
  }
}