import type { Config } from '@netlify/edge-functions'

import { handleGitHubActivity } from '../lib/github-activity.ts'

export default async function handler(request: Request) {
  return await handleGitHubActivity(request)
}

export const config: Config = {
  path: '/agent/v1/github',
}
