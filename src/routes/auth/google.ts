import { Hono } from 'hono'
import { calcStateHmac, stateSecretKey } from '../../lib/security'
import { getBaseURL } from '../../lib/url'
import { NON_DEFAULT_LANGUAGES } from '../../i18n/lang'
import type { AppEnv } from '../../types/env'
import {
  AUTH_PATH,
  LOGIN_PATH,
  SESSION_SECRET,
  newSession,
  writeSession,
} from './common'

/*
 * Types
 */

type AccessTokenResponse = {
  access_token: string
  token_type: string
  error: string
  error_description: string
  // scope, expires_in, etc. not used in this code
}

type TokenCheckResponse = {
  sub: string
  name: string
  given_name: string
  family_name: string
  picture: string
  error: string
  error_description: string
}

/*
 * Variables
 */

const secretKey = stateSecretKey(SESSION_SECRET)

/*
 * Functions
 */

// The redirect uri must exactly match one of the authorised redirect uris
// of the Google OAuth client (one for local development, one for production).
function getRedirectUri(c: { req: { url: string } }): string {
  return getBaseURL(c.req.url) + AUTH_PATH + '/google'
}

/*
 * Hono controllers
 */

export const googleController = new Hono<AppEnv>()
  .get('/google', async (c) => {
    const code = c.req.query('code')
    const error = c.req.query('error')
    console.log('Code: ' + code)
    if (code === undefined || error !== undefined) {
      console.log(c.req.query('error_description'))
      // user cancelled, go to login page
      return c.redirect(getBaseURL(c.req.url) + LOGIN_PATH, 307)
    }
    if (c.req.query('iss') !== 'https://accounts.google.com') { // RFC 9207
      console.log('issuer mismatch')
      return c.redirect(getBaseURL(c.req.url) + LOGIN_PATH, 307)
    }
    const headers = c.req.header()
    const stateArray = decodeURIComponent(c.req.query('state') || '').split('?lang=')
    const verifyState = calcStateHmac(headers, secretKey)
    if (verifyState !== stateArray[0]) {
      console.log('state has been tampered')
      return c.redirect(getBaseURL(c.req.url) + LOGIN_PATH, 307)
    }
    const langQueryParam = NON_DEFAULT_LANGUAGES.includes(stateArray[1] ?? '') ? '?lang=' + stateArray[1] : ''
    const redirect_uri = getRedirectUri(c)
    const tokenAccessResponse = await fetch('https://accounts.google.com/o/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'vue-crud-inertia/v1',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri,
      }),
    })
    const googleAccessToken = await tokenAccessResponse.json() as AccessTokenResponse

    const { access_token, token_type } = googleAccessToken

    if (access_token === undefined || googleAccessToken.error !== undefined) {
      console.log(googleAccessToken.error_description)
      // incorrect secret?
      return c.redirect(getBaseURL(c.req.url) + LOGIN_PATH + langQueryParam, 307)
    }

    const bearerAuth = token_type + ' ' + access_token

    const tokenCheckResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      method: 'GET',
      headers: {
        'User-Agent': 'vue-crud-inertia/v1',
        Accept: 'application/json',
        Authorization: bearerAuth,
      },
    })

    const checkedTokenInfo = await tokenCheckResponse.json() as TokenCheckResponse
    console.log('login name: ' + checkedTokenInfo.name)
    console.log('user unique id: ' + checkedTokenInfo.sub)

    if (checkedTokenInfo.sub === undefined || checkedTokenInfo.error !== undefined) {
      console.log(checkedTokenInfo.error_description)
      return c.redirect(getBaseURL(c.req.url) + LOGIN_PATH + langQueryParam, 307)
    }

    await writeSession(c, newSession(c, {
      login: 'google:' + checkedTokenInfo.sub,
      name: checkedTokenInfo.name || '',
      email: '',
      avatar_url: checkedTokenInfo.picture || '',
    }))

    // go to main page
    return c.redirect(getBaseURL(c.req.url) + '/products' + langQueryParam, 307)
  })
  .get('/to-google', (c) => {
    const state = encodeURIComponent(calcStateHmac(c.req.header(), secretKey) + '?lang=' + (c.get('lang') || 'en'))
    const redirect_uri = getRedirectUri(c)
    const redirectTo = 'https://accounts.google.com/o/oauth2/auth?client_id=' + process.env.GOOGLE_CLIENT_ID + '&prompt=consent&redirect_uri=' + redirect_uri + '&scope=' + encodeURIComponent('https://www.googleapis.com/auth/userinfo.profile') + '&response_type=code&state=' + state
    return c.redirect(redirectTo, 307)
  })
