import express, {Request, Response} from "express"
import {createProxyMiddleware} from "http-proxy-middleware"
import {BffConfig} from "../config.js";
import {OidcMiddleware} from "./OidcMiddleware.js";

export function proxyRoutes(config: BffConfig, oidcMiddleware: OidcMiddleware) {
  const router = express.Router()
  for (const [path, target] of Object.entries(config.proxyTargets)) {
    console.log(`Setting up auth proxy: ${path} -> ${target}`)
    router.use(
      path,
      oidcMiddleware.ensureFreshToken,
      createProxyMiddleware({
        target: target,
        changeOrigin: true,
        on: {
          proxyReq: (proxyReq, req: Request) => {
            const accessToken = req.tokenResponse?.access_token
            if (!accessToken) {
              console.error("proxy: missing token")
              return
            }
            proxyReq.setHeader("Authorization", `Bearer ${accessToken}`)
            proxyReq.removeHeader("Cookie")
          },
          proxyRes: (proxyRes, req: Request) => {
            // @ts-ignore //TODO: proxyRes har en mystisk type som mangler req, men den er der
            console.log(`Proxied: ${req.method} ${req.originalUrl} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path}, status=${proxyRes.statusCode}`)
          }
        }
      })
    )
  }
  return router
}