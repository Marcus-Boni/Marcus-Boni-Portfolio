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
  avatar: 'https://github.com/Marcus-Boni.png',
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

export const sectionIds = ['hero', 'about', 'work', 'craft', 'contact'] as const

export type SectionId = (typeof sectionIds)[number]
