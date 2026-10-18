import { Hono } from 'hono'
import { calcStateHmac, stateSecretKey } from '../../lib/security'
import { getBaseURL } from '../../lib/url'
import { NON_DEFAULT_LANGUAGES } from '../../i18n/lang'
import type { AppEnv } from '../../types/env'
import {
  LOGIN_PATH,
  SESSION_SECRET,
  newSession,
  writeSession,
  type UserType,
} from './common'

/*
 * Types
 */

type AccessTokenResponse = {
  access_token: string
  // scope, token_type, etc. not used in this code
  error: string
  error_description: string
}

type TokenCheckResponse = {
  user: UserType
  error: string
  error_description: string
}

/*
 * Variables
 */

const secretKey = stateSecretKey(SESSION_SECRET)

/*
 * Hono controllers
 */

export const githubController = new Hono<AppEnv>()
  .get('/github', async (c) => {
    const code = c.req.query('code')
    const error = c.req.query('error')
    console.log('Code: ' + code)
    if (code === undefined || error !== undefined) {
      console.log(c.req.query('error_description'))
      // user cancelled, go to login page
      return c.redirect(getBaseURL(c.req.url) + LOGIN_PATH, 307)
    }
    if (c.req.query('iss') !== 'https://github.com/login/oauth') { // RFC 9207
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
    const tokenAccessResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'vue-crud-inertia/v1',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    })
    const githubAccessToken = await tokenAccessResponse.json() as AccessTokenResponse

    const { access_token } = githubAccessToken
    if (access_token === undefined || githubAccessToken.error !== undefined) {
      console.log(githubAccessToken.error_description)
      // incorrect secret?
      return c.redirect(getBaseURL(c.req.url) + LOGIN_PATH + langQueryParam, 307)
    }

    /*
    check-a-token:
    https://docs.github.com/en/rest/apps/oauth-applications?apiVersion=2022-11-28#check-a-token
    */
    const basicAuth = 'Basic ' + btoa(process.env.GITHUB_CLIENT_ID + ':' + process.env.GITHUB_CLIENT_SECRET)

    const tokenCheckResponse = await fetch('https://api.github.com/applications/' + process.env.GITHUB_CLIENT_ID + '/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'vue-crud-inertia/v1',
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/json',
        Authorization: basicAuth,
      },
      body: JSON.stringify({
        access_token,
      }),
    })
    const checkedTokenInfo = await tokenCheckResponse.json() as TokenCheckResponse
    console.log('login name: ' + checkedTokenInfo.user?.login)

    if (checkedTokenInfo.user?.login === undefined || checkedTokenInfo.error !== undefined) {
      console.log(checkedTokenInfo.error_description)
      return c.redirect(getBaseURL(c.req.url) + LOGIN_PATH + langQueryParam, 307)
    }

    await writeSession(c, newSession(c, {
      login: 'github:' + checkedTokenInfo.user.login,
      name: checkedTokenInfo.user.name || '',
      email: checkedTokenInfo.user.email || '',
      avatar_url: checkedTokenInfo.user.avatar_url || '',
    }))

    // go to main page
    return c.redirect(getBaseURL(c.req.url) + '/products' + langQueryParam, 307)
  })
  .get('/to-github', (c) => {
    const state = encodeURIComponent(calcStateHmac(c.req.header(), secretKey) + '?lang=' + (c.get('lang') || 'en'))
    const redirectTo = 'https://github.com/login/oauth/authorize?client_id=' + process.env.GITHUB_CLIENT_ID + '&prompt=consent&state=' + state
    return c.redirect(redirectTo, 307)
  })
