import express from "express";
import {createProxyMiddleware} from "http-proxy-middleware";

export function proxyRoutes(config, oidcMiddleware) {
  const router = new express.Router()
  for (const [path, target] of Object.entries(config.proxyTargets)) {
    console.log(`Setting up auth proxy: ${path} -> ${target}`)
    router.use(
      path,
      oidcMiddleware.ensureFreshToken,
      createProxyMiddleware({
        target: target,
        changeOrigin: true,
        on: {
          proxyReq: (proxyReq, req, res) => {
            const accessToken = req.tokenResponse?.access_token
            if (!accessToken) {
              console.error("proxy: missing token")
              return
            }
            proxyReq.setHeader("Authorization", `Bearer ${accessToken}`)
            proxyReq.removeHeader("Cookie")
          },
          proxyRes: (proxyRes, req, res) => {
            console.log(`Proxied ${req.originalUrl} -> ${target}${req.originalUrl}: ${proxyRes.statusCode}`)
          }
        }
      })
    )
  }
  return router
}