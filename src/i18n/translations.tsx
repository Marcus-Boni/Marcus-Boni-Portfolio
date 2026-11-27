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
    ask: string
    openAsk: string
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
    askCta: string
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
      askDossier: string
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
  agent: {
    nav: string
    pageTitle: string
    pageHeading: ReactNode
    pageSubtitle: string
    drawerHeading: string
    newChat: string
    expandFull: string
    assistantTurnLabel: string
    stoppedNotice: string
    copyAnswer: string
    copiedAnswer: string
    shareLink: string
    copiedLink: string
    followupsLabel: string
    queue: {
      heading: (count: number) => string
      addHint: string
      sendNow: string
      remove: string
      clearAll: string
    }
    lenses: {
      label: string
      recruiter: string
      recruiterHint: string
      engineer: string
      engineerHint: string
      client: string
      clientHint: string
    }
    input: {
      ariaLabel: string
      placeholder: string
      fitPlaceholder: string
      commandsLabel: string
      slashToggle: string
      attachFile: string
      removeCommand: string
      kbdMove: string
      kbdPick: string
      kbdClose: string
      send: string
      stop: string
    }
    voice: {
      start: string
      listening: string
      discard: string
      unsupported: string
    }
    tools: {
      running: (count: number) => string
      summary: (count: number, totalMs: number, evidenceCount: number) => string
      viewJson: string
      hideJson: string
    }
    citations: {
      sourcesLabel: string
      openSource: string
    }
    fit: {
      heading: string
      verifiedShort: string
      gapsShort: string
      copyBrief: string
      copiedBrief: string
      downloadBrief: string
      printPdf: string
      shareLink: string
      copiedLink: string
      verifiedLabel: string
      gapsLabel: string
      noMatches: string
      noGaps: string
      adjacentPrefix: string
      academicOnly: string
    }
    terrain: {
      title: string
      viewToggleLabel: string
      flat: string
      terrain: string
      less: string
      more: string
      dragHint: string
      latestRelease: string
      activeDays: (days: number) => string
      streak: (days: number) => string
      windowSummary: (total: number, weeks: number) => string
      dayReadout: (count: number, dayLabel: string) => string
      canvasAria: (total: number, weeks: number) => string
    }
    approval: {
      defaultSubject: string
      toLabel: string
      subjectLabel: string
      inboxTag: string
      confirmSend: string
      undo: string
      cancel: string
      dismissed: string
      sentSuccess: string
      sentReceipt: (name: string) => string
      fillRequired: string
      sendError: string
      offlineFallback: string
      openedMailto: string
      namePlaceholder: string
      emailPlaceholder: string
      downloadPt: string
      downloadEn: string
    }
    meter: {
      ariaLabel: (total: number) => string
      sourcesUnit: string
      popoverTitle: string
      projects: string
      clients: string
      stack: string
      notes: string
      posts: string
      sections: string
      turns: string
      runtimeLabel: string
      verifiedStatus: string
      liveCms: string
      staticSeed: string
      modeLabel: string
      modeAuto: string
      modeLocal: string
      edgeReady: (model: string) => string
      edgeStandby: string
      rateLimitNote: string
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
      ask: 'Dossiê',
      openAsk: 'Abrir dossiê interativo (Ctrl+K)',
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
      askCta: 'Ou consulte o dossiê / analise uma vaga (/fit) →',
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
        askDossier: 'Perguntar no Dossiê',
        readAlso: 'Leia também',
        translationAvailable: 'Read in English',
        notFound: 'Registro não encontrado',
        notFoundBody:
          'Este link pode ter mudado de endereço ou o registro ainda não foi publicado.',
        backToIndex: 'Ver todos os registros',
      },
    },
    agent: {
      nav: 'Dossiê',
      pageTitle: 'Consulte o dossiê',
      pageHeading: (
        <>
          O que você quer saber sobre o{' '}
          <em className="font-display-italic pl-[0.02em] pr-[0.09em] text-ember">Marcus</em>?
        </>
      ),
      pageSubtitle:
        'Respostas ancoradas em projetos e entregas reais — ou cole uma vaga para mapear evidências.',
      drawerHeading: 'Dossiê interativo',
      newChat: 'Nova conversa',
      expandFull: 'Tela cheia',
      assistantTurnLabel: 'Resposta do dossiê',
      stoppedNotice: 'Resposta interrompida.',
      copyAnswer: 'Copiar',
      copiedAnswer: 'Copiado',
      shareLink: 'Copiar link',
      copiedLink: 'Link copiado',
      followupsLabel: 'Próximas perguntas',
      queue: {
        heading: (count) => (count === 1 ? '1 na fila' : `${count} na fila`),
        addHint: 'Enter para enfileirar enquanto responde…',
        sendNow: 'Enviar agora',
        remove: 'Remover da fila',
        clearAll: 'Limpar fila',
      },
      lenses: {
        label: 'Lente',
        recruiter: 'Recrutador',
        recruiterHint: 'Fit de vaga, entregas e disponibilidade',
        engineer: 'Técnico',
        engineerHint: 'Arquitetura, stack e decisões de código',
        client: 'Cliente',
        clientHint: 'Discovery, escopo e entrega em produção',
      },
      input: {
        ariaLabel: 'Perguntar ao dossiê do Marcus',
        placeholder: 'Pergunte algo, digite / ou cole uma vaga…',
        fitPlaceholder: 'Cole a descrição da vaga ou arraste um arquivo .txt/.md…',
        commandsLabel: 'Comandos',
        slashToggle: 'Comandos /',
        attachFile: 'Anexar descrição de vaga (.txt / .md)',
        removeCommand: 'Remover comando',
        kbdMove: 'navegar',
        kbdPick: 'selecionar',
        kbdClose: 'fechar',
        send: 'Enviar',
        stop: 'Parar',
      },
      voice: {
        start: 'Falar pergunta por voz',
        listening: 'Ouvindo… fale sua pergunta',
        discard: 'Cancelar',
        unsupported: 'Reconhecimento de voz indisponível neste navegador.',
      },
      tools: {
        running: (count) =>
          count === 1 ? 'Consultando 1 fonte…' : `Consultando ${count} fontes…`,
        summary: (count, totalMs, evidenceCount) =>
          `${count} ${count === 1 ? 'tool' : 'tools'} · ${totalMs}ms · ${evidenceCount} ${evidenceCount === 1 ? 'fonte' : 'fontes'}`,
        viewJson: 'JSON',
        hideJson: 'Fechar',
      },
      citations: {
        sourcesLabel: 'Fontes',
        openSource: 'Abrir fonte',
      },
      fit: {
        heading: 'Aderência por evidências',
        verifiedShort: 'comprovados',
        gapsShort: 'fora do dossiê',
        copyBrief: 'Copiar .md',
        copiedBrief: 'Copiado',
        downloadBrief: 'Baixar .md',
        printPdf: 'PDF',
        shareLink: 'Copiar link',
        copiedLink: 'Link copiado',
        verifiedLabel: 'Evidências reais',
        gapsLabel: 'Não registrado no dossiê',
        noMatches:
          'Nenhuma tecnologia específica reconhecida — inclua o stack ou responsabilidades da vaga.',
        noGaps:
          'Nenhuma tecnologia fora do stack público foi detectada no texto.',
        adjacentPrefix: 'Adjacente',
        academicOnly: 'Só em trabalho acadêmico',
      },
      terrain: {
        title: 'Terreno de atividade no GitHub',
        viewToggleLabel: 'Visualização do mapa de contribuições',
        flat: 'Plano',
        terrain: 'Terreno',
        less: 'Menos',
        more: 'Mais',
        dragHint: 'Arraste para girar · setas para navegar',
        latestRelease: 'Última release',
        activeDays: (days) => `${days} dias ativos`,
        streak: (days) => `sequência máx. ${days}d`,
        windowSummary: (total, weeks) =>
          `${total.toLocaleString('pt-BR')} contribuições nas últimas ${weeks} semanas`,
        dayReadout: (count, dayLabel) =>
          `${count} ${count === 1 ? 'contribuição' : 'contribuições'} em ${dayLabel}`,
        canvasAria: (total, weeks) =>
          `Mapa 3D de atividade no GitHub: ${total.toLocaleString('pt-BR')} contribuições em ${weeks} semanas. Use as setas para navegar cada dia.`,
      },
      approval: {
        defaultSubject: 'Contato via dossiê',
        toLabel: 'Para',
        subjectLabel: 'Assunto',
        inboxTag: 'Inbox direto do Marcus',
        confirmSend: 'Enviar',
        undo: 'Desfazer',
        cancel: 'Descartar',
        dismissed: 'Rascunho descartado.',
        sentSuccess: 'Mensagem entregue na caixa de entrada do Marcus.',
        sentReceipt: (name) => `Enviado para ${name} · agora mesmo`,
        fillRequired: 'Preencha nome, e-mail válido e mensagem antes de enviar.',
        sendError: 'Não foi possível enviar agora — tente novamente.',
        offlineFallback: 'Inbox offline no momento — tente por e-mail.',
        openedMailto: 'Cliente de e-mail aberto com o rascunho.',
        namePlaceholder: 'Seu nome',
        emailPlaceholder: 'voce@empresa.com',
        downloadPt: 'CV (PT-BR)',
        downloadEn: 'Resume (EN)',
      },
      meter: {
        ariaLabel: (total) => `${total} fontes indexadas. Ver detalhamento`,
        sourcesUnit: 'fontes',
        popoverTitle: 'Base indexada',
        projects: 'Projetos públicos',
        clients: 'Entregas em clientes',
        stack: 'Tecnologias',
        notes: 'Notas do dossiê',
        posts: 'Registros do Diário',
        sections: 'Seções do Diário',
        turns: 'Turnos na sessão',
        runtimeLabel: 'Local · determinístico',
        verifiedStatus: 'Dossiê verificado',
        liveCms: 'CMS ao vivo',
        staticSeed: 'Base estática',
        modeLabel: 'Motor',
        modeAuto: 'Híbrido',
        modeLocal: 'Local',
        edgeReady: (model) => `Edge LLM · ${model}`,
        edgeStandby: 'Local · Edge pronto p/ chave',
        rateLimitNote: 'Limite de taxa da Edge atingido — respondido pelo motor local determinístico.',
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
      ask: 'Ask',
      openAsk: 'Open interactive dossier (Ctrl+K)',
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
      askCta: 'Or query the dossier / check role fit (/fit) →',
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
        askDossier: 'Ask Dossier',
        readAlso: 'Read next',
        translationAvailable: 'Ler em português',
        notFound: 'Entry not found',
        notFoundBody:
          'This link may have moved, or the entry has not been published yet.',
        backToIndex: 'See all entries',
      },
    },
    agent: {
      nav: 'Ask',
      pageTitle: 'Query the dossier',
      pageHeading: (
        <>
          What would you like to know about{' '}
          <em className="font-display-italic pl-[0.02em] pr-[0.09em] text-ember">Marcus</em>?
        </>
      ),
      pageSubtitle:
        'Answers grounded in shipped code and client work — or paste a role to map evidence.',
      drawerHeading: 'Interactive dossier',
      newChat: 'New thread',
      expandFull: 'Full page',
      assistantTurnLabel: 'Dossier response',
      stoppedNotice: 'Generation stopped.',
      copyAnswer: 'Copy',
      copiedAnswer: 'Copied',
      shareLink: 'Copy link',
      copiedLink: 'Link copied',
      followupsLabel: 'Follow-ups',
      queue: {
        heading: (count) => (count === 1 ? '1 queued' : `${count} queued`),
        addHint: 'Press Enter to queue while streaming…',
        sendNow: 'Send now',
        remove: 'Remove from queue',
        clearAll: 'Clear queue',
      },
      lenses: {
        label: 'Lens',
        recruiter: 'Recruiter',
        recruiterHint: 'Role fit, impact, and availability',
        engineer: 'Engineer',
        engineerHint: 'Architecture, stack, and systems craft',
        client: 'Client',
        clientHint: 'Discovery, scoping, and production delivery',
      },
      input: {
        ariaLabel: 'Ask Marcus’s dossier',
        placeholder: 'Ask anything, type / or paste a job description…',
        fitPlaceholder: 'Paste a job description or drop a .txt/.md file…',
        commandsLabel: 'Commands',
        slashToggle: 'Slash commands',
        attachFile: 'Attach job description (.txt / .md)',
        removeCommand: 'Remove command',
        kbdMove: 'move',
        kbdPick: 'pick',
        kbdClose: 'close',
        send: 'Send',
        stop: 'Stop',
      },
      voice: {
        start: 'Dictate question by voice',
        listening: 'Listening… speak your question',
        discard: 'Discard',
        unsupported: 'Speech recognition is unavailable in this browser.',
      },
      tools: {
        running: (count) =>
          count === 1 ? 'Querying 1 source…' : `Querying ${count} sources…`,
        summary: (count, totalMs, evidenceCount) =>
          `${count} ${count === 1 ? 'tool' : 'tools'} · ${totalMs}ms · ${evidenceCount} ${evidenceCount === 1 ? 'source' : 'sources'}`,
        viewJson: 'JSON',
        hideJson: 'Hide',
      },
      citations: {
        sourcesLabel: 'Sources',
        openSource: 'Open source',
      },
      fit: {
        heading: 'Evidence-based fit',
        verifiedShort: 'verified',
        gapsShort: 'unlisted',
        copyBrief: 'Copy .md',
        copiedBrief: 'Copied',
        downloadBrief: 'Download .md',
        printPdf: 'PDF',
        shareLink: 'Copy link',
        copiedLink: 'Link copied',
        verifiedLabel: 'Verified evidence',
        gapsLabel: 'Not listed in public dossier',
        noMatches:
          'No specific technologies extracted — include the role’s tech stack or responsibilities.',
        noGaps:
          'No technologies outside the public stack were detected in the text.',
        adjacentPrefix: 'Adjacent',
        academicOnly: 'Coursework only',
      },
      terrain: {
        title: 'GitHub Activity Terrain',
        viewToggleLabel: 'Contribution graph view mode',
        flat: 'Flat',
        terrain: 'Terrain',
        less: 'Less',
        more: 'More',
        dragHint: 'Drag to rotate · arrows to inspect',
        latestRelease: 'Latest release',
        activeDays: (days) => `${days} active days`,
        streak: (days) => `${days}d max streak`,
        windowSummary: (total, weeks) =>
          `${total.toLocaleString('en-US')} contributions in the last ${weeks} weeks`,
        dayReadout: (count, dayLabel) =>
          `${count} ${count === 1 ? 'contribution' : 'contributions'} on ${dayLabel}`,
        canvasAria: (total, weeks) =>
          `3D GitHub Activity Terrain: ${total.toLocaleString('en-US')} contributions over ${weeks} weeks. Use arrow keys to read each day.`,
      },
      approval: {
        defaultSubject: 'Dossier inquiry',
        toLabel: 'To',
        subjectLabel: 'Subject',
        inboxTag: 'Direct to Marcus’s inbox',
        confirmSend: 'Send',
        undo: 'Undo',
        cancel: 'Discard',
        dismissed: 'Draft discarded.',
        sentSuccess: 'Delivered to Marcus’s inbox.',
        sentReceipt: (name) => `Sent to ${name} · just now`,
        fillRequired: 'Please enter your name, valid email, and message first.',
        sendError: 'Could not send right now — please try again.',
        offlineFallback: 'Inbox is temporarily offline — please email directly.',
        openedMailto: 'Opened your email client with the draft.',
        namePlaceholder: 'Your name',
        emailPlaceholder: 'you@company.com',
        downloadPt: 'CV (PT-BR)',
        downloadEn: 'Resume (EN)',
      },
      meter: {
        ariaLabel: (total) => `${total} indexed sources. Show breakdown`,
        sourcesUnit: 'sources',
        popoverTitle: 'Indexed context',
        projects: 'Public projects',
        clients: 'Client deliveries',
        stack: 'Technologies',
        notes: 'Dossier notes',
        posts: 'Journal entries',
        sections: 'Journal sections',
        turns: 'Session turns',
        runtimeLabel: 'Local · deterministic',
        verifiedStatus: 'Verified dossier',
        liveCms: 'Live CMS',
        staticSeed: 'Static seed',
        modeLabel: 'Runtime',
        modeAuto: 'Hybrid',
        modeLocal: 'Local',
        edgeReady: (model) => `Edge LLM · ${model}`,
        edgeStandby: 'Local · Edge ready for key',
        rateLimitNote: 'Edge rate limit reached — answered by the local deterministic engine.',
      },
    },
    marquee: ['Build', 'Learn', 'Iterate', 'Repeat'],
    cursor: { view: 'VIEW', drag: 'DRAG' },
  },
}
