import express from "express";
import {OidcMiddleware} from "./OidcMiddleware.js";

export function oidcRoutes(oidcMiddleware: OidcMiddleware) {
  const router = express.Router()

  router.get('/auth/login', oidcMiddleware.login)
  router.get('/auth/callback', oidcMiddleware.callback)
  router.get('/auth/logout', oidcMiddleware.logout)
  router.get('/auth/user', oidcMiddleware.user)
  router.get('/auth/front-channel-logout', oidcMiddleware.frontChannelLogout)

  return router
}