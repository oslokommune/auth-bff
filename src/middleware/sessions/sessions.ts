import session from "express-session";
import {dynamoDbSessionStore} from "./dynamoDbSessionStore.js";
import {memorySessionStore} from "./memorySessionStore.js";
import {BffConfig} from "../../config/config.js";
import {Request, Response, NextFunction} from "express";

export function sessions(config: BffConfig) {
  let sessionStore: session.Store
  if (config.sessionStoreType === 'memory') {
    const sessionStoreOptions = config.sessionStoreOptions ?? {}
    sessionStore = memorySessionStore(sessionStoreOptions)
  } else if (config.sessionStoreType === 'dynamodb') {
    const sessionStoreOptions = config.sessionStoreOptions ?? {}
    sessionStore = dynamoDbSessionStore(sessionStoreOptions)
  } else if (config.sessionStoreType) {
    throw Error(`unknown sessionStoreType ${config.sessionStoreType}`)
  } else {
    throw Error('missing sessionStoreType')
  }

  return [
    session({
      secret: config.sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: config.cookie || {
        httpOnly: true,
        path: config.cookiePath,
        secure: config.cookieSecure,
        sameSite: config.cookieSameSite
      },
    }),
    (req: Request , _: Response, next: NextFunction) => {
      // make this function available to request handlers
      req.destroySessionByIdpSid = sessionStore?.destroyByIdpSid
      next()
    }
  ]
}
