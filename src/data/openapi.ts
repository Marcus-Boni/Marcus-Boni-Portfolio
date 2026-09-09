import { API_VERSION, OPERATIONS, type Operation } from '@/data/api'

/**
 * The OpenAPI 3.1 description of the public content API.
 *
 * Built from `OPERATIONS` rather than written alongside it, so a documented
 * endpoint that does not exist — or an endpoint nobody documented — is not
 * expressible. `tests/openapi.test.ts` checks the rest: every operation has a
 * unique `operationId`, a description, typed parameters and a response schema,
 * which is what makes the surface usable as LLM function-calling definitions.
 *
 * 3.1 rather than 3.0 on purpose: it is JSON Schema 2020-12 compatible, so the
 * schemas below can be handed to a validator or a tool-calling runtime
 * unchanged. Nullability is `type: [..., 'null']`, not the 3.0 `nullable` flag.
 */

const SITE_URL = 'https://marcusboni.com.br'

type Json = Record<string, unknown>

/** A bilingual string, used for every piece of prose the site publishes twice. */
const localized: Json = {
  type: 'object',
  description: 'The same text in both languages the site publishes.',
  required: ['pt', 'en'],
  additionalProperties: false,
  properties: {
    pt: { type: 'string', description: 'Brazilian Portuguese.' },
    en: { type: 'string', description: 'English.' },
  },
}

function collection(itemRef: string, description: string): Json {
  return {
    type: 'object',
    description,
    required: ['count', 'items'],
    additionalProperties: false,
    properties: {
      count: {
        type: 'integer',
        minimum: 0,
        description: 'Number of entries in `items`. The API is not paginated.',
      },
      items: { type: 'array', items: { $ref: `#/components/schemas/${itemRef}` } },
    },
  }
}

const schemas: Record<string, Json> = {
  Localized: localized,

  ApiIndex: {
    type: 'object',
    description: 'Entry point: what this API is and which operations it exposes.',
    required: ['name', 'description', 'version', 'documentation', 'openapi', 'endpoints'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      version: { type: 'string', description: 'Semantic version of the API contract.' },
      documentation: { type: 'string', format: 'uri' },
      openapi: { type: 'string', format: 'uri' },
      endpoints: {
        type: 'array',
        items: {
          type: 'object',
          required: ['method', 'path', 'operationId', 'summary'],
          properties: {
            method: { type: 'string', enum: ['GET'] },
            path: { type: 'string' },
            operationId: { type: 'string' },
            summary: { type: 'string' },
          },
        },
      },
    },
  },

  Profile: {
    type: 'object',
    description: 'Who the site belongs to, and the public ways to reach them.',
    required: ['name', 'fullName', 'role', 'employer', 'location', 'email', 'links'],
    properties: {
      name: { type: 'string', description: 'The name used publicly.' },
      fullName: { type: 'string', description: 'Full legal name.' },
      role: { type: 'string', example: 'Software Engineer' },
      employer: {
        type: 'object',
        required: ['company', 'role', 'since', 'current'],
        properties: {
          company: { type: 'string' },
          role: { type: 'string' },
          since: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}$',
            description: 'Start month, `YYYY-MM`.',
          },
          current: { type: 'boolean', description: 'False once the role has ended.' },
        },
      },
      location: {
        type: 'object',
        required: ['region', 'country'],
        properties: {
          region: { type: 'string', example: 'Espírito Santo' },
          country: { type: 'string', example: 'Brazil' },
        },
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'The only contact address published. There is no phone number.',
      },
      bio: { $ref: '#/components/schemas/Localized' },
      repositoryCount: {
        type: 'integer',
        minimum: 0,
        description: 'Public repositories on GitHub at the last site update.',
      },
      languages: {
        type: 'array',
        items: { type: 'string' },
        description: 'BCP 47 tags for the languages the site is published in.',
      },
      links: {
        type: 'array',
        description: 'Public profiles. Do not infer channels that are not listed.',
        items: {
          type: 'object',
          required: ['label', 'handle', 'url'],
          properties: {
            label: { type: 'string' },
            handle: { type: 'string' },
            url: { type: 'string' },
          },
        },
      },
      resumes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['language', 'url'],
          properties: {
            language: { type: 'string', enum: ['pt-BR', 'en'] },
            url: { type: 'string', format: 'uri' },
          },
        },
      },
    },
  },

  Project: {
    type: 'object',
    description: 'A personal project featured on the site.',
    required: ['id', 'title', 'year', 'description', 'stack', 'repositoryUrl'],
    properties: {
      id: { type: 'string', description: 'Editorial index shown on the site.', example: '01' },
      title: { type: 'string' },
      year: { type: 'string', pattern: '^\\d{4}$' },
      description: { $ref: '#/components/schemas/Localized' },
      stack: { type: 'array', items: { type: 'string' } },
      repositoryUrl: { type: 'string', format: 'uri' },
    },
  },
  ProjectCollection: collection('Project', 'Selected personal projects.'),

  Engagement: {
    type: 'object',
    description: 'One client project delivered in the current role.',
    required: ['id', 'client', 'project', 'sector', 'scope', 'stack'],
    properties: {
      id: { type: 'string' },
      client: { type: 'string' },
      project: { $ref: '#/components/schemas/Localized' },
      sector: { $ref: '#/components/schemas/Localized' },
      scope: {
        allOf: [{ $ref: '#/components/schemas/Localized' }],
        description: 'What was actually built and delivered.',
      },
      stack: { type: 'array', items: { type: 'string' } },
    },
  },

  Experience: {
    type: 'object',
    description: 'The current professional role and everything delivered in it.',
    required: ['role', 'company', 'startedAt', 'endedAt', 'current', 'engagements'],
    properties: {
      role: { type: 'string' },
      company: { type: 'string' },
      startedAt: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
      endedAt: {
        type: ['string', 'null'],
        description: '`null` while the role is ongoing.',
      },
      current: { type: 'boolean' },
      engagements: {
        type: 'array',
        items: { $ref: '#/components/schemas/Engagement' },
      },
    },
  },

  Technology: {
    type: 'object',
    required: ['name', 'category'],
    properties: {
      name: { type: 'string' },
      category: {
        type: 'string',
        enum: ['frontend', 'backend', 'data', 'ops'],
        description: 'Where the technology sits in the stack.',
      },
    },
  },
  TechnologyCollection: collection('Technology', 'Technologies worked with.'),

  PostSummary: {
    type: 'object',
    description: 'Metadata for one published post, without its body.',
    required: ['slug', 'url', 'title', 'language', 'publishedAt', 'tags'],
    properties: {
      slug: { type: 'string', description: 'Identifier and last URL segment.' },
      url: { type: 'string', format: 'uri' },
      title: { type: 'string' },
      subtitle: { type: 'string' },
      excerpt: { type: 'string', description: 'Plain-text summary, at most 200 characters.' },
      language: { type: 'string', enum: ['pt-BR', 'en'] },
      tags: { type: 'array', items: { type: 'string' } },
      readingMinutes: { type: 'integer', minimum: 1 },
      publishedAt: {
        type: ['string', 'null'],
        format: 'date-time',
        description: 'ISO 8601. `null` only for a post that has never been published.',
      },
      updatedAt: { type: 'string', format: 'date-time' },
      translationOf: {
        type: ['string', 'null'],
        description: 'Slug of the same post in the other language, when one exists.',
      },
      coverUrl: { type: ['string', 'null'], format: 'uri' },
    },
  },
  PostCollection: collection('PostSummary', 'Published posts, newest first.'),

  Post: {
    allOf: [
      { $ref: '#/components/schemas/PostSummary' },
      {
        type: 'object',
        required: ['body'],
        properties: {
          body: {
            type: 'string',
            description:
              'The Markdown source the post was authored in. Image references are resolved to absolute URLs.',
          },
        },
      },
    ],
    description: 'A post with its Markdown body.',
  },

  Problem: {
    type: 'object',
    description:
      'An error, as RFC 9457 `application/problem+json`, extended with a stable `code` and a `hint` naming the next thing to try.',
    required: ['type', 'title', 'status', 'detail', 'code', 'hint'],
    properties: {
      type: {
        type: 'string',
        format: 'uri',
        description: 'Stable URI identifying the error kind.',
      },
      title: { type: 'string', description: 'Short, human-readable summary.' },
      status: { type: 'integer', description: 'Repeats the HTTP status code.' },
      detail: { type: 'string', description: 'What went wrong with this request.' },
      instance: { type: 'string', description: 'The path that produced the error.' },
      code: {
        type: 'string',
        description: 'Machine-readable error code, stable across releases.',
        enum: ['not_found', 'method_not_allowed', 'not_acceptable', 'upstream_unavailable'],
      },
      hint: { type: 'string', description: 'A concrete resolution step.' },
    },
  },
}

const PROBLEM_CONTENT = {
  'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } },
}

/** Error responses every operation can produce. */
const commonErrors: Json = {
  '404': {
    description: 'No such resource. The body names where the real ones are.',
    content: PROBLEM_CONTENT,
  },
  '405': {
    description: 'The API is read-only; only GET and HEAD are accepted.',
    content: PROBLEM_CONTENT,
  },
  '406': {
    description: 'The `Accept` header rules out `application/json`.',
    content: PROBLEM_CONTENT,
  },
}

function pathParameters(path: string): Json[] {
  const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1])
  return names.map((name) => ({
    name,
    in: 'path',
    required: true,
    description:
      name === 'slug'
        ? 'The post identifier, as it appears in the blog URL. Lowercase, hyphen-separated.'
        : `Path parameter \`${name}\`.`,
    schema: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    example: 'estudo-de-mercado',
  }))
}

function operationObject(operation: Operation): Json {
  const parameters = pathParameters(operation.path)
  return {
    operationId: operation.operationId,
    summary: operation.summary,
    description: operation.description,
    tags: [operation.path.includes('/posts') ? 'blog' : 'profile'],
    ...(parameters.length > 0 ? { parameters } : {}),
    responses: {
      '200': {
        description: operation.summary,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${operation.schema}` },
          },
        },
      },
      ...commonErrors,
      ...(operation.kind === 'live'
        ? {
            '503': {
              description:
                'The content database could not be reached. The request is worth retrying.',
              content: PROBLEM_CONTENT,
            },
          }
        : {}),
    },
  }
}

/** The complete OpenAPI document, ready to serialise to `/openapi.json`. */
export function openApiDocument(): Json {
  const paths: Json = {}
  for (const operation of OPERATIONS) {
    paths[operation.path] = { get: operationObject(operation) }
  }

  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'Marcus Boni — public content API',
      version: API_VERSION,
      summary: 'Read-only JSON representations of a personal portfolio and technical blog.',
      description: [
        'Everything published on marcusboni.com.br, as JSON: profile, selected projects,',
        'client engagements, technology stack and blog posts.',
        '',
        'The API is **public, read-only and unauthenticated**. There are no API keys, no',
        'OAuth scopes, no write operations, no webhooks and no published rate limit.',
        'Every endpoint below is the production endpoint, which makes the API its own',
        'sandbox.',
        '',
        'Errors are RFC 9457 `application/problem+json` with a stable `code` and a `hint`.',
        'The same content is available as Markdown from the HTML URLs via',
        '`Accept: text/markdown` — see https://marcusboni.com.br/developers.',
      ].join('\n'),
      contact: {
        name: 'Marcus Boni',
        email: 'mgalvaoboni@gmail.com',
        url: `${SITE_URL}/developers`,
      },
      license: {
        name: 'Content © Marcus Boni — quote with attribution',
        url: `${SITE_URL}/developers`,
      },
    },
    externalDocs: {
      description: 'Developer portal, with curl examples for every endpoint',
      url: `${SITE_URL}/developers`,
    },
    servers: [{ url: SITE_URL, description: 'Production' }],
    tags: [
      {
        name: 'profile',
        description: 'Who the site is about: identity, projects, experience, stack.',
      },
      { name: 'blog', description: 'Published writing, served live from the database.' },
    ],
    paths,
    components: { schemas },
  }
}
