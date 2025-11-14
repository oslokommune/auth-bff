#!/usr/bin/env node
import express from "express"
import compression from "compression"
import {loadConfig} from './config.js'
import {proxyRoutes} from "./middleware/proxy-routes.mjs";
import {staticRoutes} from "./middleware/static-routes.mjs";
import {securityHeaders} from "./middleware/security-headers.mjs";
import {sessions} from "./middleware/sessions/sessions.mjs";
import {oidcRoutes} from "./middleware/oidc-routes.mjs";
import {OidcMiddleware} from "./middleware/oidc.js";
import commandLineArgs from "command-line-args"
import packageJson from "../package.json" with {type: 'json'}

const options = commandLineArgs({name: 'configFile'})
const config = await loadConfig(options.configFile)
const port = process.env.port || config.port || 8080;
const oidcMiddleware = await OidcMiddleware.create(config)

const requestLogger = (req, _, next) => {
  next()
  console.log(`${req.method} ${req.originalUrl}, referer=${req.get('Referer')}, user-agent=${req.get('User-Agent')}`)
}

const app = express()

app.set('trust proxy', true) // TODO: sjekk om denne kan/bør være strengere: https://expressjs.com/en/api.html#trust.proxy.options.table
app.disable("x-powered-by")

app.use(compression())
app.use(sessions(config))
app.use(securityHeaders(config))

app.get("/health", (req, res) => {
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

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing...')
  server.close(() => {
    console.log('Server closed')
  })
})