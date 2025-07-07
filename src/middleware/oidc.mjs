import {generators, TokenSet} from "openid-client";
import {OidcClientManager} from "../client.mjs";

export class OidcMiddleware {
  #clientManager
  #config
  #refreshPromises = {}

  /**
   * @private
   * @param config
   * @param clientManager
   */
  constructor(config, clientManager) {
    this.#clientManager = clientManager
    this.#config = config
  }

  static async create(config) {
    const clientManager = new OidcClientManager(config)
    await clientManager.init()
    return new OidcMiddleware(config, clientManager)
  }

  async #refreshTokenSet(req, tokenSet) {
    const sessionId = req.session.id
    const refreshToken = tokenSet.refresh_token

    const doRefresh = async () => {
      console.log(`Token refresh starting. sid=${sessionId}`)
      try {
        const refreshedTokenSet = await this.#clientManager.client.refresh(refreshToken)
        console.log(`Token refresh OK. sid=${sessionId}`)
        return refreshedTokenSet
      } catch (err) {
        console.log(`Token refresh failed. sid=${sessionId}`, err)
        return null
      }
    }

    const refreshPromise = this.#refreshPromises[refreshToken] ??= doRefresh().finally(() => {
      console.log(`Token refresh finished. Cleaning up. sid=${sessionId}`)
      setTimeout(()=> {
        delete this.#refreshPromises[refreshToken]
      }, 10000)
    })
    const refreshedTokenSet = await refreshPromise
    if(refreshedTokenSet) {
      Object.assign(req.session.tokenSet, refreshedTokenSet)
    } else {
      req.session.tokenSet = null
    }
    return req.session.tokenSet
  }

  async #getFreshTokenSet(req) {
    const tokenSet = req.session.tokenSet && new TokenSet(req.session.tokenSet)
    if (!tokenSet) {
      console.log("No tokenSet found in session")
      return
    }
    if (tokenSet.expired()) {
      const newTokenSet = await this.#refreshTokenSet(req, tokenSet)
      return newTokenSet && new TokenSet(newTokenSet)
    } else {
      return tokenSet
    }
  }

  get ensureFreshToken() {
    return (req, res, next) => {
      this.#getFreshTokenSet(req).then(tokenSet => {
        if(tokenSet) {
          req.tokenSet = tokenSet
          next()
        } else {
          res.sendStatus(401)
        }
      }).catch(next)
    }
  }

  get login() {
    return (req, res) => {
      const codeVerifier = generators.codeVerifier()
      const codeChallenge = generators.codeChallenge(codeVerifier)
      const stateKey = generators.state()
      const redirectUrl = req.query.redirectUrl

      const authorizationUrl = this.#clientManager.client.authorizationUrl({
        scope: "openid profile",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        resource: this.#config.resources,
        state: stateKey
      })

      req.session.codeVerifier = codeVerifier
      req.session.stateKey = stateKey
      req.session.stateValue = { redirectUrl }

      req.session.save(() => {
        res.redirect(authorizationUrl)
      })
    }
  }

  get callback() {
    return async (req, res, next) =>  {
      try {
        const params = this.#clientManager.client.callbackParams(req)
        const {codeVerifier, stateKey, stateValue} = req.session
        const redirectUri = `${req.protocol}://${req.headers.host}${this.#config.basePath}/auth/callback`

        const tokenSet = await this.#clientManager.client.callback(redirectUri, params, {
          code_verifier: codeVerifier,
          state: stateKey
        })

        req.session.tokenSet = new TokenSet(tokenSet)

        delete req.session.codeVerifier
        delete req.session.stateKey
        delete req.session.stateValue

        req.session.save(() => {
          let redirectUrl = stateValue.redirectUrl
          //only allow relative redirecturls:
          const absoluteUrlRegex = /^(?:[a-z+]+:)?\/\//
          if(!redirectUrl || absoluteUrlRegex.test(redirectUrl)) {
            redirectUrl = this.#config.basePath || "/"
          }
          res.redirect(redirectUrl)
        })

      } catch (e) {
        console.error(e)
        req.session.destroy(() => {
          next(e)
        })
      }
    }

  }

  get user() {
    return async (req, res, next) => {
      try {
        const tokenSet = await this.#getFreshTokenSet(req)
        if (!tokenSet) {
          return res.sendStatus(401)
        }
        let claims = tokenSet.claims()
        if(this.#config.userClaims) {
          claims = this.#config.userClaims.reduce((acc, claim) => {
            acc[claim] = claims[claim]
            return acc
          }, {})
        }
        return res.send(claims)
      } catch (e) {
        console.error(`Error in /user sid=${req.session?.id}`, e, req.session)
        next(e)
      }
    }
  }

  get logout() {
    return (req, res) => {
      const tokenSet = req.session.tokenSet && new TokenSet(req.session.tokenSet)

      //TODO: støtt frontchannel SLO

      req.session.destroy(() => {
        res.redirect(this.#clientManager.client.endSessionUrl({
          id_token_hint: tokenSet?.id_token,
        }))
      })
    }

  }
}