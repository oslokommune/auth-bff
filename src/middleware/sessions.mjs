import session from "express-session";
import {config} from "../config.mjs";

export function sessions() {
  return session({
    secret: config.sessionSecret,
    store: config.sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite
    },
  })
}
