import assert from 'node:assert/strict'
import { parseAuthResponse } from './authResponse.ts'

const emptyBadGateway = new Response('', { status: 502, statusText: 'Bad Gateway' })

await assert.rejects(
  () => parseAuthResponse(emptyBadGateway, '登录失败'),
  /后端服务未返回有效响应，请确认服务已启动/,
)

const jsonError = new Response(JSON.stringify({ detail: '邮箱或密码错误' }), {
  status: 400,
  headers: { 'Content-Type': 'application/json' },
})

await assert.rejects(
  () => parseAuthResponse(jsonError, '登录失败'),
  /邮箱或密码错误/,
)

console.log('authResponse tests passed')
