/// <reference types="vite/client" />

import { describe, expect, it, vi } from 'vitest'

import { fetchPublishedPosts } from '@/blog/service'

const firestore = vi.hoisted(() => ({
  getDocs: vi.fn(), query: vi.fn((...constraints: unknown[]) => constraints), limit: vi.fn((count: number) => ({ limit: count })),
}))
vi.mock('@/lib/firebase', () => ({ db: {}, isFirebaseConfigured: true, requireDb: () => ({}) }))
vi.mock('firebase/firestore', () => ({
  collection: () => 'posts', doc: vi.fn(), getDoc: vi.fn(), getDocs: firestore.getDocs,
  limit: firestore.limit, orderBy: (field: string, direction: string) => ({ orderBy: field, direction }),
  query: firestore.query, where: (field: string, operator: string, value: string) => ({ field, operator, value }), writeBatch: vi.fn(),
}))

describe('public metadata listing', () => {
  it('keeps articles older than the first 100 available for index links and translations', async () => {
    firestore.limit.mockClear()
    firestore.getDocs.mockResolvedValue({ docs: Array.from({ length: 101 }, (_, index) => ({
      id: `post-${index}`, data: () => ({ status: 'published', title: `Post ${index}` }),
    })) })
    const posts = await fetchPublishedPosts()
    expect(posts).toHaveLength(101)
    expect(posts[100].slug).toBe('post-100')
    expect(firestore.limit).not.toHaveBeenCalled()
    expect(firestore.query).toHaveBeenLastCalledWith('posts',
      { field: 'status', operator: '==', value: 'published' }, { orderBy: 'publishedAt', direction: 'desc' })
  })

  it('preserves an explicit caller limit', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] })
    await fetchPublishedPosts(24)
    expect(firestore.limit).toHaveBeenLastCalledWith(24)
    expect(firestore.query).toHaveBeenLastCalledWith('posts',
      { field: 'status', operator: '==', value: 'published' }, { orderBy: 'publishedAt', direction: 'desc' }, { limit: 24 })
  })
})
