import {generators, TokenSet} from "openid-client";
import {OidcClientManager} from "../client.mjs";

export class OidcMiddleware {
  #clientManager
  #config

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

  async #getFreshTokenSet(req) {
    const tokenSet = req.session.tokenSet && new TokenSet(req.session.tokenSet)
    if (!tokenSet) {
      console.log("No tokenSet found in session")
      return
    }
    if (tokenSet.expired()) {
      try {
        const refreshedTokenSet = await this.#clientManager.client.refresh(tokenSet.refresh_token)
        Object.assign(req.session.tokenSet, refreshedTokenSet)
        return new TokenSet(req.session.tokenSet)
      } catch (err) {
        console.log("Token refresh failed", err)
        req.session.tokenSet = null
      }
    } else {
      return tokenSet
    }
  }

  get ensureFreshToken() {
    return (req, _, next) => {
      this.#getFreshTokenSet(req).then(tokenSet => {
        req.tokenSet = tokenSet
        next()
      })
    }
  }

  get login() {
    return (req, res) => {

      const codeVerifier = generators.codeVerifier()
      const codeChallenge = generators.codeChallenge(codeVerifier)

      const authorizationUrl = this.#clientManager.client.authorizationUrl({
        scope: "openid profile",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        resource: this.#config.resources,
      })

      req.session.codeVerifier = codeVerifier
      req.session.save(() => {
        res.redirect(authorizationUrl)
      })
    }
  }

  get callback() {
    return async (req, res) =>  {
      const params = this.#clientManager.client.callbackParams(req)
      const codeVerifier = req.session.codeVerifier
      const redirectUri = `${req.protocol}://${req.headers.host}${this.#config.basePath}/auth/callback`
      try {
        const tokenSet = await this.#clientManager.client.callback(redirectUri, params, {
          code_verifier: codeVerifier
        })

        delete req.session.codeVerifier
        req.session.tokenSet = new TokenSet(tokenSet)
        req.session.save(() => {
          res.redirect(this.#config.basePath || "/") //TODO: skal denne kunne redirecte et annet sted?
        })

      } catch (err) {
        console.error(err)
        res.status(500).send("Error during callback")
      }
    }

  }

  get user() {
    return async (req, res) => {
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