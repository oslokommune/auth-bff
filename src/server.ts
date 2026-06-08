#!/usr/bin/env node
import express, {Request, Response, NextFunction} from "express"
import compression from "compression"
import {loadConfig} from './config/config.js'
import {proxyRoutes} from "./middleware/proxy-routes.js";
import {staticRoutes} from "./middleware/static-routes.js";
import {securityHeaders} from "./middleware/security-headers.js";
import {sessions} from "./middleware/sessions/sessions.js";
import {oidcRoutes} from "./middleware/oidc-routes.js";
import {OidcMiddleware} from "./middleware/OidcMiddleware.js";
import commandLineArgs from "command-line-args"
import packageJson from "../package.json" with {type: 'json'}

const options = commandLineArgs([{name: 'configFile'}])
const config = await loadConfig(options.configFile)
const port = process.env.port || config.port || 8080;
const oidcMiddleware = await OidcMiddleware.create(config)

const requestLogger = (req: Request, _: Response, next: NextFunction) => {
  next()
  console.log(`${req.method} ${req.originalUrl}, referer=${req.get('Referer')}, user-agent=${req.get('User-Agent')}`)
}

const app = express()

app.set('trust proxy', true) // TODO: sjekk om denne kan/bør være strengere: https://expressjs.com/en/api.html#trust.proxy.options.table
app.disable("x-powered-by")

app.use(compression())
app.use(sessions(config))
app.use(securityHeaders(config))

app.get("/health", (_: Request, res: Response) => {
  res.send("OK")
})

const basePath = config.basePath || "/"

app.use(basePath, oidcRoutes(oidcMiddleware))
app.use(requestLogger) //NB, må stå her for å ikke logge auth-requestene over
app.use(basePath, proxyRoutes(config, oidcMiddleware))
app.use(basePath, staticRoutes(config))

const server = app.listen(port, () => {
  console.log(`auth-bff ${packageJson.version} started on port ${port}`)
})

const shutdown = (signal: string) => {
  console.log(`${signal} received. Closing...`)
  server.close(() => {
    console.log('Server closed')
  })
  setTimeout(() => {
    console.warn('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))