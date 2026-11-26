import type { Config } from '@netlify/edge-functions'

import { handleAgentChat } from '../lib/agent-chat.ts'

export default async function handler(request: Request) {
  return await handleAgentChat(request)
}

export const config: Config = {
  path: '/agent/v1/chat',
}
