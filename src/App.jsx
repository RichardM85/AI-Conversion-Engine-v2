import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Eye,
  FileText,
  Globe,
  LayoutList,
  Link2,
  ListChecks,
  Moon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const SCORE_ORDER = [
  "aboveTheFold",
  "valueProposition",
  "emotionalHook",
  "cta",
  "trustSignals",
  "informationHierarchy",
  "conversionFriction",
  "differentiation",
  "brandVoice",
];

const LANGUAGE_STORAGE_KEY = "ai-conversion-language";
const THEME_STORAGE_KEY = "ai-conversion-theme";

const COPY = {
  de: {
    appName: "AI Conversion Engine",
    heroEyebrow: "CONVERSION-OPTIMIERUNG FUER MODERNE E-COMMERCE-TEAMS",
    heroTitle: "Mach aus Produktseiten hochkonvertierende Verkaufsmaschinen",
    heroIntro:
      "Fuege eine Beauty-Produktseite ein und erhalte eine schaerfere, ueberzeugendere Conversion-Perspektive fuer Premium-Skincare- und Haircare-Kaeuferinnen.",
    productUrl: "Produktseiten-URL",
    targetAudience: "Zielgruppe",
    monthlyRevenue: "Monatsumsatz",
    brandVoice: "Markenstimme",
    trafficSource: "Haupt-Trafficquelle",
    analyze: "Seite analysieren",
    analyzing: "Seite wird analysiert...",
    trustRow: "Verbindet sich mit einem echten KI-Analyse-Endpunkt",
    frontendMvp: "Frontend MVP",
    language: "Sprache",
    steps: ["1. URL eingeben", "2. Analysieren", "3. Staerkere Version pruefen"],
    loadingKicker: "RUNNING PAGE ANALYSIS",
    loadingTitle: "Reviewing structure, proof, visuals, and purchase friction",
    loadingCopy:
      "Capturing the page, reading the structure, and building a deeper ecommerce audit across messaging, hierarchy, trust, layout, and buying confidence.",
    loadingLive: "Analysis live",
    loadingStages: [
      "Capturing page",
      "Reading structure",
      "Evaluating messaging",
      "Diagnosing friction",
      "Building recommendations",
    ],
    resultKicker: "KI-ANALYSEERGEBNIS",
    resultTitle: "Vergleich der Conversion-Ueberarbeitung",
    liveAi: "Live-KI-Antwort",
    confidence: "Confidence",
    mode: "Modus",
    fallback: "Fallback aktiv",
    live: "Live-Analyse",
    summary: "DIAGNOSTISCHE ZUSAMMENFASSUNG",
    warnings: "Hinweise",
    visualAudit: "VISUELLES AUDIT",
    visualScore: "Visueller Score",
    mobileScore: "Mobile Score",
    primaryDecision: "DAS ZUERST ANGEHEN",
    priority: "PRIORITAETSMASSNAHMEN",
    doFirst: "Das zuerst angehen",
    evidence: "EVIDENZ",
    actionLabel: "HANDLUNG",
    suggestedCopy: "EMPFOHLENE COPY",
    expectedOutcome: "ERWARTETE WIRKUNG",
    whyMatters: "Warum das wichtig ist",
    scores: "AUDIT-SCORES",
    flow: "CONVERSION-FLOW-AUFSCHLUESSELUNG",
    biggestLeak: "Groesstes Leak",
    versions: "VERSIONSTYP",
    currentVersion: "Aktuelle Version",
    optimizedVersion: "Optimierte Version",
    currentPositioning: "Aktuelle Positionierung",
    currentCta: "Aktuelle CTA",
    optimizedHeadline: "Optimierte Headline",
    optimizedSubheadline: "Optimierte Subheadline",
    optimizedCta: "Optimierte CTA",
    strongerWhy: "Warum das staerker ist",
    recommended: "EMPFOHLENE SEKTIONEN",
    improvements: "CONVERSION-ANALYSE",
    problem: "PROBLEM",
    hurts: "WARUM DAS SCHADET",
    fix: "FIX",
    impact: "Umsatzpotenzial",
    desktop: "Desktop",
    mobile: "Mobile",
    noScreenshots: "Keine Screenshots verfuegbar",
    requestFailed: "Die Analyse konnte nicht geladen werden.",
    placeholders: {
      url: "https://brand.com/products/leave-in-conditioner",
      audience:
        "30-45, Einkommen 2500 netto aufwaerts, primaer millennials, sekundaer gen z, 50-50 Geschlecht",
      voice: "Premium",
    },
    revenueOptions: [
      { value: "<50k", label: "<50k" },
      { value: "50k-200k", label: "50k-200k" },
      { value: "200k-1M", label: "200k-1M" },
      { value: ">1M", label: ">1M" },
      { value: "unknown", label: "Unbekannt" },
    ],
    trafficOptions: [
      { value: "organic", label: "Google / SEO" },
      { value: "paid", label: "Ads / SEA" },
      { value: "social", label: "Social" },
      { value: "direct", label: "Direktzugriff" },
      { value: "mixed", label: "Mix" },
      { value: "unknown", label: "Unbekannt" },
    ],
    scoreLabels: {
      aboveTheFold: "Above the fold",
      valueProposition: "Wertversprechen",
      emotionalHook: "Emotionaler Hook",
      cta: "CTA-Klarheit",
      trustSignals: "Vertrauenssignale",
      informationHierarchy: "Informationshierarchie",
      conversionFriction: "Conversion-Huerden",
      differentiation: "Differenzierung",
      brandVoice: "Markenstimme",
    },
    flowSteps: ["Einstieg", "Erster Screen", "Interesse", "Vertrauen", "Entscheidung"],
    issues: {
      high: "HOCH",
      medium: "MITTEL",
      low: "NIEDRIG",
    },
    confidenceLevels: {
      low: "niedrig",
      medium: "mittel",
      high: "hoch",
    },
  },
  en: {
    appName: "AI Conversion Engine",
    heroEyebrow: "CONVERSION OPTIMIZATION FOR MODERN ECOMMERCE TEAMS",
    heroTitle: "Turn product pages into high-converting sales machines",
    heroIntro:
      "Paste in a beauty ecommerce product page and get a sharper, more persuasive conversion angle for premium skincare and haircare shoppers.",
    productUrl: "Product page URL",
    targetAudience: "Target audience",
    monthlyRevenue: "Monthly revenue",
    brandVoice: "Brand voice",
    trafficSource: "Main traffic source",
    analyze: "Analyze page",
    analyzing: "Analyzing page...",
    trustRow: "Connects to a real AI analysis endpoint",
    frontendMvp: "Frontend MVP",
    language: "Language",
    steps: ["1. Enter URL", "2. Analyze", "3. Review improved copy"],
    loadingKicker: "RUNNING PAGE ANALYSIS",
    loadingTitle: "Reviewing structure, proof, visuals, and purchase friction",
    loadingCopy:
      "Capturing the page, reading the structure, and building a deeper ecommerce audit across messaging, hierarchy, trust, layout, and buying confidence.",
    loadingLive: "Analysis live",
    loadingStages: [
      "Capturing page",
      "Reading structure",
      "Evaluating messaging",
      "Diagnosing friction",
      "Building recommendations",
    ],
    resultKicker: "AI ANALYSIS RESULT",
    resultTitle: "Conversion rewrite comparison",
    liveAi: "Live AI response",
    confidence: "Confidence",
    mode: "Mode",
    fallback: "Fallback active",
    live: "Live analysis",
    summary: "DIAGNOSTIC SUMMARY",
    warnings: "Warnings",
    visualAudit: "VISUAL AUDIT",
    visualScore: "Visual score",
    mobileScore: "Mobile score",
    primaryDecision: "DO THIS FIRST",
    priority: "PRIORITY ACTIONS",
    doFirst: "Do this first",
    evidence: "EVIDENCE",
    actionLabel: "ACTION",
    suggestedCopy: "SUGGESTED COPY",
    expectedOutcome: "EXPECTED OUTCOME",
    whyMatters: "Show why this matters",
    scores: "AUDIT SCORES",
    flow: "CONVERSION FLOW BREAKDOWN",
    biggestLeak: "Biggest leak",
    versions: "VERSION TYPE",
    currentVersion: "Current version",
    optimizedVersion: "Optimized version",
    currentPositioning: "Current positioning",
    currentCta: "Current CTA",
    optimizedHeadline: "Optimized headline",
    optimizedSubheadline: "Optimized subheadline",
    optimizedCta: "Optimized CTA",
    strongerWhy: "Why this is stronger",
    recommended: "RECOMMENDED SECTIONS",
    improvements: "CONVERSION ANALYSIS",
    problem: "PROBLEM",
    hurts: "WHY IT HURTS",
    fix: "FIX",
    impact: "Revenue upside",
    desktop: "Desktop",
    mobile: "Mobile",
    noScreenshots: "No screenshots available",
    requestFailed: "The analysis could not be loaded.",
    placeholders: {
      url: "https://brand.com/products/leave-in-conditioner",
      audience:
        "30-45, household income 2500+ net, primarily millennials, secondarily gen z, balanced gender mix",
      voice: "Premium",
    },
    revenueOptions: [
      { value: "<50k", label: "<50k" },
      { value: "50k-200k", label: "50k-200k" },
      { value: "200k-1M", label: "200k-1M" },
      { value: ">1M", label: ">1M" },
      { value: "unknown", label: "Unknown" },
    ],
    trafficOptions: [
      { value: "organic", label: "Google / SEO" },
      { value: "paid", label: "Ads / SEA" },
      { value: "social", label: "Social" },
      { value: "direct", label: "Direct" },
      { value: "mixed", label: "Mixed" },
      { value: "unknown", label: "Unknown" },
    ],
    scoreLabels: {
      aboveTheFold: "Above the fold",
      valueProposition: "Value proposition",
      emotionalHook: "Emotional hook",
      cta: "CTA clarity",
      trustSignals: "Trust signals",
      informationHierarchy: "Information hierarchy",
      conversionFriction: "Conversion friction",
      differentiation: "Differentiation",
      brandVoice: "Brand voice",
    },
    flowSteps: ["Entry", "First screen", "Interest", "Trust", "Decision"],
    issues: {
      high: "HIGH",
      medium: "MEDIUM",
      low: "LOW",
    },
    confidenceLevels: {
      low: "low",
      medium: "medium",
      high: "high",
    },
  },
};

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(10, Math.round(numeric)));
}

function scoreTone(value) {
  if (value >= 8) {
    return "strong";
  }
  if (value >= 5) {
    return "balanced";
  }
  return "weak";
}

function formatImpact(result, locale) {
  if (!result?.impactEstimate) {
    return null;
  }

  const { monthlyImpactLow, monthlyImpactHigh, currency, explanation } = result.impactEstimate;
  if (typeof monthlyImpactLow === "number" && typeof monthlyImpactHigh === "number") {
    return `${monthlyImpactLow.toLocaleString(locale)} - ${monthlyImpactHigh.toLocaleString(locale)} ${currency}`;
  }

  return explanation || null;
}

function sanitizeResult(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const scores = {};
  for (const key of SCORE_ORDER) {
    scores[key] = clampScore(data.scores?.[key]);
  }

  return {
    ...data,
    headline: typeof data.headline === "string" ? data.headline : "",
    subheadline: typeof data.subheadline === "string" ? data.subheadline : "",
    summary: typeof data.summary === "string" ? data.summary : "",
    cta: typeof data.cta === "string" ? data.cta : "",
    scores,
    visualScore: clampScore(data.visualScore),
    mobileScore: clampScore(data.mobileScore),
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    priorityActions: Array.isArray(data.priorityActions) ? data.priorityActions : [],
    recommendedSections: Array.isArray(data.recommendedSections) ? data.recommendedSections : [],
    improvements: Array.isArray(data.improvements) ? data.improvements : [],
    visualFindings: Array.isArray(data.visualFindings) ? data.visualFindings : [],
    screenshotUrls:
      data.screenshotUrls && typeof data.screenshotUrls === "object"
        ? data.screenshotUrls
        : { desktop: null, mobile: null },
    conversionFlow:
      data.conversionFlow && typeof data.conversionFlow === "object" ? data.conversionFlow : {},
    primaryDecision:
      data.primaryDecision && typeof data.primaryDecision === "object"
        ? {
            ...data.primaryDecision,
            evidence: Array.isArray(data.primaryDecision.evidence)
              ? data.primaryDecision.evidence.filter((item) => typeof item === "string")
              : [],
          }
        : null,
  };
}

function localizeConfidence(value, copy) {
  const key = String(value || "low").toLowerCase();
  return copy.confidenceLevels?.[key] || key;
}

function App() {
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") {
      return "de";
    }
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "de";
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.localStorage.getItem(THEME_STORAGE_KEY) || "light";
  });
  const [url, setUrl] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [revenueRange, setRevenueRange] = useState("unknown");
  const [trafficSource, setTrafficSource] = useState("unknown");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(12);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const copy = COPY[language] || COPY.de;
  const canAnalyze = url.trim().length > 0;

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.body.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!isLoading) {
      setProgress(12);
      return undefined;
    }

    setProgress(18);
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) {
          return current;
        }
        if (current < 32) {
          return current + 6;
        }
        if (current < 56) {
          return current + 4;
        }
        if (current < 76) {
          return current + 3;
        }
        return current + 2;
      });
    }, 520);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  const impactLabel = useMemo(
    () => formatImpact(result, language === "de" ? "de-DE" : "en-US"),
    [language, result],
  );
  const hasScreenshots = Boolean(result?.screenshotUrls?.desktop || result?.screenshotUrls?.mobile);
  const primaryDecision = result?.primaryDecision || null;

  const flowEntries = useMemo(
    () => [
      ["entry", copy.flowSteps[0]],
      ["firstScreen", copy.flowSteps[1]],
      ["interest", copy.flowSteps[2]],
      ["trust", copy.flowSteps[3]],
      ["decision", copy.flowSteps[4]],
    ],
    [copy.flowSteps],
  );

  async function handleAnalyze(event) {
    event.preventDefault();
    if (!canAnalyze || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("http://localhost:8787/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          audience: targetAudience.trim(),
          brandVoice: brandVoice.trim(),
          language,
          revenueRange,
          trafficSource,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || copy.requestFailed);
      }

      setProgress(100);
      setResult(sanitizeResult(data));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : copy.requestFailed);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-glow page-glow-left" />
      <div className="page-glow page-glow-right" />

      <header className="hero-shell">
        <nav className="topbar">
          <div className="brand-mark">
            <span className="brand-dot" />
            <span>{copy.appName}</span>
          </div>

          <div className="topbar-actions">
            <span className="top-pill">
              <Sparkles size={16} />
              <span>{copy.frontendMvp}</span>
            </span>

            <span className="top-pill">
              <Globe size={16} />
              <span>{copy.language}</span>
            </span>

            <div className="language-toggle" role="tablist" aria-label={copy.language}>
              {["de", "en"].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`language-option${language === value ? " is-active" : ""}`}
                  onClick={() => setLanguage(value)}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              className="theme-toggle"
              type="button"
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              aria-label="Toggle theme"
            >
              <Moon size={16} />
            </button>
          </div>
        </nav>

        <section className="hero-card">
          <div className="hero-grid">
            <div className="hero-copy-column">
              <p className="hero-eyebrow">{copy.heroEyebrow}</p>
              <h1>{copy.heroTitle}</h1>
              <p className="hero-intro">{copy.heroIntro}</p>

              <div className="hero-steps" aria-hidden="true">
                {copy.steps.map((item, index) => (
                  <span className="hero-step-pill" key={`${item}-${index}`}>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="hero-form-shell">
              <form className="analysis-form" onSubmit={handleAnalyze}>
                <div className="field-block field-span-2">
                  <label className="field-label" htmlFor="product-url">
                    {copy.productUrl}
                  </label>
                  <div className="input-shell">
                    <Link2 size={16} />
                    <input
                      id="product-url"
                      className="form-input"
                      type="url"
                      value={url}
                      placeholder={copy.placeholders.url}
                      onChange={(event) => setUrl(event.target.value)}
                    />
                  </div>
                </div>

                <div className="field-grid">
                  <div className="field-block">
                    <label className="field-label" htmlFor="target-audience">
                      {copy.targetAudience}
                    </label>
                    <div className="input-shell">
                      <Users2 size={16} />
                      <input
                        id="target-audience"
                        className="form-input"
                        type="text"
                        value={targetAudience}
                        placeholder={copy.placeholders.audience}
                        onChange={(event) => setTargetAudience(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field-block">
                    <label className="field-label" htmlFor="revenue-range">
                      {copy.monthlyRevenue}
                    </label>
                    <div className="input-shell">
                      <BarChart3 size={16} />
                      <select
                        id="revenue-range"
                        className="form-select"
                        value={revenueRange}
                        onChange={(event) => setRevenueRange(event.target.value)}
                      >
                        {copy.revenueOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field-block">
                    <label className="field-label" htmlFor="brand-voice">
                      {copy.brandVoice}
                    </label>
                    <div className="input-shell">
                      <Sparkles size={16} />
                      <input
                        id="brand-voice"
                        className="form-input"
                        type="text"
                        value={brandVoice}
                        placeholder={copy.placeholders.voice}
                        onChange={(event) => setBrandVoice(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field-block">
                    <label className="field-label" htmlFor="traffic-source">
                      {copy.trafficSource}
                    </label>
                    <div className="input-shell">
                      <TrendingUp size={16} />
                      <select
                        id="traffic-source"
                        className="form-select"
                        value={trafficSource}
                        onChange={(event) => setTrafficSource(event.target.value)}
                      >
                        {copy.trafficOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button className="primary-button" type="submit" disabled={!canAnalyze || isLoading}>
                  {isLoading ? copy.analyzing : copy.analyze}
                </button>

                <p className="hero-trust-row">{copy.trustRow}</p>
              </form>
            </div>
          </div>

          <div className="hero-separator" aria-hidden="true" />
        </section>
      </header>

      <main className="results-shell">
        {error ? (
          <section className="surface-card error-card">
            <div className="section-head">
              <span className="section-kicker">Error</span>
              <AlertCircle size={18} />
            </div>
            <p className="body-copy">{error}</p>
          </section>
        ) : null}

        {isLoading ? (
          <section className="surface-card loading-card">
            <div className="loading-orb" aria-hidden="true" />
            <p className="section-kicker loading-kicker">{copy.loadingKicker}</p>
            <h2 className="loading-title">{copy.loadingTitle}</h2>
            <p className="loading-copy">{copy.loadingCopy}</p>

            <div className="loading-inline-pill">
              <Activity size={16} />
              <span>{copy.loadingLive}</span>
            </div>

            <div className="loading-progress-wrap">
              <div className="loading-progress-label">
                <strong>{progress}%</strong>
                <span>{copy.loadingStages[Math.min(Math.floor(progress / 20), 4)]}</span>
              </div>
              <div className="loading-progress-bar">
                <span className="loading-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="loading-stage-grid">
              {copy.loadingStages.map((item, index) => (
                <div
                  className={`loading-stage-pill${
                    progress >= (index + 1) * 20 ? " is-complete" : ""
                  }`}
                  key={item}
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {result ? (
          <section className="result-stack">
            {primaryDecision ? (
              <article className="surface-card primary-decision-card">
                <div className="section-head">
                  <span className="section-kicker">{copy.primaryDecision}</span>
                  <span className="white-pill">
                    <TrendingUp size={16} />
                    <span>{copy.whyMatters}</span>
                  </span>
                </div>

                <div className="impact-card primary-decision-impact">
                  <strong>{primaryDecision.impactHeadline}</strong>
                </div>
                <h3 className="primary-decision-title">{primaryDecision.title}</h3>
                <p className="body-copy primary-decision-problem">{primaryDecision.problem}</p>

                <div className="primary-decision-grid">
                  <div className="primary-decision-column">
                    <span className="meta-label">{copy.evidence}</span>
                    <ul className="bullet-list bullet-list-strong">
                      {primaryDecision.evidence.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="primary-decision-column">
                    <span className="meta-label">{copy.actionLabel}</span>
                    <p className="body-copy primary-decision-action">{primaryDecision.action}</p>

                    {primaryDecision.suggestedCopy ? (
                      <div className="version-block primary-decision-block">
                        <span className="meta-label">{copy.suggestedCopy}</span>
                        <span className="cta-pill">{primaryDecision.suggestedCopy}</span>
                      </div>
                    ) : null}

                    <div className="version-block primary-decision-block">
                      <span className="meta-label">{copy.expectedOutcome}</span>
                      <p className="body-copy primary-decision-outcome">{primaryDecision.expectedOutcome}</p>
                    </div>

                    <div className="version-block primary-decision-block">
                      <span className="meta-label">{copy.confidence}</span>
                      <p className="primary-decision-confidence">
                        {localizeConfidence(primaryDecision.confidence, copy)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ) : null}

            <article className="surface-card result-summary-card">
              <div className="summary-topbar">
                <div>
                  <p className="section-kicker">{copy.resultKicker}</p>
                  <h2>{copy.resultTitle}</h2>
                </div>

                <div className="meta-pill-row">
                  <span className="white-pill">
                    <Bot size={16} />
                    <span>{copy.liveAi}</span>
                  </span>
                  <span className="white-pill">
                    <ShieldCheck size={16} />
                    <span>{result.submittedUrl ? new URL(result.submittedUrl).hostname.replace(/^www\./, "") : copy.appName}</span>
                  </span>
                </div>
              </div>

              <section className="inner-card">
                <div className="section-head">
                  <span className="section-kicker">{copy.summary}</span>
                  <FileText size={16} />
                </div>

                <p className="body-copy summary-copy">{result.summary}</p>

                <div className="summary-meta-grid">
                  <div>
                    <span className="meta-label">{copy.productUrl}</span>
                    <p>{result.submittedUrl || url}</p>
                  </div>
                  <div>
                    <span className="meta-label">{copy.targetAudience}</span>
                    <p>{result.submittedAudience || targetAudience || "-"}</p>
                  </div>
                  <div>
                    <span className="meta-label">{copy.brandVoice}</span>
                    <p>{result.submittedVoice || brandVoice || "-"}</p>
                  </div>
                  <div>
                    <span className="meta-label">{copy.confidence}</span>
                    <p>{localizeConfidence(result.confidence || "low", copy)}</p>
                  </div>
                  <div>
                    <span className="meta-label">{copy.mode}</span>
                    <p>{result.isFallback ? copy.fallback : copy.live}</p>
                  </div>
                </div>

                <div className="summary-block">
                  <span className="meta-label">{copy.optimizedSubheadline}</span>
                  <p className="body-copy">{result.subheadline}</p>
                </div>

                {result.warnings.length ? (
                  <div className="summary-block">
                    <span className="meta-label">{copy.warnings}</span>
                    <ul className="bullet-list">
                      {result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </article>

            <article className="surface-card">
              <div className="section-head">
                <span className="section-kicker">{copy.visualAudit}</span>
                <Eye size={18} />
              </div>

              <div className={`visual-grid${hasScreenshots ? "" : " visual-grid-empty"}`}>
                <div className="visual-shots">
                  {result.screenshotUrls?.desktop ? (
                    <figure className="shot-card">
                      <figcaption>{copy.desktop}</figcaption>
                      <img src={result.screenshotUrls.desktop} alt={copy.desktop} />
                    </figure>
                  ) : null}
                  {result.screenshotUrls?.mobile ? (
                    <figure className="shot-card shot-card-mobile">
                      <figcaption>{copy.mobile}</figcaption>
                      <img src={result.screenshotUrls.mobile} alt={copy.mobile} />
                    </figure>
                  ) : null}
                  {!result.screenshotUrls?.desktop && !result.screenshotUrls?.mobile ? (
                    <div className="shot-empty">
                      <Eye size={18} />
                      <p>{copy.noScreenshots}</p>
                    </div>
                  ) : null}
                </div>

                <div className="visual-insights">
                  <div className="score-strip">
                    <div className="score-strip-card">
                      <span className="meta-label">{copy.visualScore}</span>
                      <div className="score-strip-value">
                        <strong className={`tone-${scoreTone(result.visualScore)}`}>
                          {result.visualScore}
                        </strong>
                        <span>/10</span>
                      </div>
                    </div>
                    <div className="score-strip-card">
                      <span className="meta-label">{copy.mobileScore}</span>
                      <div className="score-strip-value">
                        <strong className={`tone-${scoreTone(result.mobileScore)}`}>
                          {result.mobileScore}
                        </strong>
                        <span>/10</span>
                      </div>
                    </div>
                  </div>

                  <div className="finding-list">
                    {result.visualFindings.map((item) => {
                      const impactKey = String(item.impact || "medium").toLowerCase();
                      return (
                        <div className="finding-row" key={`${item.title}-${item.observation}`}>
                          <div className="finding-head">
                            <strong>{item.title}</strong>
                            <span className={`impact-pill impact-${impactKey}`}>
                              {copy.issues[impactKey] || item.impact}
                            </span>
                          </div>
                          <p>{item.observation}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>

            <article className="surface-card priority-card">
              <div className="section-head">
                <span className="section-kicker">{copy.priority}</span>
                <ListChecks size={18} />
              </div>
              <h3>{copy.doFirst}</h3>
              <ul className="bullet-list bullet-list-strong">
                {result.priorityActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="surface-card">
              <div className="section-head">
                <span className="section-kicker">{copy.scores}</span>
                <BarChart3 size={18} />
              </div>

              <div className="score-grid">
                {SCORE_ORDER.map((key) => (
                  <div className="score-card" key={key}>
                    <span className="meta-label">{copy.scoreLabels[key]}</span>
                    <div className="score-card-value">
                      <strong className={`tone-${scoreTone(result.scores[key])}`}>{result.scores[key]}</strong>
                      <span>/10</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="surface-card">
              <div className="section-head">
                <span className="section-kicker">{copy.flow}</span>
                <ArrowRight size={18} />
              </div>

              <div className="leak-card">
                <span className="meta-label">{copy.biggestLeak}</span>
                <p>{result.biggestLeak}</p>
              </div>

              <div className="flow-grid">
                {flowEntries.map(([key, label], index) => (
                  <div className="flow-card" key={key}>
                    <div className="flow-head">
                      <span className="flow-index">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{label}</strong>
                    </div>
                    <p>{result.conversionFlow?.[key] || ""}</p>
                  </div>
                ))}
              </div>
            </article>

            <div className="version-grid">
              <article className="surface-card version-card">
                <div className="version-head">
                  <span className="section-kicker">{copy.versions}</span>
                  <span className="white-pill">{copy.currentVersion}</span>
                </div>
                <div className="version-block">
                  <span className="meta-label">{copy.currentPositioning}</span>
                  <h3>{result.originalHeadline || result.headline}</h3>
                </div>
                <div className="version-block">
                  <span className="meta-label">{copy.currentCta}</span>
                  <span className="cta-pill muted">{result.originalCta || result.cta}</span>
                </div>
              </article>

              <article className="surface-card version-card">
                <div className="version-head">
                  <span className="section-kicker">{copy.versions}</span>
                  <span className="white-pill">{copy.optimizedVersion}</span>
                </div>
                <div className="version-block">
                  <span className="meta-label">{copy.optimizedHeadline}</span>
                  <h3>{result.headline}</h3>
                </div>
                <div className="version-block">
                  <span className="meta-label">{copy.optimizedSubheadline}</span>
                  <p className="body-copy">{result.subheadline}</p>
                </div>
                <div className="version-block">
                  <span className="meta-label">{copy.optimizedCta}</span>
                  <span className="cta-pill">{result.cta}</span>
                </div>
                <div className="version-block">
                  <span className="meta-label">{copy.strongerWhy}</span>
                  <ul className="bullet-list">
                    {result.priorityActions.slice(0, 2).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>

            <article className="surface-card">
              <div className="section-head">
                <span className="section-kicker">{copy.recommended}</span>
                <LayoutList size={18} />
              </div>
              <ul className="bullet-list">
                {result.recommendedSections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="surface-card">
              <div className="section-head">
                <span className="section-kicker">{copy.improvements}</span>
                <CheckCircle2 size={18} />
              </div>

              <div className="improvement-list">
                {result.improvements.map((item) => {
                  const impactKey = String(item.impact || "medium").toLowerCase();
                  return (
                    <div className="improvement-row" key={`${item.title}-${item.problem}`}>
                      <div className="improvement-title-row">
                        <div className="improvement-title-wrap">
                          <CheckCircle2 size={16} />
                          <strong>{item.title}</strong>
                        </div>
                        <span className={`impact-pill impact-${impactKey}`}>
                          {copy.issues[impactKey] || item.impact}
                        </span>
                      </div>
                      <div className="improvement-copy-block">
                        <span className="meta-label">{copy.problem}</span>
                        <p>{item.problem}</p>
                      </div>
                      <div className="improvement-copy-block">
                        <span className="meta-label">{copy.hurts}</span>
                        <p>{item.whyItHurts}</p>
                      </div>
                      <div className="improvement-copy-block">
                        <span className="meta-label">{copy.fix}</span>
                        <p>{item.fix}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            {impactLabel ? (
              <article className="surface-card">
                <div className="section-head">
                  <span className="section-kicker">{copy.impact}</span>
                  <TrendingUp size={18} />
                </div>
                <div className="impact-card">
                  <strong>{impactLabel}</strong>
                  {result.impactEstimate?.explanation ? <p>{result.impactEstimate.explanation}</p> : null}
                </div>
              </article>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
