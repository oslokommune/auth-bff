import express, {Request} from "express"
import {createProxyMiddleware} from "http-proxy-middleware"
import {BffConfig} from "../config.js";
import {OidcMiddleware} from "./OidcMiddleware.js";

export function proxyRoutes(config: BffConfig, oidcMiddleware: OidcMiddleware) {
  const router = express.Router()

  // Public targets first so they win over overlapping protected paths.
  for (const [path, target] of Object.entries(config.publicProxyTargets ?? {})) {
    console.log(`Setting up public proxy: ${path} -> ${target}`)
    router.use(
      path,
      createProxyMiddleware({
        target: target,
        changeOrigin: true,
        on: {
          proxyReq: (proxyReq) => {
            proxyReq.removeHeader("Cookie")
          },
          proxyRes: (proxyRes, req: Request) => {
            // @ts-ignore //TODO: proxyRes har en mystisk type som mangler req, men den er der
            console.log(`Proxied (public): ${req.method} ${req.originalUrl} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path}, status=${proxyRes.statusCode}`)
          }
        }
      })
    )
  }

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
