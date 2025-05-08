import express from "express"

async function configureServer({middlewares}) {
  const {oidcRoutes} = await import("./middleware/oidc-routes.mjs")
  const {proxyRoutes} = await import("./middleware/proxy-routes.mjs")
  const {sessions} = await import("./middleware/sessions.mjs")
  const basePath = "" || "/"
  const app = express()
  app.use(sessions())
  app.use(basePath, oidcRoutes())
  app.use(basePath, proxyRoutes())

  middlewares.use(app)
}

/**
 *
 * @returns {{
 *  name: string,
 *  apply: 'serve',
 *  configureServer: ((function({middlewares: *}): Promise<void>)|*),
 *  configurePreviewServer: ((function({middlewares: *}): Promise<void>)|*)
 * }}
 */
export default function bff() {
  return {
    name: 'bff',
    apply: 'serve',
    configureServer: configureServer,
    configurePreviewServer: configureServer
  }
}