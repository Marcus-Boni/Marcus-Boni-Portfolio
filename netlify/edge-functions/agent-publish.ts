import type { Config } from '@netlify/edge-functions'

import { handleAgentPublish } from '../lib/agent-publish.ts'

export default async function handler(request: Request) {
  return await handleAgentPublish(request)
}

export const config: Config = {
  path: '/agent/v1/posts',
}
