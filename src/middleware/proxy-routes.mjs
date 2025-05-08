import express from "express";
import {ensureFreshToken} from "./oidc.mjs";
import {createProxyMiddleware} from "http-proxy-middleware";
import {config} from "../config.mjs";

export function proxyRoutes() {
  const router = new express.Router()
  router.use(
    "/api",
    ensureFreshToken,
    createProxyMiddleware({
      target: config.apiProxyTarget,
      changeOrigin: true,
      onProxyReq: (proxyReq, req, res) => {
        const tokenSet = req.tokenSet
        if (!tokenSet) {
          return res.status(401)
        }
        proxyReq.setHeader("Authorization", `Bearer ${tokenSet.access_token}`)
        proxyReq.removeHeader("Cookie")
      },
    })
  )
  return router
}