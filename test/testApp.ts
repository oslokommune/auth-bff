import openidConfig from './config/openid-configuration.json' with { type: 'json' }
import {OpenIdConfigManager} from "../src/OpenIdConfigManager.js";
import {loadConfig} from "../src/config.js";
import {OidcMiddleware} from "../src/middleware/OidcMiddleware.js";
import {oidcRoutes} from "../src/middleware/oidc-routes.js";
import {sessions} from "../src/middleware/sessions/sessions.js";
import {securityHeaders} from "../src/middleware/security-headers.js";
import {staticRoutes} from "../src/middleware/static-routes.js";
import {proxyRoutes} from "../src/middleware/proxy-routes.js";
import express from "express";
import compression from "compression"

export async function testApp() {
  const bffConfig = await loadConfig('./test/config/bff.config.test.json')

  const configManager = new OpenIdConfigManager(bffConfig, openidConfig)
  await configManager.init()

  const oidcMiddleware = new OidcMiddleware(bffConfig, configManager)

  const app = express()

  const basePath = bffConfig.basePath || "/"

  app.use(compression())
  app.use(sessions(bffConfig))
  app.use(securityHeaders(bffConfig))

  app.use(basePath, oidcRoutes(oidcMiddleware))
  app.use(basePath, proxyRoutes(bffConfig, oidcMiddleware))
  app.use(basePath, staticRoutes(bffConfig))

  return app
}