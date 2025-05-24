import express from "express";

export function oidcRoutes(oidcMiddleware) {
  const router = new express.Router()

  router.get('/auth/login', oidcMiddleware.login)
  router.get('/auth/callback', oidcMiddleware.callback)
  router.get('/auth/logout', oidcMiddleware.logout)
  router.get('/auth/user', oidcMiddleware.user)

  return router
}