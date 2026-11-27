import type { Locale } from '@/i18n/translations'

import type { AgentLens, SlashCommandDef } from './types'

/**
 * Curated editorial knowledge layer that complements `SiteContent` (profile,
 * projects, experience, techStack) and published blog posts.
 *
 * Every claim here mirrors `public/llms-full.txt`, `netlify/lib/agent-docs.ts`
 * and `public/contact.html` — never fabricating degrees, rates, unshipped
 * technologies, or proficiency bars.
 */

export type KnowledgeNoteTopic =
  | 'work_model'
  | 'client_process'
  | 'ai_philosophy'
  | 'api_readiness'
  | 'languages'
  | 'contact_policy'
  | 'faq'

export interface KnowledgeNote {
  id: string
  topic: KnowledgeNoteTopic
  keywords: string[]
  title: Record<Locale, string>
  body: Record<Locale, string>
  href: string
  /** Allows temporarily hiding a note in `/admin/dossier` without deleting it. Defaults to `true`. */
  enabled?: boolean
}

export const KNOWLEDGE_NOTES: readonly KnowledgeNote[] = [
  {
    id: 'DOC·01',
    topic: 'work_model',
    keywords: [
      'disponibilidade',
      'disponivel',
      'remoto',
      'remote',
      'hibrido',
      'hybrid',
      'freelance',
      'clt',
      'pj',
      'contrato',
      'contract',
      'full-time',
      'fulltime',
      'efetivo',
      'consultoria',
      'consulting',
      'contratar',
      'hire',
      'hiring',
      'vaga',
      'relocation',
      'timezone',
      'fuso',
      'utc',
      'espirito santo',
      'brasil',
      'brazil',
    ],
    title: {
      pt: 'Disponibilidade & formatos de atuação',
      en: 'Availability & engagement formats',
    },
    body: {
      pt: 'Baseado no Espírito Santo, Brasil (UTC−3). Aberto a oportunidades efetivas, contratos, projetos freelance, consultoria técnica ou segunda opinião em arquitetura, IA aplicada e integrações. Atende em português e inglês. Para recrutamento, ajuda incluir formato (efetivo/contrato, remoto/presencial) e faixa.',
      en: 'Based in Espírito Santo, Brazil (UTC−3). Open to full-time roles, contract engagements, freelance builds, technical consulting, or a focused second opinion on architecture, applied AI, and integrations. Works in Portuguese and English. For recruiting inquiries, sharing engagement format (full-time/contract, remote/on-site) and range speeds things up.',
    },
    href: '/contact',
  },
  {
    id: 'DOC·02',
    topic: 'client_process',
    keywords: [
      'cliente',
      'clientes',
      'client',
      'clients',
      'discovery',
      'processo',
      'process',
      'orcamento',
      'orçamento',
      'budget',
      'preco',
      'preço',
      'pricing',
      'valor',
      'quote',
      'proposta',
      'proposal',
      'prazo',
      'timeline',
      'alinhamento',
      'stakeholder',
      'entrega',
      'delivery',
      'produção',
      'production',
    ],
    title: {
      pt: 'Método de trabalho com clientes & orçamento',
      en: 'Client workflow & scoping policy',
    },
    body: {
      pt: 'Atuação ponta a ponta: discovery direto com quem usa o sistema, tradução de regras de negócio em arquitetura clara, implementação de interface e serviço, integração com sistemas legados e deploy em produção. Não há tabela de preço fixa — escopo, estado do sistema legado e prazo definem a proposta fechada por escrito após uma conversa inicial.',
      en: 'End-to-end delivery: direct discovery with end users and stakeholders, translating business rules into clear technical decisions, building UI and backend services, integrating with legacy systems, and shipping to production. There is no fixed rate card — scope, legacy integration surface, and timeline determine a written fixed-scope proposal after a short alignment call.',
    },
    href: '/about',
  },
  {
    id: 'DOC·03',
    topic: 'ai_philosophy',
    keywords: [
      'ia',
      'ai',
      'inteligencia artificial',
      'artificial intelligence',
      'llm',
      'rag',
      'mcp',
      'agente',
      'agentes',
      'agent',
      'agents',
      'pgvector',
      'copilot',
      'copilotkit',
      'whisper',
      'eval',
      'avaliacao',
      'citation',
      'citacoes',
      'prompt',
      'automacao',
      'n8n',
    ],
    title: {
      pt: 'IA aplicada & engenharia orientada a evidências',
      en: 'Applied AI & evidence-driven engineering',
    },
    body: {
      pt: 'Usa IA de forma deliberada como multiplicador de engenharia ancorado em fundamentos. Em produto, já construiu servidor MCP com 16 ferramentas (OptTime), pipeline RAG sobre pgvector com citações obrigatórias e harness de avaliação de busca (Meeting Copilot), transcrição local offline via whisper.cpp CPU/CUDA em Rust (ISPer), assistente virtual com N8N/Firebase (EAV) e simulações assistidas por IA em regras financeiras (Galwan).',
      en: 'Uses AI deliberately as an engineering multiplier grounded in fundamentals. Shipped work includes a 16-tool MCP server (OptTime), a config-driven pgvector RAG pipeline with mandatory citations and a retrieval evaluation harness (Meeting Copilot), offline local speech transcription via whisper.cpp CPU/CUDA in Rust (ISPer), a virtual assistant with N8N/Firebase (EAV), and AI-assisted financial simulations (Galwan).',
    },
    href: '/#work',
  },
  {
    id: 'DOC·04',
    topic: 'languages',
    keywords: [
      'ingles',
      'inglês',
      'english',
      'portugues',
      'português',
      'portuguese',
      'idioma',
      'idiomas',
      'language',
      'languages',
      'bilingue',
      'bilingual',
      'fluente',
      'international',
      'exterior',
    ],
    title: {
      pt: 'Idiomas & comunicação',
      en: 'Languages & communication',
    },
    body: {
      pt: 'Português nativo e inglês profissional — este portfólio, o Diário técnico, os currículos em PDF e a documentação para agentes são mantidos nos dois idiomas, e Marcus atende reuniões e entregas em português ou inglês.',
      en: 'Native Portuguese and professional English — this portfolio, the technical journal, PDF résumés, and machine-readable docs are maintained bilingually, and Marcus works with teams and clients in either language.',
    },
    href: '/about',
  },
  {
    id: 'DOC·05',
    topic: 'api_readiness',
    keywords: [
      'api',
      'openapi',
      'llms',
      'llms.txt',
      'markdown',
      'json',
      'developers',
      'endpoint',
      'endpoints',
      'curl',
      'rss',
      'sitemap',
      'agent-ready',
      'arquitetura deste site',
      'how does this work',
      'como funciona',
      'como isso funciona',
      'motor',
      'engine',
    ],
    title: {
      pt: 'Arquitetura Agent-Ready & OpenAPI 3.1 deste site',
      en: 'Agent-ready architecture & OpenAPI 3.1 surface',
    },
    body: {
      pt: 'Este console não usa um LLM opaco: ele executa um motor determinístico local sobre as mesmas operações documentadas em /openapi.json (/api/v1/profile, /projects, /experience, /stack, /posts) — zero alucinação, zero custo de token e latência em milissegundos. O site também serve /llms.txt, /llms-full.txt e negociação HTTP Accept: text/markdown em qualquer página.',
      en: 'This console runs a deterministic local retrieval runtime over the exact operations specified in /openapi.json (/api/v1/profile, /projects, /experience, /stack, /posts) — zero hallucination, zero token cost, millisecond latency. The site also publishes /llms.txt, /llms-full.txt, and HTTP Accept: text/markdown content negotiation on every page.',
    },
    href: '/developers',
  },
  {
    id: 'DOC·06',
    topic: 'contact_policy',
    keywords: [
      'contato',
      'contact',
      'email',
      'e-mail',
      'telefone',
      'phone',
      'whatsapp',
      'linkedin',
      'github',
      'agenda',
      'calendly',
      'mensagem',
      'message',
      'falar',
      'talk',
      'reach',
    ],
    title: {
      pt: 'Canais públicos de contato',
      en: 'Public contact channels',
    },
    body: {
      pt: 'E-mail (mgalvaoboni@gmail.com) e o formulário integrado ao inbox do site são a porta de entrada principal — além de GitHub (@Marcus-Boni) e LinkedIn. Não há telefone comercial nem link de agenda publicado.',
      en: 'Email (mgalvaoboni@gmail.com) and the built-in site inbox form are the primary front door, alongside GitHub (@Marcus-Boni) and LinkedIn. There is no published phone number or public calendar link.',
    },
    href: '/contact',
  },
]

/**
 * Canonical tech ontology: maps normalized aliases/synonyms/concepts to the
 * canonical stack labels in `profile.ts` (or domain markers).
 */
export const TECH_ONTOLOGY: Record<string, readonly string[]> = {
  React: ['react', 'reactjs', 'react.js', 'jsx', 'hooks', 'spa', 'frontend', 'front-end', 'front end', 'interface', 'ui'],
  'Next.js': ['next', 'nextjs', 'next.js', 'app router', 'ssr', 'rsc'],
  TypeScript: ['typescript', 'ts', 'tsx', 'tipagem', 'javascript', 'js', 'ecmascript'],
  'Tailwind CSS': ['tailwind', 'tailwindcss', 'tailwind css', 'css', 'design system', 'estilizacao', 'styling'],
  'React Native': ['react native', 'react-native', 'expo', 'mobile', 'app mobile'],
  Astro: ['astro', 'astro.build', 'static site', 'ssg'],
  Flutter: ['flutter', 'dart', 'mobile', 'android', 'ios'],
  WebGL: ['webgl', 'canvas', 'shader', 'shaders', '3d', 'graficos', 'graphics'],
  'C#': ['c#', 'csharp', 'dotnet', '.net', 'asp.net', 'aspnet', 'asp net'],
  Java: ['java', 'jvm'],
  Python: ['python', 'py'],
  'Node.js': ['node', 'nodejs', 'node.js', 'express', 'backend', 'back-end', 'back end', 'api', 'apis', 'rest'],
  Rust: ['rust', 'cargo', 'crate', 'crates', 'nativo', 'native', 'systems', 'sistemas locais', 'desktop', 'whisper', 'whisper.cpp', 'cuda'],
  Tauri: ['tauri', 'tauri 2', 'tauri2', 'desktop', 'windows'],
  MCP: ['mcp', 'model context protocol', 'tool calling', 'tools', 'agentes', 'agent', 'agents', 'ia', 'ai'],
  PostgreSQL: ['postgresql', 'postgres', 'pg', 'psql', 'relacional', 'relational', 'banco de dados', 'database', 'sql'],
  'SQL Server': ['sql server', 'mssql', 't-sql', 'tsql', 'microsoft sql'],
  Supabase: ['supabase', 'baas'],
  Firebase: ['firebase', 'firestore', 'firebase storage', 'gcp firebase'],
  SQLite: ['sqlite', 'sqlite3', 'embedded db'],
  Neon: ['neon', 'neon db', 'serverless postgres'],
  Turso: ['turso', 'libsql'],
  Drizzle: ['drizzle', 'drizzle orm', 'orm'],
  pgvector: ['pgvector', 'vector', 'vetorial', 'embeddings', 'rag', 'busca vetorial', 'retrieval', 'copilotkit'],
  Docker: ['docker', 'container', 'containers', 'dockerfile', 'compose', 'docker compose'],
  Azure: ['azure', 'microsoft azure', 'cloud', 'nuvem'],
  'Azure DevOps': ['azure devops', 'ado', 'work items', 'boards', 'pipelines', 'devops'],
  Portainer: ['portainer', 'container management'],
  IIS: ['iis', 'windows server', 'cors', 'active directory', 'ad auth'],
  Netlify: ['netlify', 'edge functions', 'edge', 'jamstack', 'deploy'],
  'GitHub Actions': ['github actions', 'ci', 'cd', 'ci/cd', 'cicd', 'workflows', 'releases'],
}

/**
 * Domain/sector aliases used to match recruiter questions like "saúde",
 * "healthcare", "ERP", "logística", "financeiro", "imobiliário", "IA".
 */
export const DOMAIN_ONTOLOGY: Record<string, readonly string[]> = {
  'Applied AI & RAG': ['ia', 'ai', 'llm', 'rag', 'mcp', 'chatbot', 'assistente', 'assistant', 'copilot', 'whisper', 'n8n', 'inteligencia artificial', 'artificial intelligence', 'genai', 'generative ai'],
  'Enterprise & ERP Integration': ['erp', 'sankhya', 'webservice', 'active directory', 'ad', 'legado', 'legacy', 'b2b', 'integracao', 'integracoes', 'integration', 'integrations', 'corporativo', 'enterprise'],
  'Healthcare (Unimed)': ['saude', 'saúde', 'healthcare', 'hospital', 'medico', 'médico', 'guias', 'unimed'],
  'Logistics & Supply': ['logistica', 'logística', 'logistics', 'suprimentos', 'supply', 'embarque', 'materiais', 'aguia branca', 'cedisa'],
  'Industry & Environment': ['industria', 'indústria', 'industry', 'producao', 'produção', 'meio ambiente', 'environment', 'pwa', 'hidrauvit', 'marca ambiental'],
  'Real Estate & Finance': ['imobiliario', 'imobiliário', 'real estate', 'financeiro', 'financial', 'kpi', 'parcelamento', 'pagamento', 'payment', 'galwan'],
  'Desktop & Local Systems': ['desktop', 'offline', 'voz', 'voice', 'ditado', 'dictation', 'transcricao', 'transcrição', 'transcription', 'teams', 'windows', 'isper'],
}

/**
 * Well-known technologies NOT in Marcus's public stack, paired with honest
 * adjacent technologies he DOES have evidence for. Used by `/fit` so pasted
 * job descriptions produce accurate, transparent gap reports.
 */
export const EXTERNAL_TECH_CATALOG: readonly {
  name: string
  aliases: readonly string[]
  adjacent: readonly string[]
}[] = [
  { name: 'Kubernetes', aliases: ['kubernetes', 'k8s', 'eks', 'aks', 'gke', 'helm'], adjacent: ['Docker', 'Portainer', 'Azure'] },
  { name: 'AWS', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'dynamodb', 'ecs'], adjacent: ['Azure', 'Netlify', 'Firebase'] },
  { name: 'GCP', aliases: ['gcp', 'google cloud', 'cloud run', 'bigquery'], adjacent: ['Firebase', 'Azure'] },
  { name: 'Terraform', aliases: ['terraform', 'iac', 'pulumi', 'cloudformation'], adjacent: ['Docker', 'Azure DevOps', 'GitHub Actions'] },
  { name: 'Go', aliases: ['golang', 'go lang'], adjacent: ['Rust', 'Node.js', 'C#'] },
  { name: 'Ruby on Rails', aliases: ['ruby', 'rails', 'ruby on rails'], adjacent: ['Node.js', 'TypeScript', 'Next.js'] },
  { name: 'PHP / Laravel', aliases: ['php', 'laravel', 'symfony'], adjacent: ['Node.js', 'C#', 'Python'] },
  { name: 'Angular', aliases: ['angular', 'angularjs', 'rxjs'], adjacent: ['React', 'Next.js', 'TypeScript'] },
  { name: 'Vue.js', aliases: ['vue', 'vuejs', 'vue.js', 'nuxt', 'nuxtjs'], adjacent: ['React', 'Next.js', 'Astro'] },
  { name: 'Svelte', aliases: ['svelte', 'sveltekit'], adjacent: ['React', 'Astro', 'TypeScript'] },
  { name: 'GraphQL', aliases: ['graphql', 'apollo', 'hasura'], adjacent: ['REST APIs', 'TypeScript', 'Node.js'] },
  { name: 'Redis', aliases: ['redis', 'valkey', 'memcached'], adjacent: ['PostgreSQL', 'SQLite', 'Firebase'] },
  { name: 'MongoDB', aliases: ['mongodb', 'mongo', 'mongoose'], adjacent: ['Firebase', 'PostgreSQL'] },
  { name: 'Kafka', aliases: ['kafka', 'confluent', 'event streaming'], adjacent: ['Azure DevOps', 'Node.js', 'PostgreSQL'] },
  { name: 'RabbitMQ', aliases: ['rabbitmq', 'amqp', 'sqs'], adjacent: ['Node.js', 'N8N'] },
  { name: 'Prisma', aliases: ['prisma', 'prisma orm'], adjacent: ['Drizzle', 'PostgreSQL'] },
  { name: 'NestJS', aliases: ['nestjs', 'nest.js'], adjacent: ['Node.js', 'TypeScript'] },
  { name: 'Spring Boot', aliases: ['spring', 'spring boot', 'springboot'], adjacent: ['Java', 'C#'] },
  { name: 'Django / FastAPI', aliases: ['django', 'fastapi', 'flask'], adjacent: ['Python', 'Node.js'] },
  { name: 'Swift', aliases: ['swift', 'swiftui', 'objective-c'], adjacent: ['Flutter', 'React Native'] },
  { name: 'Kotlin', aliases: ['kotlin', 'jetpack compose'], adjacent: ['Flutter', 'Java', 'React Native'] },
  { name: 'Elixir', aliases: ['elixir', 'phoenix'], adjacent: ['Rust', 'Node.js'] },
  { name: 'C++', aliases: ['c++', 'cpp'], adjacent: ['Rust', 'whisper.cpp'] },
  { name: 'Elasticsearch', aliases: ['elasticsearch', 'opensearch', 'algolia'], adjacent: ['pgvector', 'PostgreSQL'] },
  { name: 'Snowflake / Databricks', aliases: ['snowflake', 'databricks', 'spark', 'airflow', 'dbt'], adjacent: ['PostgreSQL', 'SQL Server', 'Python'] },
  { name: 'Datadog / Grafana', aliases: ['datadog', 'grafana', 'prometheus', 'opentelemetry', 'new relic'], adjacent: ['Azure DevOps', 'GitHub Actions'] },
  { name: 'SAP', aliases: ['sap', 'abap', 's/4hana'], adjacent: ['Sankhya ERP', 'REST APIs'] },
  { name: 'Salesforce', aliases: ['salesforce', 'apex'], adjacent: ['REST APIs', 'B2B'] },
  { name: 'Playwright / Cypress', aliases: ['playwright', 'cypress', 'selenium'], adjacent: ['Vitest', 'TypeScript'] },
  { name: 'LangChain', aliases: ['langchain', 'langgraph', 'llamaindex', 'crewai'], adjacent: ['MCP', 'pgvector', 'CopilotKit', 'RAG'] },
  { name: 'PyTorch / TensorFlow', aliases: ['pytorch', 'tensorflow', 'scikit-learn', 'fine-tuning'], adjacent: ['Python', 'whisper.cpp', 'CUDA', 'RAG'] },
]

export const SLASH_COMMANDS: readonly SlashCommandDef[] = [
  {
    command: '/fit',
    label: { pt: 'Analisar vaga', en: 'Match a role' },
    description: {
      pt: 'Cole a descrição de uma vaga para mapear evidências reais e lacunas',
      en: 'Paste a job description to map verified evidence and honest gaps',
    },
    template: { pt: '/fit ', en: '/fit ' },
  },
  {
    command: '/stack',
    label: { pt: 'Stack & provas', en: 'Stack & evidence' },
    description: {
      pt: 'Lista tecnologias por disciplina ligadas a projetos e clientes',
      en: 'List technologies by discipline linked to real projects and clients',
    },
    template: {
      pt: '/stack TypeScript, Rust e PostgreSQL',
      en: '/stack TypeScript, Rust and PostgreSQL',
    },
  },
  {
    command: '/projects',
    label: { pt: 'Projetos selecionados', en: 'Selected projects' },
    description: {
      pt: 'Consulta repositórios em destaque (ISPer, OptTime, Meeting Copilot…)',
      en: 'Inspect featured repositories (ISPer, OptTime, Meeting Copilot…)',
    },
    template: {
      pt: '/projects Quais projetos mostram IA aplicada e sistemas locais?',
      en: '/projects Which projects demonstrate applied AI and native systems?',
    },
  },
  {
    command: '/activity',
    label: { pt: 'Atividade no GitHub', en: 'GitHub activity' },
    description: {
      pt: 'Consulta releases recentes e repositórios atualizados ao vivo no GitHub',
      en: 'Fetch live recent releases and pushed repositories from GitHub',
    },
    template: {
      pt: '/activity Quais são as últimas releases e atualizações recentes no GitHub?',
      en: '/activity What are the latest GitHub releases and recent updates?',
    },
  },
  {
    command: '/experience',
    label: { pt: 'Entregas em clientes', en: 'Client engagements' },
    description: {
      pt: 'Mostra entregas em produção na Optsolv por setor e escopo',
      en: 'Inspect production deliveries at Optsolv by sector and scope',
    },
    template: {
      pt: '/experience Quais clientes e setores o Marcus já atendeu?',
      en: '/experience Which clients and sectors has Marcus delivered for?',
    },
  },
  {
    command: '/posts',
    label: { pt: 'Diário técnico', en: 'Engineering notes' },
    description: {
      pt: 'Busca registros publicados no blog sobre arquitetura e IA',
      en: 'Search published journal entries on architecture and applied AI',
    },
    template: {
      pt: '/posts O que o Marcus escreveu recentemente no Diário?',
      en: '/posts What has Marcus written recently in the journal?',
    },
  },
  {
    command: '/cv',
    label: { pt: 'Currículo PDF', en: 'PDF Résumé' },
    description: {
      pt: 'Prepara o download do currículo atualizado em PT-BR ou EN',
      en: 'Prepare the latest résumé PDF download in PT-BR or EN',
    },
    template: { pt: '/cv', en: '/cv' },
  },
  {
    command: '/contact',
    label: { pt: 'Falar com Marcus', en: 'Reach Marcus' },
    description: {
      pt: 'Prepara um handoff direto para o inbox do Marcus com aprovação',
      en: 'Prepare a direct handoff to Marcus’s inbox with explicit approval',
    },
    template: {
      pt: '/contact Quero conversar sobre uma vaga ou projeto',
      en: '/contact I would like to discuss a role or project',
    },
  },
  {
    command: '/api',
    label: { pt: 'Como funciona', en: 'How this works' },
    description: {
      pt: 'Explica o runtime determinístico e os endpoints OpenAPI 3.1',
      en: 'Explain the deterministic runtime and OpenAPI 3.1 endpoints',
    },
    template: {
      pt: '/api Como este console e a API /api/v1 funcionam?',
      en: '/api How do this console and the /api/v1 API work?',
    },
  },
]

export const STARTER_PROMPTS: Record<Locale, Record<AgentLens, readonly string[]>> = {
  pt: {
    recruiter: [
      'Stack em produção & IA',
      'Entregas na Optsolv',
      'Baixar currículo PDF',
      'Disponibilidade e idiomas',
    ],
    engineer: [
      'Arquitetura de MCP, RAG e Rust',
      'Como funciona a OpenAPI 3.1 daqui',
      'Integrações legadas em produção',
      'Artigos do Diário técnico',
    ],
    client: [
      'Do discovery ao deploy',
      'Experiência com ERP e IA',
      'Setores já atendidos',
      '/contact Quero conversar sobre um projeto',
    ],
  },
  en: {
    recruiter: [
      'Production stack & AI',
      'Optsolv client work',
      'Download PDF résumé',
      'Availability & languages',
    ],
    engineer: [
      'MCP, RAG & Rust architecture',
      'How this OpenAPI 3.1 works',
      'Legacy production integrations',
      'Recent engineering notes',
    ],
    client: [
      'Discovery to production workflow',
      'ERP & applied AI deliveries',
      'Industries delivered',
      '/contact I would like to discuss a project',
    ],
  },
}

export const SAMPLE_JOB_DESCRIPTIONS: Record<Locale, { label: string; text: string }> = {
  pt: {
    label: 'Analisar vaga (/fit)',
    text: `/fit Engenheiro(a) de Software Full-Stack & IA Aplicada (Remoto)
Requisitos:
- Sólida experiência com TypeScript, React e Next.js
- Experiência prática com Node.js, PostgreSQL e integração de APIs REST
- Vivência com IA aplicada (RAG, pgvector, servidores MCP ou agentes com citações)
- Docker, pipelines de CI/CD (GitHub Actions ou Azure DevOps)
- Diferenciais: Rust, Kubernetes, Redis e GraphQL
- Boa comunicação direta com stakeholders e clientes`,
  },
  en: {
    label: 'Match a role (/fit)',
    text: `/fit Senior Full-Stack & Applied AI Engineer (Remote)
Requirements:
- Strong experience with TypeScript, React, and Next.js
- Production backend work with Node.js, PostgreSQL, and REST APIs
- Hands-on applied AI: RAG pipelines, pgvector, MCP servers, or grounded agents
- Docker and CI/CD pipelines (GitHub Actions or Azure DevOps)
- Nice to have: Rust, Kubernetes, Redis, and GraphQL
- Direct client communication from discovery to production`,
  },
}
