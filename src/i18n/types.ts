/** Plural forms by Intl.PluralRules category. `other` is always required; {n} is the number. */
export interface Plural {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface QA {
  q: string;
  a: string;
}

export interface Dictionary {
  meta: {
    /** <title> of the home page, about 60 characters. */
    title: string;
    /** Meta description of the home page, about 155 characters. */
    description: string;
    speedTitle: string;
    speedDescription: string;
    privacyTitle: string;
    privacyDescription: string;
    notFoundTitle: string;
    /** Alt text for the share image. */
    ogAlt: string;
    /** Short tagline drawn on the share image. */
    ogTagline: string;
  };
  nav: {
    skip: string;
    home: string;
    speedCalculator: string;
    privacy: string;
    language: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    github: string;
  };
  hero: {
    h1: string;
    lead: string;
  };
  form: {
    label: string;
    placeholder: string;
    help: string;
    paste: string;
    examples: string;
    exampleCourse: string;
    exampleMusic: string;
    exampleChannel: string;
    mode: string;
    modeAll: string;
    modeRange: string;
    modeFrom: string;
    rangeFrom: string;
    rangeTo: string;
    fromLabel: string;
    speed: string;
    customSpeed: string;
    submit: string;
    submitting: string;
    clear: string;
    recent: string;
    clearRecent: string;
    /** {n} = video number. */
    startIndexNote: string;
  };
  progress: {
    /** {title} */
    reading: string;
    /** {loaded} {total} */
    count: string;
    /** {seconds} */
    estimate: string;
    cancel: string;
    /** {n} {total}: which link of how many is loading. */
    listOf: string;
  };
  errors: {
    empty: string;
    noValid: string;
    mix: string;
    private_list: string;
    custom_url: string;
    /** {text} */
    unknown: string;
    not_found: string;
    quota: string;
    rate_limited: string;
    upstream: string;
    config: string;
    invalid_input: string;
    network: string;
    /** {title}: a list that failed while others loaded. */
    partial: string;
    /** {n} */
    tooMany: string;
  };
  results: {
    heading: string;
    total: string;
    /** {speed} */
    atSpeed: string;
    /** {time} */
    saves: string;
    allNote: string;
    /** {from} {to} */
    rangeNote: string;
    /** {from} */
    fromNote: string;
    unavailable: Plural;
    live: Plural;
    /** {time} */
    watchedNote: string;
    average: string;
    longest: string;
    shortest: string;
    truncated: string;
    speedsHeading: string;
    speedCol: string;
    timeCol: string;
    savedCol: string;
    timelineLabel: string;
    /** {channel} */
    by: string;
    channelUploads: string;
    openOnYouTube: string;
    /** {n} lists combined */
    combined: string;
  };
  planner: {
    heading: string;
    perDay: string;
    customMinutes: string;
    weekdays: string;
    startDate: string;
    /** {days} {date} */
    finish: string;
    deadlineLabel: string;
    /** {time} {date} */
    deadlineResult: string;
    deadlinePast: string;
    /** {n} */
    day: string;
    /** {a} {b} */
    videosRange: string;
    /** {n} */
    videoOne: string;
    /** {n} {start} {end} */
    videoPart: string;
    addCalendar: string;
    /** {n} */
    showAll: string;
    showFewer: string;
    /** {title} */
    calendarName: string;
  };
  /** "How much time do you have?": the slowest YouTube speed that fits the time. */
  fit: {
    heading: string;
    lead: string;
    hours: string;
    minutes: string;
    speedLabel: string;
    /** {time} */
    normal: string;
    /** {time} */
    finish: string;
    /** {spare} */
    spare: string;
    premium: string;
    /** {time} */
    impossible: string;
    /** {speed} */
    apply: string;
    /** {speed} */
    howTo: string;
  };
  list: {
    heading: string;
    search: string;
    hideWatched: string;
    number: string;
    title: string;
    duration: string;
    doneBy: string;
    /** {title} */
    markWatched: string;
    startHere: string;
    /** {n} */
    more: string;
    /** {q} */
    none: string;
    /** {count} {time} {total} */
    watchedProgress: string;
    resetWatched: string;
    statusLive: string;
    statusPrivate: string;
    statusDeleted: string;
    statusUnavailable: string;
  };
  actions: {
    heading: string;
    share: string;
    copyLink: string;
    copied: string;
    copySummary: string;
    downloadCsv: string;
    /** {title} {total} {fast} {speed} */
    shareText: string;
    /** {title} {count} {total} {speed} {fast} {link} */
    summary: string;
    email: string;
    shareSite: string;
    shareSiteText: string;
  };
  csv: {
    channel: string;
    seconds: string;
    atSpeed: string;
    status: string;
    watched: string;
    link: string;
    yes: string;
    ok: string;
  };
  units: {
    h: string;
    m: string;
    s: string;
    unitGap: string;
    partGap: string;
  };
  plurals: {
    videos: Plural;
    days: Plural;
  };
  content: {
    /** Short feature names, used only in structured data (WebApplication featureList). */
    featureList: string[];
    referenceHeading: string;
    referenceIntro: string;
    referenceLength: string;
    /** Followed by a link to the video speed calculator. */
    toSpeed: string;
    faqHeading: string;
    faq: QA[];
  };
  speedPage: {
    h1: string;
    lead: string;
    lengthLegend: string;
    linkLabel: string;
    linkButton: string;
    linkFailed: string;
    hours: string;
    minutes: string;
    seconds: string;
    speed: string;
    /** {speed} */
    resultAt: string;
    tableHeading: string;
    faq: QA[];
    toPlaylist: string;
    toPlaylistLink: string;
  };
  privacy: {
    h1: string;
    updated: string;
    intro: string;
    sections: { heading: string; paragraphs: string[] }[];
  };
  footer: {
    tagline: string;
    /** {name} */
    madeBy: string;
    source: string;
    apiNote: string;
    ytTerms: string;
    googlePrivacy: string;
    languages: string;
  };
  notFound: {
    h1: string;
    text: string;
    home: string;
  };
  noscript: string;
}
