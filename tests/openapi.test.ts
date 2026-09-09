import { describe, expect, it } from 'vitest'

import { API_BASE, OPERATIONS } from '@/data/api'
import { openApiDocument } from '@/data/openapi'

/**
 * Conformance tests for the OpenAPI document.
 *
 * These encode the two readiness checks that describe what a *good* spec looks
 * like, rather than merely that one exists:
 *
 *   "a unique operationId and a description on every operation, typed
 *    parameters, and response schemas"
 *   "unique operation IDs, typed schemas, and descriptions compatible with LLM
 *    function-calling formats"
 *
 * A tool-calling runtime turns each operation into a function definition: the
 * `operationId` becomes the name, the `description` becomes what the model
 * reads to decide whether to call it, and the parameter schema becomes the
 * argument type. Any one of them missing makes the operation unusable, and
 * none of it is something the type checker can notice.
 */

const document = openApiDocument()

interface OperationObject {
  operationId: string
  summary: string
  description: string
  tags: string[]
  parameters?: { name: string; in: string; required: boolean; description: string; schema: unknown }[]
  responses: Record<string, { description: string; content?: Record<string, { schema: unknown }> }>
}

const paths = document.paths as Record<string, { get: OperationObject }>
const entries = Object.entries(paths)
const schemas = (document.components as { schemas: Record<string, unknown> }).schemas

describe('document', () => {
  it('declares OpenAPI 3.1 and the JSON Schema dialect', () => {
    // 3.1 is JSON Schema 2020-12 compatible, so these schemas can be handed to
    // a validator or a tool-calling runtime unchanged.
    expect(document.openapi).toBe('3.1.0')
    expect(document.jsonSchemaDialect).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    )
  })

  it('names a server, contact and external docs', () => {
    expect(document.servers).toEqual([
      { url: 'https://marcusboni.com.br', description: 'Production' },
    ])
    const info = document.info as { contact: { email: string }; description: string }
    expect(info.contact.email).toBe('mgalvaoboni@gmail.com')
    expect(info.description).toContain('read-only')
  })

  it('says plainly that there is no authentication', () => {
    // The absence of a securitySchemes block is ambiguous — it could mean
    // "public" or "undocumented". The description resolves it.
    expect(document.components).not.toHaveProperty('securitySchemes')
    expect((document.info as { description: string }).description).toContain('no API keys')
  })

  it('documents exactly the operations the API implements', () => {
    expect(Object.keys(paths).sort()).toEqual(OPERATIONS.map((o) => o.path).sort())
  })
})

describe('every operation is callable as a function definition', () => {
  it.each(entries)('%s', (path, { get }) => {
    expect(get.operationId, `${path} needs an operationId`).toBeTruthy()
    // Function names in tool-calling formats are identifiers, not free text.
    expect(get.operationId).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    expect(get.summary?.length ?? 0).toBeGreaterThan(10)
    // The description is what a model reads to decide whether to call this.
    expect(get.description?.length ?? 0).toBeGreaterThan(40)
    expect(get.tags?.length ?? 0).toBeGreaterThan(0)
  })

  it('gives every operation a unique operationId', () => {
    const ids = entries.map(([, { get }]) => get.operationId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('types every path parameter and describes it', () => {
    for (const [path, { get }] of entries) {
      const placeholders = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
      const declared = get.parameters ?? []
      expect(declared.map((p) => p.name).sort()).toEqual(placeholders.sort())

      for (const parameter of declared) {
        expect(parameter.in).toBe('path')
        expect(parameter.required).toBe(true)
        expect(parameter.description.length).toBeGreaterThan(10)
        expect(parameter.schema).toHaveProperty('type')
      }
    }
  })
})

describe('every operation types its responses', () => {
  it.each(entries)('%s returns a schema on 200', (_path, { get }) => {
    const ok = get.responses['200']
    expect(ok).toBeDefined()
    const schema = ok.content?.['application/json']?.schema as { $ref?: string }
    expect(schema?.$ref, 'the 200 response must reference a named schema').toMatch(
      /^#\/components\/schemas\//,
    )
  })

  it.each(entries)('%s documents its errors as problem+json', (_path, { get }) => {
    for (const status of ['404', '405', '406']) {
      const response = get.responses[status]
      expect(response, `missing ${status}`).toBeDefined()
      expect(response.content).toHaveProperty('application/problem+json')
    }
  })

  it('documents 503 only where an upstream can actually fail', () => {
    for (const operation of OPERATIONS) {
      const has = Boolean(paths[operation.path].get.responses['503'])
      expect(has, `${operation.operationId}`).toBe(operation.kind === 'live')
    }
  })
})

describe('schemas', () => {
  it('resolves every $ref to a defined schema', () => {
    const refs = [...JSON.stringify(document).matchAll(/"#\/components\/schemas\/([^"]+)"/g)]
    expect(refs.length).toBeGreaterThan(0)
    for (const [, name] of refs) {
      expect(schemas, `dangling $ref to ${name}`).toHaveProperty(name)
    }
  })

  it('leaves no schema unreferenced', () => {
    const body = JSON.stringify(document.paths) + JSON.stringify(document.components)
    for (const name of Object.keys(schemas)) {
      expect(body.includes(`#/components/schemas/${name}`), `${name} is unused`).toBe(true)
    }
  })

  it('gives every schema a type or a composition keyword', () => {
    for (const [name, schema] of Object.entries(schemas)) {
      const value = schema as Record<string, unknown>
      const typed = 'type' in value || 'allOf' in value || 'oneOf' in value || '$ref' in value
      expect(typed, `${name} has no type`).toBe(true)
    }
  })

  it('uses 3.1 nullability, not the 3.0 nullable flag', () => {
    expect(JSON.stringify(document)).not.toContain('"nullable"')
    // `endedAt` is the canonical nullable field: the role is ongoing.
    const experience = schemas.Experience as { properties: Record<string, { type: unknown }> }
    expect(experience.properties.endedAt.type).toEqual(['string', 'null'])
  })

  it('describes the error shape with a stable code and a hint', () => {
    const problem = schemas.Problem as {
      required: string[]
      properties: { code: { enum: string[] }; hint: { description: string } }
    }
    // "structured JSON error responses with error codes, messages, and
    // resolution hints" — all three are required members, not optional extras.
    for (const member of ['type', 'title', 'status', 'detail', 'code', 'hint']) {
      expect(problem.required).toContain(member)
    }
    expect(problem.properties.code.enum).toContain('not_found')
  })
})

describe('paths', () => {
  it('versions every operation under /api/v1', () => {
    for (const path of Object.keys(paths)) {
      expect(path.startsWith(API_BASE)).toBe(true)
    }
  })

  it('exposes only read operations', () => {
    for (const [path, methods] of Object.entries(paths)) {
      expect(Object.keys(methods), `${path} must be GET-only`).toEqual(['get'])
    }
  })
})
