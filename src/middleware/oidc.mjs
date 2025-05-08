import {generators, TokenSet} from "openid-client";
import {config} from "../config.mjs";
import {client} from '../client.mjs'

async function getFreshTokenSet(req) {
  const tokenSet = req.session.tokenSet && new TokenSet(req.session.tokenSet)
  if (!tokenSet) {
    console.log("No tokenSet found in session")
    return
  }
  if (tokenSet.expired()) {
    try {
      const refreshedTokenSet = await client.refresh(tokenSet.refresh_token)
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

export function ensureFreshToken(req, _, next) {
  getFreshTokenSet(req).then(tokenSet => {
    req.tokenSet = tokenSet
    next()
  })
}

export function login(req, res) {
  const codeVerifier = generators.codeVerifier()
  const codeChallenge = generators.codeChallenge(codeVerifier)

  const authorizationUrl = client.authorizationUrl({
    scope: "openid profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    resource: config.resources,
  })

  req.session.codeVerifier = codeVerifier
  req.session.save(() => {
    res.redirect(authorizationUrl)
  })
}

export async function callback(req, res) {
  const params = client.callbackParams(req)
  const codeVerifier = req.session.codeVerifier
  const redirectUri = `${req.protocol}://${req.headers.host}${config.basePath}/auth/callback`
  try {
    const tokenSet = await client.callback(redirectUri, params, {
      code_verifier: codeVerifier
    })

    delete req.session.codeVerifier
    req.session.tokenSet = new TokenSet(tokenSet)
    req.session.save(() => {
      res.redirect(config.basePath || "/") //TODO: skal denne kunne redirecte et annet sted?
    })

  } catch (err) {
    console.error(err)
    res.status(500).send("Error during callback")
  }
}

export async function user(req, res) {
  const tokenSet = await getFreshTokenSet(req)
  if (!tokenSet) {
    return res.sendStatus(401)
  }
  return res.send({pid: tokenSet.claims()['pid']})
}

export function logout(req, res) {
  const tokenSet = req.session.tokenSet && new TokenSet(req.session.tokenSet)

  //TODO: støtt frontchannel SLO

  req.session.destroy(() => {
    res.redirect(client.endSessionUrl({
      id_token_hint: tokenSet?.id_token,

    }))
  })
}