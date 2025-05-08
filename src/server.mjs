#!/usr/bin/env node
import express from "express"
import compression from "compression"
import {config} from './config.mjs'
import {proxyRoutes} from "./middleware/proxy-routes.mjs";
import {staticRoutes} from "./middleware/static-routes.mjs";
import {securityHeaders} from "./middleware/security-headers.mjs";
import {sessions} from "./middleware/sessions.mjs";
import {oidcRoutes} from "./middleware/oidc-routes.mjs";

const app = express()

app.set('trust proxy', true) // TODO: sjekk om denne kan/bør være strengere: https://expressjs.com/en/api.html#trust.proxy.options.table
app.disable("x-powered-by")

app.use(compression())
app.use(sessions())

if (!config.devMode) {
  app.use(securityHeaders())
}

app.get("/health", (req, res) => {
  res.send("OK")
})

const basePath = config.basePath || "/"

app.use(basePath, oidcRoutes())
app.use(basePath, proxyRoutes())
app.use(basePath, staticRoutes())

app.listen(config.port, () => {
  console.log(`Server started on port ${config.port}`)
})

