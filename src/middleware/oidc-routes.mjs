import express from "express";
import {callback, login, logout, user} from "./oidc.mjs";

export function oidcRoutes() {
  const router = new express.Router()

  router.get('/auth/login', login)
  router.get('/auth/callback', callback)
  router.get('/auth/logout', logout)
  router.get('/auth/user', user)

  return router
}