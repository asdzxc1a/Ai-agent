/** Boundary for the existing HeyGen LiveAvatar LITE media-server bridge. */
export class HeyGenAudioSink {
  async connect(_session) { throw new Error('Implement using HeyGen LITE session ws_url') }
  async writePcm24k(_base64Pcm16) { throw new Error('Implement media-server agent.speak transport') }
  async interrupt() { throw new Error('Implement media-server agent.interrupt transport') }
  async close() {}
}
