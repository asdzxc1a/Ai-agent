export class LiveAvatarApiError extends Error {
  constructor(status, body) {
    super(`LiveAvatar API returned ${status}: ${body}`)
    this.name = 'LiveAvatarApiError'
    this.status = status
    this.body = body
  }
}

function clean(value) {
  return String(value || '').trim()
}

export class LiveAvatarClient {
  constructor({
    apiKey,
    apiUrl = 'https://api.liveavatar.com',
    avatarId = '',
    fetchImpl = fetch,
    log = () => {},
  } = {}) {
    this.apiKey = clean(apiKey)
    this.apiUrl = clean(apiUrl).replace(/\/$/, '')
    this.avatarId = clean(avatarId)
    this.fetchImpl = fetchImpl
    this.log = log
    this.fallbackAvatarId = null
  }

  async post(path, body, headers) {
    const response = await this.fetchImpl(`${this.apiUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    if (!response.ok) throw new LiveAvatarApiError(response.status, text.slice(0, 500))
    const parsed = text ? JSON.parse(text) : {}
    return parsed.data ?? {}
  }

  async resolveAvatarId() {
    if (this.avatarId) return this.avatarId
    if (this.fallbackAvatarId) return this.fallbackAvatarId

    const response = await this.fetchImpl(`${this.apiUrl}/v1/avatars/public?page_size=20`)
    if (!response.ok) {
      throw new LiveAvatarApiError(response.status, await response.text())
    }
    const body = await response.json()
    const avatars = body?.data?.results ?? []
    const pick = avatars.find(item => item.status === 'ACTIVE' && item.type === 'VIDEO')
      ?? avatars.find(item => item.status === 'ACTIVE')
    if (!pick?.id) throw new Error('No public LiveAvatar is available; set LIVEAVATAR_AVATAR_ID')
    this.fallbackAvatarId = String(pick.id)
    this.log(`LiveAvatar: using public avatar ${pick.name || pick.id}`)
    return this.fallbackAvatarId
  }

  async startSession() {
    if (!this.apiKey) throw new Error('LIVEAVATAR_API_KEY is required')
    const avatarId = await this.resolveAvatarId()
    const token = await this.post('/v1/sessions/token', {
      mode: 'LITE',
      avatar_id: avatarId,
    }, { 'X-API-KEY': this.apiKey })

    const sessionId = clean(token.session_id)
    const sessionToken = clean(token.session_token)
    if (!sessionId || !sessionToken) {
      throw new Error('LiveAvatar token mint returned no session_id/session_token')
    }

    const started = await this.post('/v1/sessions/start', {}, {
      Authorization: `Bearer ${sessionToken}`,
    })
    const livekitUrl = clean(started.livekit_url)
    const livekitClientToken = clean(started.livekit_client_token)
    const wsUrl = clean(started.ws_url)
    if (!livekitUrl || !livekitClientToken || !wsUrl) {
      await this.stopSession(sessionId).catch(() => {})
      throw new Error(`LiveAvatar session ${sessionId} started without livekit_url/livekit_client_token/ws_url`)
    }

    return {
      sessionId,
      avatarId,
      livekitUrl,
      livekitClientToken,
      wsUrl,
    }
  }

  async stopSession(sessionId) {
    if (!clean(sessionId)) return
    if (!this.apiKey) throw new Error('LIVEAVATAR_API_KEY is required')
    await this.post('/v1/sessions/stop', { session_id: clean(sessionId) }, {
      'X-API-KEY': this.apiKey,
    })
  }
}

export function createLiveAvatarClientFromEnv(env = process.env, options = {}) {
  return new LiveAvatarClient({
    apiKey: env.LIVEAVATAR_API_KEY,
    apiUrl: env.LIVEAVATAR_API_URL || 'https://api.liveavatar.com',
    avatarId: env.LIVEAVATAR_AVATAR_ID,
    ...options,
  })
}
