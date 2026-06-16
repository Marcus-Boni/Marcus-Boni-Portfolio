import type { Locale } from '@/i18n/translations'

export interface Project {
  index: string
  title: string
  description: Record<Locale, string>
  stack: string[]
  year: string
  url: string
}

export interface TechItem {
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
  avatar: 'https://github.com/Marcus-Boni.png?size=480',
  bio: 'Desenvolvedor web brasileiro apaixonado por construir aplicações robustas e modernas.',
  repoCount: 66,
} as const

export const projects: Project[] = [
  {
    index: '01',
    title: 'OptTime',
    description: {
      pt: 'Produto nascido em um hackathon explorando fluxos de desenvolvimento orquestrados por agentes de IA — construído sob pressão, entregue em dias.',
      en: 'Hackathon-born product exploring software development workflows orchestrated by AI agents — built under pressure, shipped in days.',
    },
    stack: ['TypeScript', 'React', 'AI Agents'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/OptTime',
  },
  {
    index: '02',
    title: 'Estimativa de Horas',
    description: {
      pt: 'Ferramenta web que substituiu planilhas frágeis de Excel na estimativa de horas, puxando work items direto do Azure DevOps.',
      en: 'A web tool that replaced fragile Excel spreadsheets for task-hour estimation, pulling work items straight from Azure DevOps.',
    },
    stack: ['TypeScript', 'Azure DevOps', 'React'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/Ferramenta-Estimativa-Horas',
  },
  {
    index: '03',
    title: 'Vault Chatbot',
    description: {
      pt: 'Chatbot ancorado em vaults do Obsidian, respondendo perguntas sobre transcrições de reuniões em vez de deixá-las apodrecer em pastas.',
      en: 'A chatbot grounded in Obsidian vaults, answering questions over company meeting transcriptions instead of letting them rot in folders.',
    },
    stack: ['TypeScript', 'LLM', 'RAG'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/chatbot-template',
  },
  {
    index: '04',
    title: 'Jarvis',
    description: {
      pt: 'Sistema de assistente pessoal automatizando os rituais diários de um desenvolvedor — uma rotina de cada vez.',
      en: 'A personal assistant system automating the daily rituals of a working software developer — one routine at a time.',
    },
    stack: ['Python', 'Automation'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/Jarvis',
  },
  {
    index: '05',
    title: 'Opt Gestão',
    description: {
      pt: 'Aplicação de gestão de projetos construída para uso real em empresa — planejar, acompanhar e entregar sem cerimônia.',
      en: 'Project administration application built for real company use — planning, tracking and shipping without ceremony.',
    },
    stack: ['TypeScript', 'React', 'PostgreSQL'],
    year: '2026',
    url: 'https://github.com/Marcus-Boni/Opt-Gestao-Projetos',
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
  ],
}

export const techStack: TechItem[] = [
  { name: 'React', category: 'frontend' },
  { name: 'Next.js', category: 'frontend' },
  { name: 'TypeScript', category: 'frontend' },
  { name: 'Tailwind CSS', category: 'frontend' },
  { name: 'React Native', category: 'frontend' },
  { name: 'C#', category: 'backend' },
  { name: 'Java', category: 'backend' },
  { name: 'Python', category: 'backend' },
  { name: 'Node.js', category: 'backend' },
  { name: 'PostgreSQL', category: 'data' },
  { name: 'SQL Server', category: 'data' },
  { name: 'Supabase', category: 'data' },
  { name: 'Firebase', category: 'data' },
  { name: 'Docker', category: 'ops' },
  { name: 'Azure', category: 'ops' },
  { name: 'Azure DevOps', category: 'ops' },
]

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

export const sectionIds = [
  'hero',
  'about',
  'work',
  'experience',
  'craft',
  'contact',
] as const

export type SectionId = (typeof sectionIds)[number]
