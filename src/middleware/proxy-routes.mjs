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
            const tokenSet = req.tokenSet
            if (!tokenSet) {
              console.error("proxy: missing tokenSet")
              return res.status(401)
            }
            proxyReq.setHeader("Authorization", `Bearer ${tokenSet.access_token}`)
            proxyReq.removeHeader("Cookie")
          },
          proxyRes:(proxyRes, req, res) => {
            console.log(`proxyied ${req.originalUrl}: ${proxyRes.statusCode}`)
          }
        }
      })
    )
  }
  return router
}