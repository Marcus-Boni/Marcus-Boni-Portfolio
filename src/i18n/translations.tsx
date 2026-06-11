import type { ReactNode } from 'react'

export type Locale = 'pt' | 'en'

export interface Fact {
  label: string
  value: string
}

export interface Translation {
  sections: { hero: string; about: string; work: string; craft: string; contact: string }
  header: {
    menu: string
    close: string
    openMenu: string
    closeMenu: string
    backHome: string
  }
  hero: {
    portfolio: string
    available: string
    intro: string
    tagline: string
    scrollLine1: string
    scrollLine2: string
  }
  about: {
    label: string
    statement: ReactNode
    p1: string
    p2: string
    figcaption: string
    portraitAlt: string
    facts: Fact[]
  }
  work: {
    label: string
    title: string
    hint: string
    viewOnGithub: string
    others: (count: number) => string
    archive: string
  }
  craft: {
    label: string
    statement: ReactNode
    categories: { frontend: string; backend: string; data: string; ops: string }
  }
  contact: {
    label: string
    title: ReactNode
    cta: string
    blurb: string
    madeIn: string
  }
  marquee: string[]
  cursor: { view: string; drag: string }
}

export const translations: Record<Locale, Translation> = {
  pt: {
    sections: {
      hero: 'Início',
      about: 'Sobre',
      work: 'Projetos',
      craft: 'Stack',
      contact: 'Contato',
    },
    header: {
      menu: 'MENU',
      close: 'FECHAR',
      openMenu: 'Abrir menu',
      closeMenu: 'Fechar menu',
      backHome: 'Voltar ao início',
    },
    hero: {
      portfolio: 'Portfólio',
      available: 'Disponível para projetos',
      intro:
        'Engenheiro de software construindo aplicações web robustas e modernas',
      tagline:
        'React · TypeScript · Next.js — e a disciplina de quem trata cada projeto como produto.',
      scrollLine1: 'Role para',
      scrollLine2: 'explorar',
    },
    about: {
      label: 'Sobre',
      statement: (
        <>
          Desenvolvedor brasileiro de <em className="text-ember">21 anos</em>,
          obcecado por transformar problemas reais em software <em>robusto</em>{' '}
          — de planilhas que viram produtos a agentes de IA que viram rotina.
        </>
      ),
      p1: 'Do primeiro projeto de pizzaria em HTML puro ao trabalho diário com React, TypeScript e Azure DevOps, o caminho foi o mesmo: aprender construindo. Hoje são mais de 66 repositórios públicos de experimentos, cursos e produtos reais.',
      p2: 'Acredito em código limpo, interfaces honestas e na ideia de que boa engenharia se mede pelo que ela simplifica na vida de quem usa.',
      figcaption: 'fig. 01 — o autor',
      portraitAlt: 'Retrato de Marcus Boni',
      facts: [
        { label: 'Base', value: 'Espírito Santo, BR' },
        { label: 'Foco', value: 'Web Engineering' },
        { label: 'Repositórios', value: '66+' },
        { label: 'Status', value: 'Construindo' },
      ],
    },
    work: {
      label: 'Projetos selecionados',
      title: 'Trabalho',
      hint: 'Role — a página anda para o lado',
      viewOnGithub: 'Ver no GitHub',
      others: (count) => `+ ${count} outros experimentos`,
      archive: 'Arquivo completo →',
    },
    craft: {
      label: 'Ferramentas do ofício',
      statement: (
        <>
          Ferramentas mudam. <em className="text-ember">Fundamentos</em> ficam.
        </>
      ),
      categories: {
        frontend: 'Interface',
        backend: 'Serviços',
        data: 'Dados',
        ops: 'Infra',
      },
    },
    contact: {
      label: 'Próximo capítulo',
      title: (
        <>
          Vamos construir algo <em className="text-ember">que dure</em>.
        </>
      ),
      cta: 'Escreva para mim',
      blurb:
        'Aberto a projetos, colaborações e boas conversas sobre engenharia de software — em português ou inglês.',
      madeIn: 'feito no Brasil',
    },
    marquee: ['Construir', 'Aprender', 'Iterar', 'Repetir'],
    cursor: { view: 'VER', drag: 'ARRASTE' },
  },

  en: {
    sections: {
      hero: 'Home',
      about: 'About',
      work: 'Work',
      craft: 'Stack',
      contact: 'Contact',
    },
    header: {
      menu: 'MENU',
      close: 'CLOSE',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      backHome: 'Back to top',
    },
    hero: {
      portfolio: 'Portfolio',
      available: 'Open to projects',
      intro:
        'Software engineer building robust, modern web applications from Brazil',
      tagline:
        'React · TypeScript · Next.js — and the discipline of treating every project as a product.',
      scrollLine1: 'Scroll to',
      scrollLine2: 'explore',
    },
    about: {
      label: 'About',
      statement: (
        <>
          A <em className="text-ember">21-year-old</em> Brazilian developer
          obsessed with turning real problems into <em>robust</em> software —
          from spreadsheets that became products to AI agents that became
          routine.
        </>
      ),
      p1: 'From a first pizza-shop project in plain HTML to daily work with React, TypeScript and Azure DevOps, the path has been the same: learn by building. Today that adds up to 66+ public repositories of experiments, coursework and real products.',
      p2: 'I believe in clean code, honest interfaces, and the idea that good engineering is measured by what it simplifies in the lives of the people who use it.',
      figcaption: 'fig. 01 — the author',
      portraitAlt: 'Portrait of Marcus Boni',
      facts: [
        { label: 'Based in', value: 'Espírito Santo, BR' },
        { label: 'Focus', value: 'Web Engineering' },
        { label: 'Repositories', value: '66+' },
        { label: 'Status', value: 'Building' },
      ],
    },
    work: {
      label: 'Selected work',
      title: 'Work',
      hint: 'Scroll — the page moves sideways',
      viewOnGithub: 'View on GitHub',
      others: (count) => `+ ${count} other experiments`,
      archive: 'Full archive →',
    },
    craft: {
      label: 'Tools of the trade',
      statement: (
        <>
          Tools change. <em className="text-ember">Fundamentals</em> stay.
        </>
      ),
      categories: {
        frontend: 'Interface',
        backend: 'Services',
        data: 'Data',
        ops: 'Infra',
      },
    },
    contact: {
      label: 'Next chapter',
      title: (
        <>
          Let&apos;s build something <em className="text-ember">that lasts</em>.
        </>
      ),
      cta: 'Write to me',
      blurb:
        'Open to projects, collaborations and good conversations about software engineering — in Portuguese or English.',
      madeIn: 'made in Brazil',
    },
    marquee: ['Build', 'Learn', 'Iterate', 'Repeat'],
    cursor: { view: 'VIEW', drag: 'DRAG' },
  },
}
