import express from "express"
import {loadConfig} from "./config.js";
import {OidcMiddleware} from "./middleware/OidcMiddleware.js";
import {ViteDevServer, Plugin} from 'vite'

function configureServer(configFilePath?: string) {
  return async ({middlewares}: ViteDevServer) => {
    const {oidcRoutes} = await import("./middleware/oidc-routes.js")
    const {proxyRoutes} = await import("./middleware/proxy-routes.js")
    const {sessions} = await import("./middleware/sessions/sessions.js")

    const config = await loadConfig(configFilePath)
    const oidcMiddleware = await OidcMiddleware.create(config)

    const basePath = config.basePath || "/"
    const app = express()

    app.use(sessions(config))
    app.use(basePath, oidcRoutes(oidcMiddleware))
    app.use(basePath, proxyRoutes(config, oidcMiddleware))

    middlewares.use(app)
  }
}

export default function bff({configFile}: {configFile?: string} = {}): Plugin {
  return {
    name: 'bff',
    apply: 'serve',
    configureServer: configureServer(configFile),
    configurePreviewServer: configureServer(configFile)
  }
}