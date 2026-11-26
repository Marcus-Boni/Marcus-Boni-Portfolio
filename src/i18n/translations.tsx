import type { ReactNode } from 'react'

export type Locale = 'pt' | 'en'

export interface Fact {
  label: string
  value: string
}

export interface Translation {
  sections: {
    hero: string
    about: string
    work: string
    experience: string
    craft: string
    contact: string
    /** Accessible name of the section rail. */
    rail: string
  }
  header: {
    menu: string
    close: string
    openMenu: string
    closeMenu: string
    backHome: string
    themeToLight: string
    themeToDark: string
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
    statement: (age: number) => ReactNode
    p1: (repoCount: number) => string
    p2: string
    figcaption: string
    portraitAlt: string
    replayPortrait: string
    facts: (repoCount: number) => Fact[]
  }
  work: {
    label: string
    title: string
    hint: string
    viewOnGithub: string
    others: (count: number) => string
    archive: string
  }
  experience: {
    label: string
    title: string
    role: string
    company: string
    period: string
    lead: ReactNode
    scopeLabel: string
    stackLabel: string
    sectorLabel: string
    hint: string
    downloadCv: string
    current: string
    moreSector: string
    moreTitle: string
    moreSubtitle: string
    moreText: string
  }
  craft: {
    label: string
    statement: ReactNode
    intro: string
    seeProjects: string
    figcaption: string
    categories: { frontend: string; backend: string; data: string; ops: string }
    descriptions: { frontend: string; backend: string; data: string; ops: string }
  }
  contact: {
    label: string
    title: ReactNode
    cta: string
    blurb: string
    form: {
      heading: string
      name: string
      email: string
      message: string
      send: string
      sending: string
      success: string
      error: string
      offline: string
    }
  }
  blog: {
    /** Label used in the header link and the menu overlay. */
    nav: string
    label: string
    title: string
    lead: string
    filters: {
      all: string
      allTags: string
      language: string
      clear: string
      results: (count: number) => string
    }
    readingTime: (minutes: number) => string
    empty: string
    loading: string
    error: string
    retry: string
    featured: string
    unlistedNotice: string
    /** Ordinal of an entry in the journal, e.g. "Nº 012". */
    entry: (number: string) => string
    readEntry: string
    rss: string
    /** Labels of the masthead figures, all derived from the published list. */
    stats: {
      entries: string
      topics: string
      reading: string
      updated: string
      minutes: (minutes: number) => string
    }
    /** Reading marks on the index, kept on the reader's own device. */
    read: string
    inProgress: (percent: number) => string
    post: {
      back: string
      toc: string
      remaining: (minutes: number) => string
      finished: string
      updated: (date: string) => string
      share: string
      copyLink: string
      copied: string
      readAlso: string
      translationAvailable: string
      notFound: string
      notFoundBody: string
      backToIndex: string
      resume: (percent: number) => string
      resumeAction: string
      neighbors: string
      previous: string
      next: string
      /** The toolbar that appears over a selected passage. */
      quote: { toolbar: string; link: string; text: string; copied: string }
    }
    /**
     * Labels printed inside the article body. They follow the language the
     * post was written in, not the interface language.
     */
    body: {
      copy: string
      copied: string
      code: string
      takeaways: string
      note: (number: string) => string
      notes: string
      step: (current: number, total: number) => string
      lines: (spec: string) => string
      sectionLink: string
      callout: { info: string; tip: string; warn: string; danger: string }
    }
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
      experience: 'Carreira',
      craft: 'Stack',
      contact: 'Contato',
      rail: 'Seções',
    },
    header: {
      menu: 'MENU',
      close: 'FECHAR',
      openMenu: 'Abrir menu',
      closeMenu: 'Fechar menu',
      backHome: 'Voltar ao início',
      themeToLight: 'Mudar para o tema claro',
      themeToDark: 'Mudar para o tema escuro',
    },
    hero: {
      portfolio: 'Portfólio',
      available: 'Disponível para projetos',
      intro:
        'Engenheiro de software construindo aplicações full-stack, sistemas locais e IA aplicada',
      tagline:
        'TypeScript · Rust · IA aplicada — e a disciplina de transformar problemas reais em produto sólido.',
      scrollLine1: 'Role para',
      scrollLine2: 'explorar',
    },
    about: {
      label: 'Sobre',
      statement: (age) => (
        <>
          Engenheiro de software de <em className="text-ember">{age} anos</em>,
          focado em transformar problemas reais em software <em>sólido</em>{' '}
          — de sistemas nativos em Rust a aplicações full-stack e IA aplicada em produção.
        </>
      ),
      p1: (repoCount) =>
        `Do primeiro projeto em HTML puro ao trabalho diário entre TypeScript, Rust, Azure DevOps e IA aplicada, o método continua o mesmo: aprender construindo. Hoje são ${repoCount}+ repositórios públicos de ferramentas nativas, servidores MCP, pipelines RAG e produtos reais.`,
      p2: 'Utilizo IA de forma deliberada como multiplicador de engenharia — sempre ancorado em fundamentos e boas práticas de mercado — com facilidade para alinhar diretamente com clientes e levar soluções do entendimento do problema até produção.',
      figcaption: 'fig. 01 — o autor',
      portraitAlt: 'Retrato de Marcus Boni',
      replayPortrait: 'Reanimar retrato em ASCII',
      facts: (repoCount) => [
        { label: 'Base', value: 'Espírito Santo, BR' },
        { label: 'Foco', value: 'Software & IA' },
        { label: 'Repositórios', value: `${repoCount}+` },
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
    experience: {
      label: 'Experiência profissional',
      title: 'Trajetória',
      role: 'Desenvolvedor de Software',
      company: 'Optsolv',
      period: 'Jun 2024 — Presente',
      lead: (
        <>
          Construo aplicações corporativas de ponta a ponta — unindo engenharia
          sólida ao alinhamento direto com clientes do discovery ao{' '}
          <em className="text-ember">deploy</em> em produção — em saúde,
          indústria, logística, meio ambiente e mercado imobiliário.
        </>
      ),
      scopeLabel: 'Escopo',
      stackLabel: 'Stack',
      sectorLabel: 'Setor',
      hint: 'Role — um capítulo por vez',
      downloadCv: 'Baixar CV',
      current: 'Atual',
      moreSector: 'Em andamento',
      moreTitle: 'E muito mais',
      moreSubtitle: 'em construção · evolução · organização',
      moreText:
        'A trajetória continua — novos produtos, experimentos e clientes em desenvolvimento constante. Isto é só o começo.',
    },
    craft: {
      label: 'Ferramentas do ofício',
      statement: (
        <>
          Ferramentas mudam. <em className="text-ember">Fundamentos</em> ficam.
        </>
      ),
      categories: {
        frontend: 'Interfaces',
        backend: 'Serviços & APIs',
        data: 'Dados',
        ops: 'Infraestrutura',
      },
      intro: 'Da interface à operação: as ferramentas que uso para construir e evoluir produtos.',
      seeProjects: 'Ver nos projetos',
      figcaption: 'fig. 02 — a pilha',
      descriptions: {
        frontend: 'Aplicações web e mobile, interfaces autorais e WebGL.',
        backend: 'Sistemas nativos, regras de negócio, integrações e servidores MCP.',
        data: 'Persistência relacional, busca vetorial e plataformas de dados.',
        ops: 'Ambientes, pipelines CI/CD, releases e operação em produção.',
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
        'Aberto a projetos, colaborações e boas conversas sobre engenharia de software e IA aplicada — em português ou inglês.',
      form: {
        heading: 'Ou mande uma mensagem direto por aqui',
        name: 'Nome',
        email: 'E-mail',
        message: 'Mensagem',
        send: 'Enviar mensagem',
        sending: 'Enviando…',
        success: 'Mensagem enviada — retorno em breve. Obrigado!',
        error: 'Algo deu errado. Tente novamente ou use o e-mail acima.',
        offline:
          'Formulário indisponível no momento — use o botão de e-mail acima.',
      },
    },
    blog: {
      nav: 'Diário',
      label: 'Diário técnico',
      title: 'Notas de campo',
      lead: 'Estudos, bastidores de projeto e o que anda me tirando o sono no mercado — escrito para eu entender, publicado para você usar.',
      filters: {
        all: 'Tudo',
        allTags: 'Todos os temas',
        language: 'Idioma',
        clear: 'Limpar filtros',
        results: (count) =>
          count === 1 ? '1 registro' : `${count} registros`,
      },
      readingTime: (minutes) => `${minutes} min de leitura`,
      empty: 'Ainda não há nada publicado por aqui. Volte em breve.',
      loading: 'Carregando registros…',
      error: 'Não foi possível carregar os registros.',
      retry: 'Tentar novamente',
      featured: 'Em destaque',
      unlistedNotice:
        'Este registro não está listado publicamente — você chegou por link direto.',
      entry: (number) => `Nº ${number}`,
      readEntry: 'Ler registro',
      rss: 'Assinar por RSS',
      stats: {
        entries: 'Registros',
        topics: 'Temas',
        reading: 'Leitura',
        updated: 'Atualizado',
        minutes: (minutes) => `${minutes} min`,
      },
      read: 'Lido',
      inProgress: (percent) => `${percent}% lido`,
      body: {
        copy: 'Copiar',
        copied: 'Copiado',
        code: 'Bloco de código',
        takeaways: 'Em resumo',
        note: (number) => `Nota ${number}`,
        notes: 'Notas',
        step: (current, total) => `Passo ${current} de ${total}`,
        lines: (spec) => (/[-,]/.test(spec) ? `Linhas ${spec}` : `Linha ${spec}`),
        sectionLink: 'Copiar link desta seção',
        callout: { info: 'Nota', tip: 'Dica', warn: 'Atenção', danger: 'Cuidado' },
      },
      post: {
        back: 'Voltar ao diário',
        toc: 'Neste registro',
        resume: (percent) => `Você parou em ${percent}% deste registro.`,
        resumeAction: 'Continuar de onde parei',
        neighbors: 'Registros vizinhos',
        previous: 'Registro anterior',
        next: 'Próximo registro',
        quote: {
          toolbar: 'Compartilhar trecho',
          link: 'Copiar link',
          text: 'Copiar citação',
          copied: 'Copiado',
        },
        remaining: (minutes) =>
          minutes <= 1 ? 'Menos de 1 min restante' : `${minutes} min restantes`,
        finished: 'Leitura concluída',
        updated: (date) => `Atualizado em ${date}`,
        share: 'Compartilhar',
        copyLink: 'Copiar link',
        copied: 'Link copiado',
        readAlso: 'Leia também',
        translationAvailable: 'Read in English',
        notFound: 'Registro não encontrado',
        notFoundBody:
          'Este link pode ter mudado de endereço ou o registro ainda não foi publicado.',
        backToIndex: 'Ver todos os registros',
      },
    },
    marquee: ['Construir', 'Aprender', 'Iterar', 'Repetir'],
    cursor: { view: 'VER', drag: 'ARRASTE' },
  },

  en: {
    sections: {
      hero: 'Home',
      about: 'About',
      work: 'Work',
      experience: 'Career',
      craft: 'Stack',
      contact: 'Contact',
      rail: 'Sections',
    },
    header: {
      menu: 'MENU',
      close: 'CLOSE',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      backHome: 'Back to top',
      themeToLight: 'Switch to the light theme',
      themeToDark: 'Switch to the dark theme',
    },
    hero: {
      portfolio: 'Portfolio',
      available: 'Open to projects',
      intro:
        'Software engineer building full-stack applications, native systems and applied AI',
      tagline:
        'TypeScript · Rust · Applied AI — and the discipline of turning real problems into resilient products.',
      scrollLine1: 'Scroll to',
      scrollLine2: 'explore',
    },
    about: {
      label: 'About',
      statement: (age) => (
        <>
          A <em className="text-ember">{age}-year-old</em> Brazilian software
          engineer focused on turning real problems into <em>resilient</em>{' '}
          software — from native Rust tools to full-stack apps and applied AI in
          production.
        </>
      ),
      p1: (repoCount) =>
        `From a first plain-HTML project to daily work spanning TypeScript, Rust, Azure DevOps and applied AI, the method stays the same: learn by building. Today that adds up to ${repoCount}+ public repositories of native tools, MCP servers, RAG pipelines and shipped products.`,
      p2: 'I use AI deliberately as an engineering multiplier — always grounded in fundamentals and industry best practices — while staying comfortable working directly with clients from discovery through production deployment.',
      figcaption: 'fig. 01 — the author',
      portraitAlt: 'Portrait of Marcus Boni',
      replayPortrait: 'Replay ASCII portrait',
      facts: (repoCount) => [
        { label: 'Based in', value: 'Espírito Santo, BR' },
        { label: 'Focus', value: 'Software & AI' },
        { label: 'Repositories', value: `${repoCount}+` },
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
    experience: {
      label: 'Professional experience',
      title: 'Trajectory',
      role: 'Software Developer',
      company: 'Optsolv',
      period: 'Jun 2024 — Present',
      lead: (
        <>
          I build corporate applications end to end — combining solid
          engineering with direct client alignment from discovery to production{' '}
          <em className="text-ember">deploy</em> — across healthcare, industry,
          logistics, environment and real estate.
        </>
      ),
      scopeLabel: 'Scope',
      stackLabel: 'Stack',
      sectorLabel: 'Sector',
      hint: 'Scroll — one chapter at a time',
      downloadCv: 'Download CV',
      current: 'Current',
      moreSector: 'Ongoing',
      moreTitle: 'And more',
      moreSubtitle: 'in progress · evolving · organizing',
      moreText:
        'The trajectory continues — new products, experiments and clients in constant development. This is only the beginning.',
    },
    craft: {
      label: 'Tools of the trade',
      statement: (
        <>
          Tools change. <em className="text-ember">Fundamentals</em> stay.
        </>
      ),
      categories: {
        frontend: 'Interfaces',
        backend: 'Services & APIs',
        data: 'Data',
        ops: 'Infrastructure',
      },
      intro: 'From interface to operations: the tools I use to build and evolve products.',
      seeProjects: 'See in projects',
      figcaption: 'fig. 02 — the stack',
      descriptions: {
        frontend: 'Web and mobile applications, interfaces and WebGL craft.',
        backend: 'Native systems, business logic, integrations and MCP servers.',
        data: 'Relational persistence, vector retrieval and data platforms.',
        ops: 'Environments, CI/CD pipelines, releases and production operations.',
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
        'Open to projects, collaborations and sharp conversations on software engineering and applied AI — in Portuguese or English.',
      form: {
        heading: 'Or send a message right here',
        name: 'Name',
        email: 'Email',
        message: 'Message',
        send: 'Send message',
        sending: 'Sending…',
        success: "Message sent — I'll get back to you soon. Thanks!",
        error: 'Something went wrong. Try again or use the email above.',
        offline: 'Form unavailable right now — use the email button above.',
      },
    },
    blog: {
      nav: 'Notes',
      label: 'Engineering notes',
      title: 'Field notes',
      lead: 'Studies, project post-mortems and whatever the industry just threw at us — written to make it stick, published in case it helps.',
      filters: {
        all: 'All',
        allTags: 'All topics',
        language: 'Language',
        clear: 'Clear filters',
        results: (count) => (count === 1 ? '1 entry' : `${count} entries`),
      },
      readingTime: (minutes) => `${minutes} min read`,
      empty: 'Nothing published here yet. Check back soon.',
      loading: 'Loading entries…',
      error: 'Could not load the entries.',
      retry: 'Try again',
      featured: 'Featured',
      unlistedNotice:
        'This entry is not publicly listed — you arrived through a direct link.',
      entry: (number) => `No. ${number}`,
      readEntry: 'Read entry',
      rss: 'Subscribe via RSS',
      stats: {
        entries: 'Entries',
        topics: 'Topics',
        reading: 'Reading',
        updated: 'Updated',
        minutes: (minutes) => `${minutes} min`,
      },
      read: 'Read',
      inProgress: (percent) => `${percent}% read`,
      body: {
        copy: 'Copy',
        copied: 'Copied',
        code: 'Code block',
        takeaways: 'In short',
        note: (number) => `Note ${number}`,
        notes: 'Notes',
        step: (current, total) => `Step ${current} of ${total}`,
        lines: (spec) => (/[-,]/.test(spec) ? `Lines ${spec}` : `Line ${spec}`),
        sectionLink: 'Copy link to this section',
        callout: { info: 'Note', tip: 'Tip', warn: 'Heads up', danger: 'Careful' },
      },
      post: {
        back: 'Back to notes',
        toc: 'In this entry',
        resume: (percent) => `You stopped at ${percent}% of this entry.`,
        resumeAction: 'Pick up where I left off',
        neighbors: 'Neighbouring entries',
        previous: 'Previous entry',
        next: 'Next entry',
        quote: {
          toolbar: 'Share passage',
          link: 'Copy link',
          text: 'Copy quote',
          copied: 'Copied',
        },
        remaining: (minutes) =>
          minutes <= 1 ? 'Under 1 min left' : `${minutes} min left`,
        finished: 'Finished',
        updated: (date) => `Updated ${date}`,
        share: 'Share',
        copyLink: 'Copy link',
        copied: 'Link copied',
        readAlso: 'Read next',
        translationAvailable: 'Ler em português',
        notFound: 'Entry not found',
        notFoundBody:
          'This link may have moved, or the entry has not been published yet.',
        backToIndex: 'See all entries',
      },
    },
    marquee: ['Build', 'Learn', 'Iterate', 'Repeat'],
    cursor: { view: 'VIEW', drag: 'DRAG' },
  },
}
