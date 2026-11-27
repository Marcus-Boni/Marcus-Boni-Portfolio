import type { Locale } from '@/i18n/translations'

export interface Project {
  /** Stable client id (used as React key in the admin editor). */
  id?: string
  index: string
  title: string
  description: Record<Locale, string>
  stack: string[]
  year: string
  url: string
}

export interface TechItem {
  id?: string
  name: string
  category: 'frontend' | 'backend' | 'data' | 'ops'
}

export interface ExperienceProject {
  id: string
  client: string
  title: Record<Locale, string>
  sector: Record<Locale, string>
  scope: Record<Locale, string>
  stack: string[]
  /**
   * `false` keeps the entry out of the home Experience ledger. The dossier,
   * `/fit`, the API and the machine-readable copies still use it.
   */
  home?: boolean
}

export interface Experience {
  role: string
  company: string
  /** ISO-ish `YYYY-MM` start, used for the timeline anchor. */
  start: string
  /** `null` ⇒ still ongoing ("Present"). */
  end: string | null
  projects: ExperienceProject[]
}

export interface SocialLink {
  id?: string
  label: string
  handle: string
  url: string
}

export const profile = {
  name: 'Marcus Boni',
  fullName: 'Marcus Evandro Galvão Boni',
  role: 'Software Engineer',
  location: 'Espírito Santo, Brazil',
  locationShort: 'ES — BRA',
  email: 'mgalvaoboni@gmail.com',
  github: 'https://github.com/Marcus-Boni',
  // Self-hosted, WebP-optimized copy of the GitHub avatar (~22 KB vs the
  // 632 KB PNG GitHub serves) — no redirect chain, long-lived cache.
  avatar: '/portrait-640.webp',
  bio: 'Engenheiro de software brasileiro construindo software full-stack, sistemas locais e IA aplicada — com facilidade para alinhar diretamente com clientes e levar soluções até produção.',
  repoCount: 75,
} as const

export const projects: Project[] = [
  {
    index: '01',
    title: 'ISPer',
    description: {
      pt: 'Ditado por voz offline no Windows e transcrição de reuniões do Teams em um workspace Rust de 12 crates com Tauri 2 e whisper.cpp (CPU/CUDA), ao longo de 25 releases.',
      en: 'Offline Windows voice dictation and Teams meeting transcription built on a 12-crate Rust workspace with Tauri 2 and whisper.cpp (CPU/CUDA), across 25 releases.',
    },
    stack: ['Rust', 'Tauri 2', 'whisper.cpp', 'CUDA', 'MCP'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/ISPer',
  },
  {
    index: '02',
    title: 'OptTime',
    description: {
      pt: 'Plataforma full-stack de apontamento de horas integrada bidirecionalmente ao Azure DevOps, com extensão nativa e servidor MCP (16 ferramentas) para agentes de IA.',
      en: 'Full-stack time-tracking platform synced bi-directionally with Azure DevOps, featuring a native extension and a 16-tool MCP server for AI agents.',
    },
    stack: ['TypeScript', 'Next.js', 'PostgreSQL', 'Drizzle', 'MCP'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/OptTime',
  },
  {
    index: '03',
    title: 'Meeting Copilot',
    description: {
      pt: 'Arquitetura RAG orientada por configuração para consultar transcrições do Teams sobre pgvector, com citações obrigatórias das fontes, isolamento por workspace e avaliação de busca.',
      en: 'Config-driven RAG architecture for searching Teams meeting transcripts over pgvector, with mandatory source citations, workspace isolation and a retrieval evaluation harness.',
    },
    stack: ['TypeScript', 'Next.js', 'CopilotKit', 'pgvector', 'RAG'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/chatbot-template',
  },
  {
    index: '04',
    title: 'Auto Daily',
    description: {
      pt: 'Aplicação web que sintetiza rascunhos de daily com IA a partir de commits no Azure DevOps e apontamentos de horas do OptTime.',
      en: 'Web app that synthesizes AI-assisted daily standup drafts from Azure DevOps commits and OptTime hour logs.',
    },
    stack: ['TypeScript', 'Next.js', 'Azure DevOps', 'AI'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/Auto-Daily-App',
  },
  {
    index: '05',
    title: 'Estimativa de Horas',
    description: {
      pt: 'Ferramenta web que substituiu planilhas frágeis de Excel na estimativa de horas, puxando work items direto do Azure DevOps com dashboards e exportação.',
      en: 'A web tool that replaced fragile Excel spreadsheets for task-hour estimation, pulling work items straight from Azure DevOps with dashboards and export.',
    },
    stack: ['TypeScript', 'Next.js', 'Azure DevOps', 'Firebase'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/Ferramenta-Estimativa-Horas',
  },
  {
    index: '06',
    title: 'Opt Suporte',
    description: {
      pt: 'Central de suporte dos clientes Optsolv — portal do cliente, backoffice, API REST e servidor MCP sobre a mesma camada de regras e acesso, com login da equipe via Microsoft Entra ID (OIDC + PKCE) e a IA de captura avaliada contra um conjunto rotulado.',
      en: 'Optsolv customer-support hub — client portal, back office, REST API and MCP server over one business and access layer, with team sign-in through Microsoft Entra ID (OIDC + PKCE) and the AI intake evaluated against a labelled set.',
    },
    stack: ['TypeScript', 'React', 'Fastify', 'PostgreSQL', 'MCP'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/Opt-suporte',
  },
  {
    index: '07',
    title: 'Opt News',
    description: {
      pt: 'Plataforma interna de inteligência tecnológica que coleta fontes oficiais e de imprensa, resume em português com IA marcada como IA e liga cada notícia à discussão e ao aprendizado que ela gerou no time, com proveniência de ponta a ponta.',
      en: 'Internal tech-intelligence platform that collects official and press sources, summarizes them in Portuguese with AI clearly labelled as AI, and links each story to the team discussion and learning it sparked, with end-to-end provenance.',
    },
    stack: ['TypeScript', 'React', 'Fastify', 'PostgreSQL', 'AI'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/Opt-news',
  },
]

export const experience: Experience = {
  role: 'Software Developer',
  company: 'Optsolv',
  start: '2024-06',
  end: null,
  projects: [
    {
      id: 'unimed',
      client: 'Unimed Sul Capixaba',
      title: { pt: 'Gestão de Guias', en: 'Medical Guide Management' },
      sector: { pt: 'Saúde', en: 'Healthcare' },
      scope: {
        pt: 'Plataforma de gestão de guias médicas — integração com serviços autenticados via AD, ajustes de CORS em ambiente IIS e rastreabilidade do ciclo de guias de intercâmbio entre operadoras.',
        en: 'Medical-guide management platform — AD-authenticated service integration, CORS tuning on IIS, and full traceability of the inter-operator exchange-guide cycle.',
      },
      stack: ['React', 'REST APIs', 'IIS', 'AD Auth'],
    },
    {
      id: 'hidrauvit',
      client: 'Hidrauvit',
      title: { pt: 'Gestão da Produção', en: 'Production Management' },
      sector: { pt: 'Indústria', en: 'Industry' },
      scope: {
        pt: 'Sistema de gestão da produção em entrega faseada — refino de interface responsiva, alinhamento técnico contínuo com o cliente e integração via WebService.',
        en: 'Phased-delivery production-management system — responsive UI refinement, ongoing technical alignment with the client, and WebService integration.',
      },
      stack: ['React', 'WebService', 'ASP.Net'],
    },
    {
      id: 'eav',
      client: 'EAV - Escola Americana de Vitória',
      title: { pt: 'Assistente Virtual', en: 'Virtual Assistant' },
      sector: { pt: 'Atendimento', en: 'Customer Care' },
      scope: {
        pt: 'Assistente virtual com identidade visual padronizada — design system em Tailwind com cores institucionais e assets públicos no Firebase Storage para e-mails transacionais.',
        en: 'Virtual assistant with a standardized identity — a Tailwind design system in brand colors and public assets on Firebase Storage for transactional emails.',
      },
      stack: ['N8N', 'Firebase', 'Design System', 'AI'],
    },
    {
      id: 'cedisa',
      client: 'Cedisa',
      title: { pt: 'Gestão de Materiais', en: 'Materials Management' },
      sector: { pt: 'Suprimentos', en: 'Supply' },
      scope: {
        pt: 'Gestão de materiais integrada a uma base PostgreSQL legada — APIs REST de consulta, arquitetura de tela e levantamento técnico junto ao time de TI do cliente.',
        en: 'Materials management wired into a legacy PostgreSQL base — REST query APIs, screen architecture, and technical discovery alongside the client IT team.',
      },
      stack: ['Flutter', 'REST APIs', 'Backend', 'Mobile'],
    },
    {
      id: 'gab',
      client: 'GAB - Grupo Águia Branca',
      title: { pt: 'Embarque Já', en: 'Embarque Já' },
      sector: { pt: 'Logística', en: 'Logistics' },
      scope: {
        pt: 'Plataforma operacional de embarque B2B — ambientes de homologação, fluxos administrativos e notificações por e-mail com auditoria e monitoramento de logs.',
        en: 'B2B boarding-operations platform — staging environments, administrative workflows, and email notifications with auditing and log monitoring.',
      },
      stack: ['React', 'Workflow', 'B2B'],
    },
    {
      id: 'marca-ambiental',
      client: 'Marca Ambiental',
      title: { pt: 'Portal do Cliente', en: 'Customer Portal' },
      sector: { pt: 'Meio Ambiente', en: 'Environment' },
      scope: {
        pt: 'Portal web/PWA multi-perfil integrado ao ERP Sankhya — módulos de contratos, financeiro de boletos e notas, medições e documentos, validados com usuários-chave.',
        en: 'Multi-profile web/PWA portal integrated with the Sankhya ERP — contracts, billing & invoices, measurements and documents, validated with key users.',
      },
      stack: ['Node', 'PWA', 'Sankhya ERP', 'PostgreSQL'],
    },
    {
      id: 'galwan',
      client: 'Galwan',
      title: { pt: 'Plano de Pagamento', en: 'Payment Plan' },
      sector: { pt: 'Imobiliário', en: 'Real Estate' },
      scope: {
        pt: 'Motor de plano de pagamento imobiliário com regras de negócio sensíveis — cálculos de parcelamento, múltiplos compradores, KPIs financeiros e simulações com IA (V2).',
        en: 'Real-estate payment-plan engine with sensitive business rules — installment math, multiple buyers, financial KPIs, and AI-assisted simulations (V2).',
      },
      stack: ['Backend', 'Business Rules', 'AI'],
    },
    // From here on, deliveries recorded for the dossier only (`home: false`):
    // the home ledger keeps the seven above. Each was checked against the
    // author's own commits in Azure DevOps, not against the repository total.
    // Order matters: a bare /experience sends only the first 12 citations to
    // the edge model, so the larger deliveries come first.
    {
      id: 'cidade-engenharia',
      client: 'Cidade Engenharia',
      title: { pt: 'Plataforma de Gestão', en: 'Management Platform' },
      sector: { pt: 'Construção', en: 'Construction' },
      scope: {
        pt: 'Plataforma interna extensível que unifica a operação — planejamento comercial de visitas e carteira, painel gerencial, previsão de entregas, PCP e MRP, estoque e orçamentos integrados ao ERP, com agentes no Microsoft Foundry, transcrição de voz e servidor MCP de dados para IA.',
        en: 'Extensible internal platform unifying operations — commercial visit and portfolio planning, a management dashboard, delivery forecasts, production planning and MRP, stock and quotes wired to the ERP, with Microsoft Foundry agents, speech transcription and an MCP data server for AI.',
      },
      stack: ['React', 'TanStack', 'Fastify', 'PostgreSQL', 'MCP', 'Microsoft Foundry'],
      home: false,
    },
    {
      id: 'ab-cientifica',
      client: 'AB Científica',
      title: { pt: 'Cotações e Pedidos', en: 'Quotes & Orders' },
      sector: { pt: 'Distribuição', en: 'Distribution' },
      scope: {
        pt: 'Front-end completo de cotações e pedidos — fluxo de pedido com processamento assistido por IA dos produtos cotados, preço de venda com câmbio, PDF do pedido, dashboard e cadastros, atrás do login Microsoft (MSAL).',
        en: 'Full front end for quotes and orders — an order flow with AI-assisted processing of quoted products, FX-aware sale pricing, order PDFs, a dashboard and master data, behind Microsoft sign-in (MSAL).',
      },
      stack: ['React', 'TypeScript', 'Material UI', 'Microsoft Entra ID'],
      home: false,
    },
    {
      id: 'painel-estrategico',
      client: 'Optsolv',
      title: { pt: 'Painel Estratégico', en: 'Strategy Dashboard' },
      sector: { pt: 'Produto interno', en: 'Internal product' },
      scope: {
        pt: 'Produto para consultores conduzirem o método Sincronismo Organizacional — entrevistas, documentos e indicadores processados por IA com revisão humana de cada sugestão, mapa da empresa e rupturas, iniciativas e pacote da reunião em PDF e PowerPoint.',
        en: 'Product that lets consultants run the Organizational Synchronism method — interviews, documents and indicators processed by AI with human review of every suggestion, a company map with its ruptures, initiatives, and a meeting pack in PDF and PowerPoint.',
      },
      stack: ['Next.js', 'FastAPI', 'Python', 'PostgreSQL', 'OpenAI API'],
      home: false,
    },
    {
      id: 'code-agent',
      client: 'Optsolv',
      title: { pt: 'Code Agent', en: 'Code Agent' },
      sector: { pt: 'Produto interno', en: 'Internal product' },
      scope: {
        pt: 'Serviço que coloca agentes Claude no fluxo do Azure DevOps — piloto de revisão automática de PRs em uso, comandos @claude e serviço central validados em sandbox, com fila no Postgres, teto de custo por repositório, auditoria de segurança e telemetria OpenTelemetry.',
        en: 'Service that brings Claude agents into the Azure DevOps workflow — an automated PR-review pilot in use, @claude commands and the central service validated in a sandbox, with a Postgres queue, a per-repository cost ceiling, security auditing and OpenTelemetry tracing.',
      },
      stack: ['Claude Agent SDK', 'TypeScript', 'Fastify', 'PostgreSQL', 'OpenTelemetry', 'Azure DevOps'],
      home: false,
    },
    {
      id: 'rede-vitoria',
      client: 'Rede Vitória',
      title: { pt: 'Gestão de Eventos', en: 'Event Management' },
      sector: { pt: 'Eventos', en: 'Events' },
      scope: {
        pt: 'MVP que substituiu planilhas e anotações soltas — projetos e eventos recorrentes, planejamento previsto x realizado, fornecedores e notas fiscais com anexos, checklist operacional e prestação de contas exportada em Excel.',
        en: 'MVP that replaced spreadsheets and loose notes — recurring projects and events, planned-vs-actual budgeting, suppliers and invoices with attachments, an operational checklist and Excel-exported expense reports.',
      },
      stack: ['React', 'TypeScript', 'Firebase'],
      home: false,
    },
    {
      id: 'shopping-vitoria',
      client: 'Shopping Vitória',
      title: { pt: 'Atendimento a Lojistas', en: 'Tenant Support' },
      sector: { pt: 'Varejo', en: 'Retail' },
      scope: {
        pt: 'Portal que opera o atendimento a lojistas por WhatsApp com IA — chat com ditado por voz e mídia, base de conhecimento RAG com Azure AI Search e n8n, gestão de usuários e App Check, testado sobre o Firebase Emulator Suite.',
        en: 'Portal that runs AI-assisted WhatsApp support for mall tenants — chat with voice dictation and media, a RAG knowledge base on Azure AI Search and n8n, user management and App Check, tested on the Firebase Emulator Suite.',
      },
      stack: ['React', 'Firebase', 'n8n', 'Azure AI Search', 'RAG'],
      home: false,
    },
    {
      id: 'lbh',
      client: 'LBH Group Brasil',
      title: { pt: 'Navigate', en: 'Navigate' },
      sector: { pt: 'Logística marítima', en: 'Maritime logistics' },
      scope: {
        pt: 'Line-up de navios por terminal para as filiais — relatório e exportação em Excel do tempo de espera, variantes de portos UN/LOCODE e checagem de IMO, interface bilíngue e deploy no Azure App Service.',
        en: 'Per-terminal ship line-up for branch offices — waiting-time reporting and Excel export, UN/LOCODE port variants and IMO checks, a bilingual interface and deployment to Azure App Service.',
      },
      stack: ['Next.js', 'TypeScript', 'Azure'],
      home: false,
    },
    {
      id: 'opt-pms',
      client: 'Optsolv',
      title: { pt: 'Gestão de Projetos (PMS)', en: 'Project Management (PMS)' },
      sector: { pt: 'Produto interno', en: 'Internal product' },
      scope: {
        pt: 'Sistema de gestão de projetos em monorepo — central de projetos, recursos e tarefas lida do banco por repositórios Drizzle, criação e edição de projetos, configurações do sistema e seed de dados.',
        en: 'Monorepo project-management system — a project center, resources and tasks read from the database through Drizzle repositories, project create/edit flows, system settings and data seeding.',
      },
      stack: ['React', 'TanStack', 'Fastify', 'PostgreSQL', 'Drizzle'],
      home: false,
    },
    {
      id: 'site-optsolv',
      client: 'Optsolv',
      title: { pt: 'Site institucional', en: 'Company website' },
      sector: { pt: 'Marketing', en: 'Marketing' },
      scope: {
        pt: 'Novo site sobre Next.js e Payload CMS — home com sistema de movimento (Lenis, GSAP, Motion), tokens da marca e vitrine de design system, portfólio de ofertas, cases com busca e filtros, blog com importação de artigos e páginas legais.',
        en: 'New website on Next.js and Payload CMS — a home page with a motion system (Lenis, GSAP, Motion), brand tokens and a design-system showcase, the offer portfolio, searchable and filterable cases, a blog with article import and legal pages.',
      },
      stack: ['Next.js', 'Payload CMS', 'PostgreSQL', 'GSAP'],
      home: false,
    },
    {
      id: 'gestao-chamados',
      client: 'Optsolv',
      title: { pt: 'Gestão de Chamados', en: 'Ticket Management' },
      sector: { pt: 'Produto interno', en: 'Internal product' },
      scope: {
        pt: 'Servidor MCP com tokens pessoais para agentes de IA abrirem, consultarem e atualizarem chamados com anexos, webhooks de saída assinados com HMAC e retentativas, e chamados restritos ao cliente de cada usuário.',
        en: 'MCP server with personal tokens so AI agents can open, read and update tickets with attachments, HMAC-signed outbound webhooks with retries, and tickets scoped to each user’s client.',
      },
      stack: ['MCP', 'Firebase', 'TypeScript', 'React'],
      home: false,
    },
    {
      id: 'plano-de-corte',
      client: 'Optsolv',
      title: { pt: 'Plano de Corte', en: 'Cutting Plan' },
      sector: { pt: 'Produto interno', en: 'Internal product' },
      scope: {
        pt: 'Fundação do monorepo do otimizador de corte de chapas — PRD da aplicação, Turborepo com pacotes de UI, API e login Microsoft, Biome, commitlint, changesets e verificação de commits antes do push.',
        en: 'Monorepo foundation for the sheet-cutting optimizer — the product requirements document, Turborepo with UI, API and Microsoft sign-in packages, Biome, commitlint, changesets and pre-push commit checks.',
      },
      stack: ['React', 'TanStack', 'Turborepo', 'Microsoft Entra ID'],
      home: false,
    },
    {
      id: 'perfil-aluminio',
      client: 'Perfil Alumínio',
      title: { pt: 'Portal do Cliente', en: 'Customer Portal' },
      sector: { pt: 'Indústria', en: 'Industry' },
      scope: {
        pt: 'Portal B2B de autoatendimento para pedidos, notas, boletos e entregas — redesign da interface e correções no status de remessas e de vendas triangulares.',
        en: 'B2B self-service portal for orders, invoices, payment slips and deliveries — an interface redesign and fixes to shipment and triangular-sale status.',
      },
      stack: ['React', 'Material UI', 'Firebase'],
      home: false,
    },
  ],
}

export const techStack: TechItem[] = [
  { name: 'React', category: 'frontend' },
  { name: 'Next.js', category: 'frontend' },
  { name: 'TypeScript', category: 'frontend' },
  { name: 'Tailwind CSS', category: 'frontend' },
  { name: 'React Native', category: 'frontend' },
  { name: 'Astro', category: 'frontend' },
  { name: 'Flutter', category: 'frontend' },
  { name: 'WebGL', category: 'frontend' },
  { name: 'TanStack', category: 'frontend' },
  { name: 'Material UI', category: 'frontend' },
  { name: 'GSAP', category: 'frontend' },
  { name: 'C#', category: 'backend' },
  { name: 'Java', category: 'backend' },
  { name: 'Python', category: 'backend' },
  { name: 'Node.js', category: 'backend' },
  { name: 'Rust', category: 'backend' },
  { name: 'Tauri', category: 'backend' },
  { name: 'MCP', category: 'backend' },
  { name: 'Fastify', category: 'backend' },
  { name: 'FastAPI', category: 'backend' },
  { name: 'n8n', category: 'backend' },
  { name: 'Claude Agent SDK', category: 'backend' },
  { name: 'OpenAI API', category: 'backend' },
  { name: 'PostgreSQL', category: 'data' },
  { name: 'SQL Server', category: 'data' },
  { name: 'Supabase', category: 'data' },
  { name: 'Firebase', category: 'data' },
  { name: 'SQLite', category: 'data' },
  { name: 'Neon', category: 'data' },
  { name: 'Turso', category: 'data' },
  { name: 'Drizzle', category: 'data' },
  { name: 'pgvector', category: 'data' },
  { name: 'Docker', category: 'ops' },
  { name: 'Azure', category: 'ops' },
  { name: 'Azure DevOps', category: 'ops' },
  { name: 'Portainer', category: 'ops' },
  // The two below come from the site itself: IIS from the Unimed engagement
  // above, Netlify from where this portfolio is deployed.
  { name: 'IIS', category: 'ops' },
  { name: 'Netlify', category: 'ops' },
  { name: 'GitHub Actions', category: 'ops' },
  { name: 'Microsoft Entra ID', category: 'ops' },
  { name: 'OpenTelemetry', category: 'ops' },
]
// New entries go at the end of their category. The published list lives in the
// CMS; the admin's "add the missing defaults" appends, so this order is the one
// that makes the first paint and the published list agree.

export const socials: SocialLink[] = [
  {
    label: 'GitHub',
    handle: '@Marcus-Boni',
    url: 'https://github.com/Marcus-Boni',
  },
  {
    label: 'LinkedIn',
    handle: 'marcus-boni',
    url: 'https://www.linkedin.com/in/marcus-boni-729a52243',
  },
  {
    label: 'Email',
    handle: 'mgalvaoboni@gmail.com',
    url: 'mailto:mgalvaoboni@gmail.com',
  },
]

/**
 * Résumé PDFs served from `/public` under stable names (one per locale).
 * Editable sources (.docx) live in `docs/cv/` and are not shipped.
 */
export const cvFiles: Record<Locale, string> = {
  pt: '/marcus-boni-cv-pt.pdf',
  en: '/marcus-boni-resume-en.pdf',
}

export const sectionIds = [
  'hero',
  'about',
  'work',
  'experience',
  'craft',
  'contact',
] as const

export type SectionId = (typeof sectionIds)[number]
