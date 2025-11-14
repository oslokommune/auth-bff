import express from "express"
import {loadConfig} from "./config.js";
import {OidcMiddleware} from "./middleware/oidc.js";

function configureServer(configFile) {
  return async ({middlewares}) => {
    const {oidcRoutes} = await import("./middleware/oidc-routes.mjs")
    const {proxyRoutes} = await import("./middleware/proxy-routes.mjs")
    const {sessions} = await import("./middleware/sessions/sessions.mjs")

    const config = await loadConfig(configFile)
    const oidcMiddleware = await OidcMiddleware.create(config)

    const basePath = config.basePath || "/"
    const app = express()

    app.use(sessions(config))
    app.use(basePath, oidcRoutes(oidcMiddleware))
    app.use(basePath, proxyRoutes(config, oidcMiddleware))

    middlewares.use(app)
  }
}

/**
 *
 * @returns {{
 *  name: 'bff',
 *  apply: 'serve',
 *  configureServer: ((function({middlewares: *}): Promise<void>)|*),
 *  configurePreviewServer: ((function({middlewares: *}): Promise<void>)|*)
 * }}
 */
export default function bff({configFile} = {}) {
  return {
    name: 'bff',
    apply: 'serve',
    configureServer: configureServer(configFile),
    configurePreviewServer: configureServer(configFile)
  }
}