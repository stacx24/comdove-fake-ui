// WebSocket connection to the mock server (Tech Spec §7). One socket per group.
import type { ClientEvent, ServerEvent } from './types'

export function connectGroup(group: string, onEvent: (event: ServerEvent) => void) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const socket = new WebSocket(`${protocol}://${location.host}/ws`)

  const send = (event: ClientEvent) => socket.send(JSON.stringify(event))

  socket.onopen = () => send({ type: 'group.claim', group })
  socket.onmessage = (e) => onEvent(JSON.parse(e.data) as ServerEvent)

  return { socket, send, close: () => socket.close() }
}
