import dotenv from "dotenv";
import { createServer } from "node:http";
import { chromium } from "playwright";

dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const REQUEST_TIMEOUT_MS = 20000;
const SCREENSHOT_TIMEOUT_MS = 30000;
const AI_TIMEOUT_MS = 45000;
const PAGE_SETTLE_MS = 1800;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "meta-llama/llama-3-70b-instruct";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

const CTA_MATCHERS = [
  "buy",
  "add to cart",
  "add to bag",
  "bag",
  "basket",
  "shop",
  "checkout",
  "kaufen",
  "jetzt",
  "warenkorb",
];
const REVIEW_KEYWORDS = ["review", "reviews", "stars", "bewertungen", "bewertung", "sterne"];
const GUARANTEE_KEYWORDS = [
  "money back",
  "money-back",
  "garantie",
  "guarantee",
  "refund",
  "returns",
  "rückgabe",
  "retoure",
];
const CERTIFICATION_KEYWORDS = [
  "dermatologisch",
  "clinical",
  "clinically",
  "certified",
  "zertifiziert",
  "tested",
  "geprüft",
];
const PAYMENT_KEYWORDS = ["paypal", "klarna", "visa", "mastercard", "amex", "apple pay"];
const RETURN_POLICY_KEYWORDS = [
  "return policy",
  "returns",
  "refund",
  "money back",
  "rückgabe",
  "retoure",
  "widerruf",
];
const PRODUCT_TERMS = [
  "ingredient",
  "ingredients",
  "inhaltsstoffe",
  "benefit",
  "benefits",
  "wirkung",
  "results",
  "result",
  "usage",
  "how to use",
  "anwendung",
  "routine",
  "formula",
  "serum",
  "cream",
  "hair",
  "skin",
  "conditioner",
  "shampoo",
  "treatment",
];
const PAGE_ERROR_KEYWORDS = [
  "404",
  "page not found",
  "this page is missing",
  "not found",
  "missing",
  "access denied",
  "forbidden",
  "verify you are human",
  "captcha",
];
const CONSENT_KEYWORDS = [
  "cookie",
  "consent",
  "privacy preference",
  "manage consent",
  "privacy center",
  "cookie list",
  "do not sell",
];

const SCORE_KEYS = [
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

const LANGUAGE_PACK = {
  de: {
    invalidUrl: "Eine gültige URL ist erforderlich.",
    screenshotWarning:
      "Screenshots konnten nicht erstellt werden. Analyse basiert auf Text- und HTML-Daten.",
    aiWarning:
      "Die KI-Auswertung konnte nicht abgeschlossen werden. Das Ergebnis basiert auf struktureller Evidenz und Heuristiken.",
    timeoutWarning: "Ein Timeout hat die Analyse teilweise eingeschränkt.",
    sections: [
      "Proof-Sektion mit sichtbaren Reviews oder Autoritätssignalen",
      "Benefit-Block mit klarer Übersetzung von Features in Käuferinnen-Nutzen",
      "Versand-, Rückgabe- und Zahlungs-Sicherheitsblock nahe der CTA",
      "FAQ-Sektion zur Reibungsreduktion vor dem Kauf",
    ],
    priority: {
      trust: "Vertrauenssignale näher an die primäre CTA ziehen",
      clarity: "Das Wertversprechen im ersten Screen konkreter machen",
      friction: "Versand-, Rückgabe- und Zahlungs-Sicherheit sichtbarer machen",
      mobile: "Den mobilen ersten Screen straffer und scannbarer gestalten",
      proof: "Mehr belastbaren Produkt- und Proof-Kontext sichtbar machen",
    },
    findings: {
      hierarchy: "Visuelle Hierarchie",
      cta: "CTA-Sichtbarkeit",
      trust: "Vertrauen im Sichtbereich",
      mobile: "Mobile Lesbarkeit",
      density: "Inhaltstiefe",
    },
  },
  en: {
    invalidUrl: "A valid URL is required.",
    screenshotWarning:
      "Screenshots could not be created. The analysis is based on text and HTML evidence.",
    aiWarning:
      "The AI evaluation could not be completed. The result is based on structural evidence and heuristics.",
    timeoutWarning: "A timeout partially constrained the analysis.",
    sections: [
      "Proof section with visible reviews or authority cues",
      "Benefit block translating features into shopper outcomes",
      "Shipping, return, and payment reassurance near the CTA",
      "FAQ section that reduces friction before purchase",
    ],
    priority: {
      trust: "Move trust signals closer to the primary CTA",
      clarity: "Make the first-screen value proposition more concrete",
      friction: "Surface shipping, return, and payment reassurance earlier",
      mobile: "Tighten the mobile first screen for faster scanning",
      proof: "Show stronger product depth and proof higher on the page",
    },
    findings: {
      hierarchy: "Visual hierarchy",
      cta: "CTA visibility",
      trust: "Trust in view",
      mobile: "Mobile readability",
      density: "Content depth",
    },
  },
};

function getLanguagePack(language) {
  return LANGUAGE_PACK[language] || LANGUAGE_PACK.en;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function logServerError(context, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${context}] ${message}`);
}

async function readRequestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
  }
  return body;
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCtaText(value) {
  const normalized = normalizeWhitespace(value)
    .replace(/\s+[€$£]\s*\d+[.,]?\d*/g, "")
    .replace(/[€$£]\s*\d+[.,]?\d*/g, "")
    .replace(/\b\d+\s*(ml|g|oz|stk|pcs)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized.length <= 80 ? normalized : normalized.slice(0, 80).trim();
}

function capitalizePhrase(value) {
  const normalized = normalizeWhitespace(value);
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
}

function clampScore(value, fallback = 5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(1, Math.min(10, Math.round(numeric)));
}

function uniqueList(items, limit = 10) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const normalized = normalizeWhitespace(item);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function validatePublicUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("A valid URL is required.");
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("A valid URL is required.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("A valid URL is required.");
  }

  return parsed.toString();
}

async function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function countKeywordHits(text, keywords) {
  const normalized = String(text || "").toLowerCase();
  return keywords.reduce((count, keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = normalized.match(new RegExp(escaped, "g"));
    return count + (matches ? matches.length : 0);
  }, 0);
}

function safeAverage(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getHostnameLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "page";
  }
}

function bufferToDataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      String(value || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function extractMatches(html, pattern, limit = 5) {
  const normalizedPattern = pattern.global
    ? pattern
    : new RegExp(pattern.source, `${pattern.flags}g`);
  return uniqueList(
    [...String(html || "").matchAll(normalizedPattern)].map((match) => stripHtml(match[1] || "")),
    limit,
  );
}

function extractMetaContent(html, key) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = String(html || "").match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(decodeHtmlEntities(match[1]));
    }
  }

  return "";
}

async function fetchPageHtml(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch the product page (${response.status}).`);
  }

  const html = await response.text();
  if (!html || html.length < 200) {
    throw new Error("Fetched page HTML was unexpectedly empty.");
  }

  return html;
}

function buildFallbackEvidence(url) {
  return {
    structure: {
      title: getHostnameLabel(url),
      metaDescription: "",
      h1: [],
      h2: [],
      h3: [],
      totalTextLength: 0,
      sectionsCount: 0,
    },
    ctas: {
      primaryText: "",
      ctaCount: 0,
      aboveTheFold: false,
      all: [],
    },
    trust: {
      reviewsCount: 0,
      trustKeywordsCount: 0,
      paymentSignalsCount: 0,
      returnPolicyDetected: false,
    },
    product: {
      productDetailScore: 0,
      ingredientsDetected: false,
      benefitsDetected: false,
      usageInstructionsDetected: false,
    },
    text: {
      totalTextLength: 0,
      keywordDensity: 0,
      keywordHits: 0,
      wordCount: 0,
    },
    pageSignals: {
      notFoundDetected: false,
      consentOverlayDetected: false,
      consentKeywordCount: 0,
      productIntentDetected: false,
    },
    screenshotsAvailable: false,
  };
}

function buildEvidenceFromHtml(html, url) {
  const title = extractMatches(html, /<title[^>]*>([\s\S]*?)<\/title>/i, 1)[0] || getHostnameLabel(url);
  const metaDescription =
    extractMetaContent(html, "description") ||
    extractMetaContent(html, "og:description") ||
    extractMetaContent(html, "twitter:description");
  const h1 = extractMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 5);
  const h2 = extractMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 5);
  const h3 = extractMatches(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi, 5);
  const bodyText = stripHtml(html);
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
  const totalTextLength = bodyText.length;
  const sectionsCount = Math.max(
    [...String(html || "").matchAll(/<(section|article)\b/gi)].length,
    [...String(html || "").matchAll(/<(div)[^>]+class=["'][^"']*section[^"']*["']/gi)].length,
  );
  const ctaTexts = uniqueList(
    [
      ...extractMatches(html, /<button[^>]*>([\s\S]*?)<\/button>/gi, 12),
      ...extractMatches(
        html,
        /<(?:a|button|input)[^>]+(?:aria-label|value)=["']([^"']{2,80})["'][^>]*>/gi,
        12,
      ),
    ]
      .map((text) => sanitizeCtaText(text))
      .filter((text) => CTA_MATCHERS.some((term) => text.toLowerCase().includes(term))),
    10,
  );
  const productKeywordHits = countKeywordHits(bodyText, PRODUCT_TERMS);
  const pageSignalSource = [title, metaDescription, ...h1, ...h2, ...h3, bodyText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const consentKeywordCount = countKeywordHits(pageSignalSource, CONSENT_KEYWORDS);
  const notFoundDetected = PAGE_ERROR_KEYWORDS.some((keyword) =>
    pageSignalSource.includes(keyword),
  );
  const productIntentDetected =
    productKeywordHits > 0 ||
    ctaTexts.length > 0 ||
    /(product|products|shop|buy|serum|cream|conditioner|shampoo|treatment)/i.test(
      pageSignalSource,
    );

  return {
    structure: {
      title,
      metaDescription,
      h1,
      h2,
      h3,
      totalTextLength,
      sectionsCount,
    },
    ctas: {
      primaryText: ctaTexts[0] || "",
      ctaCount: ctaTexts.length,
      aboveTheFold: false,
      all: ctaTexts,
    },
    trust: {
      reviewsCount: countKeywordHits(bodyText, REVIEW_KEYWORDS),
      trustKeywordsCount:
        countKeywordHits(bodyText, GUARANTEE_KEYWORDS) +
        countKeywordHits(bodyText, CERTIFICATION_KEYWORDS),
      paymentSignalsCount: countKeywordHits(bodyText, PAYMENT_KEYWORDS),
      returnPolicyDetected:
        RETURN_POLICY_KEYWORDS.some((keyword) => bodyText.toLowerCase().includes(keyword)),
    },
    product: {
      ingredientsDetected: /(ingredients|ingredient|inhaltsstoffe)/i.test(bodyText),
      benefitsDetected: /(benefits|benefit|wirkung|results|result)/i.test(bodyText),
      usageInstructionsDetected: /(how to use|usage|anwendung|routine)/i.test(bodyText),
      productDetailScore: Number(
        Math.max(
          0,
          Math.min(
            1,
            [
              /(ingredients|ingredient|inhaltsstoffe)/i.test(bodyText) ? 1 : 0,
              /(benefits|benefit|wirkung|results|result)/i.test(bodyText) ? 1 : 0,
              /(how to use|usage|anwendung|routine)/i.test(bodyText) ? 1 : 0,
              productKeywordHits >= 8 ? 1 : productKeywordHits >= 4 ? 0.5 : 0,
            ].reduce((sum, value) => sum + value, 0) / 4,
          ),
        ).toFixed(2),
      ),
    },
    text: {
      totalTextLength,
      keywordDensity: wordCount > 0 ? Number((productKeywordHits / wordCount).toFixed(4)) : 0,
      keywordHits: productKeywordHits,
      wordCount,
    },
    pageSignals: {
      notFoundDetected,
      consentOverlayDetected: consentKeywordCount >= 2,
      consentKeywordCount,
      productIntentDetected,
    },
    screenshotsAvailable: false,
  };
}

function mergeEvidence(primary, secondary) {
  const fallback = secondary || buildFallbackEvidence("");
  return {
    structure: {
      title: primary?.structure?.title || fallback.structure.title,
      metaDescription: primary?.structure?.metaDescription || fallback.structure.metaDescription,
      h1: primary?.structure?.h1?.length ? primary.structure.h1 : fallback.structure.h1,
      h2: primary?.structure?.h2?.length ? primary.structure.h2 : fallback.structure.h2,
      h3: primary?.structure?.h3?.length ? primary.structure.h3 : fallback.structure.h3,
      totalTextLength:
        primary?.structure?.totalTextLength || fallback.structure.totalTextLength,
      sectionsCount: primary?.structure?.sectionsCount || fallback.structure.sectionsCount,
    },
    ctas: {
      primaryText: primary?.ctas?.primaryText || fallback.ctas.primaryText,
      ctaCount: Math.max(primary?.ctas?.ctaCount || 0, fallback.ctas.ctaCount || 0),
      aboveTheFold: Boolean(primary?.ctas?.aboveTheFold || fallback.ctas.aboveTheFold),
      all: primary?.ctas?.all?.length ? primary.ctas.all : fallback.ctas.all,
    },
    trust: {
      reviewsCount: Math.max(primary?.trust?.reviewsCount || 0, fallback.trust.reviewsCount || 0),
      trustKeywordsCount: Math.max(
        primary?.trust?.trustKeywordsCount || 0,
        fallback.trust.trustKeywordsCount || 0,
      ),
      paymentSignalsCount: Math.max(
        primary?.trust?.paymentSignalsCount || 0,
        fallback.trust.paymentSignalsCount || 0,
      ),
      returnPolicyDetected: Boolean(
        primary?.trust?.returnPolicyDetected || fallback.trust.returnPolicyDetected,
      ),
    },
    product: {
      ingredientsDetected: Boolean(
        primary?.product?.ingredientsDetected || fallback.product.ingredientsDetected,
      ),
      benefitsDetected: Boolean(
        primary?.product?.benefitsDetected || fallback.product.benefitsDetected,
      ),
      usageInstructionsDetected: Boolean(
        primary?.product?.usageInstructionsDetected ||
          fallback.product.usageInstructionsDetected,
      ),
      productDetailScore: Math.max(
        primary?.product?.productDetailScore || 0,
        fallback.product.productDetailScore || 0,
      ),
    },
    text: {
      totalTextLength: Math.max(
        primary?.text?.totalTextLength || 0,
        fallback.text.totalTextLength || 0,
      ),
      keywordDensity: Math.max(
        primary?.text?.keywordDensity || 0,
        fallback.text.keywordDensity || 0,
      ),
      keywordHits: Math.max(primary?.text?.keywordHits || 0, fallback.text.keywordHits || 0),
      wordCount: Math.max(primary?.text?.wordCount || 0, fallback.text.wordCount || 0),
    },
    pageSignals: {
      notFoundDetected: Boolean(
        primary?.pageSignals?.notFoundDetected || fallback.pageSignals?.notFoundDetected,
      ),
      consentOverlayDetected: Boolean(
        primary?.pageSignals?.consentOverlayDetected ||
          fallback.pageSignals?.consentOverlayDetected,
      ),
      consentKeywordCount: Math.max(
        primary?.pageSignals?.consentKeywordCount || 0,
        fallback.pageSignals?.consentKeywordCount || 0,
      ),
      productIntentDetected: Boolean(
        primary?.pageSignals?.productIntentDetected ||
          fallback.pageSignals?.productIntentDetected,
      ),
    },
    screenshotsAvailable: Boolean(
      primary?.screenshotsAvailable || fallback.screenshotsAvailable,
    ),
  };
}

async function extractPageData(page) {
  return page.evaluate(
    ({
      ctaMatchers,
      reviewKeywords,
      guaranteeKeywords,
      certificationKeywords,
      paymentKeywords,
      returnPolicyKeywords,
      productTerms,
      consentKeywords,
      pageErrorKeywords,
    }) => {
      const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const sanitizeCta = (value) =>
        normalize(value)
          .replace(/\s+[€$£]\s*\d+[.,]?\d*/g, "")
          .replace(/[€$£]\s*\d+[.,]?\d*/g, "")
          .replace(/\b\d+\s*(ml|g|oz|stk|pcs)\b/gi, "")
          .trim();
      const getDescriptor = (element) =>
        [
          element?.id || "",
          typeof element?.className === "string" ? element.className : "",
          element?.getAttribute?.("aria-label") || "",
          element?.getAttribute?.("data-testid") || "",
          element?.getAttribute?.("role") || "",
        ]
          .join(" ")
          .toLowerCase();
      const isNoiseElement = (element) => {
        if (!(element instanceof Element)) {
          return false;
        }
        const descriptor = getDescriptor(element);
        return consentKeywords.some((keyword) => descriptor.includes(keyword));
      };
      const root = document.querySelector("main") || document.body;
      const clonedRoot = root.cloneNode(true);
      Array.from(clonedRoot.querySelectorAll("*")).forEach((node) => {
        if (isNoiseElement(node)) {
          node.remove();
        }
      });
      const lowerIncludes = (text, needles) => {
        const lowered = normalize(text).toLowerCase();
        return needles.some((needle) => lowered.includes(needle));
      };
      const countHits = (text, keywords) => {
        const lowered = String(text || "").toLowerCase();
        return keywords.reduce((count, keyword) => {
          const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const matches = lowered.match(new RegExp(escaped, "g"));
          return count + (matches ? matches.length : 0);
        }, 0);
      };

      const title = normalize(document.title);
      const metaDescription = normalize(
        document.querySelector('meta[name="description"]')?.getAttribute("content") ||
          document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
          "",
      );
      const h1 = Array.from(root.querySelectorAll("h1"))
        .filter((node) => !isNoiseElement(node) && !isNoiseElement(node.parentElement))
        .map((node) => normalize(node.textContent))
        .filter(Boolean)
        .slice(0, 5);
      const h2 = Array.from(root.querySelectorAll("h2"))
        .filter((node) => !isNoiseElement(node) && !isNoiseElement(node.parentElement))
        .map((node) => normalize(node.textContent))
        .filter(Boolean)
        .slice(0, 5);
      const h3 = Array.from(root.querySelectorAll("h3"))
        .filter((node) => !isNoiseElement(node) && !isNoiseElement(node.parentElement))
        .map((node) => normalize(node.textContent))
        .filter(Boolean)
        .slice(0, 5);

      const bodyText = normalize(clonedRoot.textContent || "");
      const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
      const totalTextLength = bodyText.length;
      const sectionsCount = Array.from(root.querySelectorAll("section, article"))
        .filter((node) => !isNoiseElement(node) && !node.closest('[role="dialog"], [aria-modal="true"]'))
        .length;

      const viewportHeight = window.innerHeight || 900;
      const ctaCandidates = Array.from(root.querySelectorAll("button, a"))
        .map((element) => {
          if (
            isNoiseElement(element) ||
            element.closest('[role="dialog"], [aria-modal="true"]') ||
            isNoiseElement(element.parentElement)
          ) {
            return null;
          }
          const text = normalize(
            element.textContent ||
              element.getAttribute("aria-label") ||
              element.getAttribute("value") ||
              "",
          );
          const cleanedText = sanitizeCta(text);
          if (!cleanedText || !lowerIncludes(cleanedText, ctaMatchers)) {
            return null;
          }
          const rect = element.getBoundingClientRect();
          return {
            text: cleanedText,
            top: rect.top,
            bottom: rect.bottom,
            aboveTheFold: rect.top < viewportHeight && rect.bottom > 0,
          };
        })
        .filter(Boolean);

      const sortedCtas = ctaCandidates.sort((a, b) => a.top - b.top);
      const primaryCta =
        sortedCtas.find((item) => item.aboveTheFold) ||
        sortedCtas[0] || {
          text: "",
          aboveTheFold: false,
        };

      const reviewsCount = countHits(bodyText, reviewKeywords);
      const guaranteeCount = countHits(bodyText, guaranteeKeywords);
      const certificationCount = countHits(bodyText, certificationKeywords);
      const paymentSignalsCount = countHits(bodyText, paymentKeywords);
      const returnPolicyDetected = returnPolicyKeywords.some((keyword) =>
        bodyText.toLowerCase().includes(keyword),
      );
      const ingredientsDetected = /(ingredients|ingredient|inhaltsstoffe)/i.test(bodyText);
      const benefitsDetected = /(benefits|benefit|wirkung|results|result)/i.test(bodyText);
      const usageInstructionsDetected = /(how to use|usage|anwendung|routine)/i.test(bodyText);
      const productKeywordHits = countHits(bodyText, productTerms);
      const keywordDensity =
        wordCount > 0 ? Number((productKeywordHits / wordCount).toFixed(4)) : 0;
      const pageSignalSource = [title, metaDescription, ...h1, ...h2, ...h3, bodyText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const consentKeywordCount = countHits(pageSignalSource, consentKeywords);
      const notFoundDetected = pageErrorKeywords.some((keyword) =>
        pageSignalSource.includes(keyword),
      );
      const productIntentDetected =
        productKeywordHits > 0 ||
        sortedCtas.length > 0 ||
        /(product|products|shop|buy|serum|cream|conditioner|shampoo|treatment)/i.test(
          pageSignalSource,
        );
      const productDetailSignals = [
        ingredientsDetected ? 1 : 0,
        benefitsDetected ? 1 : 0,
        usageInstructionsDetected ? 1 : 0,
        productKeywordHits >= 8 ? 1 : productKeywordHits >= 4 ? 0.5 : 0,
      ];
      const productDetailScore = Number(
        Math.max(0, Math.min(1, productDetailSignals.reduce((sum, value) => sum + value, 0) / 4)).toFixed(2),
      );

      return {
        structure: {
          title,
          metaDescription,
          h1,
          h2,
          h3,
          totalTextLength,
          sectionsCount,
        },
        ctas: {
          primaryText: primaryCta.text,
          ctaCount: sortedCtas.length,
          aboveTheFold: Boolean(primaryCta.aboveTheFold),
          all: sortedCtas.map((item) => item.text).slice(0, 10),
        },
        trust: {
          reviewsCount,
          trustKeywordsCount: guaranteeCount + certificationCount,
          paymentSignalsCount,
          returnPolicyDetected,
        },
        product: {
          productDetailScore,
          ingredientsDetected,
          benefitsDetected,
          usageInstructionsDetected,
        },
        text: {
          totalTextLength,
          keywordDensity,
          keywordHits: productKeywordHits,
          wordCount,
        },
        pageSignals: {
          notFoundDetected,
          consentOverlayDetected: consentKeywordCount >= 2,
          consentKeywordCount,
          productIntentDetected,
        },
      };
    },
    {
      ctaMatchers: CTA_MATCHERS,
      reviewKeywords: REVIEW_KEYWORDS,
      guaranteeKeywords: GUARANTEE_KEYWORDS,
      certificationKeywords: CERTIFICATION_KEYWORDS,
      paymentKeywords: PAYMENT_KEYWORDS,
      returnPolicyKeywords: RETURN_POLICY_KEYWORDS,
      productTerms: PRODUCT_TERMS,
      consentKeywords: CONSENT_KEYWORDS,
      pageErrorKeywords: PAGE_ERROR_KEYWORDS,
    },
  );
}

async function collectVisualMetrics(page) {
  return page.evaluate(() => {
    const viewportHeight = window.innerHeight;
    const nodes = Array.from(document.querySelectorAll("body *"));
    const visibleNodes = nodes.filter((node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const style = window.getComputedStyle(node);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity || "1") === 0
      ) {
        return false;
      }
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    const aboveFoldNodes = visibleNodes.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top < viewportHeight && rect.bottom > 0;
    });

    const textNodes = aboveFoldNodes.filter((element) => {
      const text = element.textContent?.trim() || "";
      return text.length >= 20;
    });

    const buttonLike = aboveFoldNodes.filter((element) => {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role") || "";
      return tag === "button" || tag === "a" || role.toLowerCase() === "button";
    });

    const imageLike = aboveFoldNodes.filter((element) => {
      const tag = element.tagName.toLowerCase();
      return tag === "img" || tag === "picture" || tag === "video";
    });

    return {
      aboveFoldTextBlocks: textNodes.length,
      aboveFoldButtons: buttonLike.length,
      aboveFoldImages: imageLike.length,
    };
  });
}

async function handlePageOverlays(page, options = {}) {
  try {
    const { stabilize = false } = options;

    if (stabilize) {
      await page.waitForTimeout(600);
      await page.waitForLoadState("networkidle", { timeout: 1200 }).catch(() => {});
    } else {
      await page.waitForTimeout(180);
    }

    const consentSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept cookies")',
      'button:has-text("Agree")',
      'button:has-text("Got it")',
      'button:has-text("Continue")',
      'button:has-text("Allow all")',
      'button:has-text("Accept all")',
      'button:has-text("Yes")',
      'button:has-text("Ich akzeptiere")',
      'button:has-text("Alle akzeptieren")',
      'button:has-text("Zustimmen")',
      'button:has-text("Weiter")',
      'button:has-text("OK")',
    ];
    for (let pass = 0; pass < 2; pass += 1) {
      const frames = page.frames();
      let clickedSomething = false;
      for (const frame of frames) {
        for (const selector of consentSelectors) {
          const button = frame.locator(selector).first();
          if (await button.isVisible().catch(() => false)) {
            await button.click({ timeout: 900 }).catch(() => {});
            clickedSomething = true;
            await page.waitForTimeout(180);
          }
        }
      }

      const closeSelectors = [
      'button[aria-label="close"]',
      'button[aria-label="Close"]',
      'button:has-text("Close")',
      'button:has-text("No thanks")',
      'button:has-text("Not now")',
      'button:has-text("Maybe later")',
      'button:has-text("Dismiss")',
      'button:has-text("Skip")',
      'button:has-text("Schließen")',
      'button:has-text("Nein danke")',
      'button:has-text("Später")',
      '[data-testid="close"]',
      '[aria-label="Dismiss"]',
      '[aria-label="dismiss"]',
      ];

      for (const frame of frames) {
        for (const selector of closeSelectors) {
          const button = frame.locator(selector).first();
          if (await button.isVisible().catch(() => false)) {
            await button.click({ timeout: 900 }).catch(() => {});
            clickedSomething = true;
            await page.waitForTimeout(180);
          }
        }
      }

      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(clickedSomething ? 120 : 60);
    }

    await page.evaluate(() => {
      const selectors = [
        '[role="dialog"]',
        '[aria-modal="true"]',
        '.modal',
        '.overlay',
        '#overlay',
        '[class*="cookie"]',
        '[id*="cookie"]',
        '[class*="consent"]',
        '[id*="consent"]',
        '[class*="gdpr"]',
        '[id*="gdpr"]',
        '[class*="privacy"]',
        '[id*="privacy"]',
        '[class*="region"]',
        '[id*="region"]',
        '[class*="country"]',
        '[id*="country"]',
        '[class*="newsletter"]',
        '[id*="newsletter"]',
        '[class*="subscribe"]',
        '[id*="subscribe"]',
        '[class*="signup"]',
        '[id*="signup"]',
        '[class*="popup"]',
        '[id*="popup"]',
      ];

      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => el.remove());
      });

      document.documentElement.style.overflow = "auto";
      document.body.style.overflow = "auto";
    });

    console.log("Overlay handling executed");
  } catch (error) {
    console.warn("Overlay handling failed", error);
  }
}

async function forceHideScreenshotOverlays(page) {
  try {
    await page.addStyleTag({
      content: `
        [role="dialog"],
        [aria-modal="true"],
        .modal,
        .overlay,
        #overlay,
        [class*="cookie"],
        [id*="cookie"],
        [class*="consent"],
        [id*="consent"],
        [class*="gdpr"],
        [id*="gdpr"],
        [class*="privacy"],
        [id*="privacy"],
        [class*="region"],
        [id*="region"],
        [class*="country"],
        [id*="country"],
        [class*="newsletter"],
        [id*="newsletter"],
        [class*="subscribe"],
        [id*="subscribe"],
        [class*="signup"],
        [id*="signup"],
        [class*="popup"],
        [id*="popup"],
        iframe[src*="consent"],
        iframe[src*="cookie"],
        iframe[src*="newsletter"],
        iframe[src*="subscribe"],
        iframe[title*="consent"],
        iframe[title*="cookie"],
        iframe[title*="newsletter"],
        iframe[title*="subscribe"] {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          display: none !important;
        }
      `,
    });

    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("body *"));
      nodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }

        const descriptor = [
          node.id || "",
          node.className || "",
          node.getAttribute("aria-label") || "",
          node.getAttribute("role") || "",
        ]
          .join(" ")
          .toLowerCase();
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const isFullscreenLike =
          rect.width >= window.innerWidth * 0.7 &&
          rect.height >= window.innerHeight * 0.18 &&
          (style.position === "fixed" || style.position === "sticky");
        const hasOverlayName =
          /(cookie|consent|gdpr|privacy|region|country|newsletter|subscribe|signup|popup|modal|overlay)/.test(
            descriptor,
          );
        const zIndex = Number.parseInt(style.zIndex || "0", 10);

        if (hasOverlayName || (isFullscreenLike && zIndex >= 20)) {
          node.remove();
        }
      });

      document.documentElement.style.overflow = "auto";
      document.body.style.overflow = "auto";
    });

    console.log("Screenshot overlay hiding executed");
  } catch (error) {
    console.warn("Overlay handling failed", error);
  }
}

async function preparePageForScreenshot(page, label) {
  try {
    await handlePageOverlays(page);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await forceHideScreenshotOverlays(page);
    await page.waitForTimeout(120);
    console.log(`Screenshot overlay pass completed for ${label}`);
  } catch (error) {
    console.warn("Overlay handling failed", error);
  }
}

async function preparePage(page, url, label) {
  await page.setExtraHTTPHeaders({
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  console.log(`Navigating ${label} page`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (error) {
    console.error(`${label.toUpperCase()}_GOTO_ERROR:`, error.message);
    await page.goto(url, { waitUntil: "load", timeout: 15000 });
  }

  await handlePageOverlays(page, { stabilize: true });
  await page.waitForTimeout(250);
  await page.waitForTimeout(PAGE_SETTLE_MS);
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}

async function captureAndExtract(url, warnings, language) {
  const i18n = getLanguagePack(language);
  let browser = null;
  let desktopPage = null;
  let mobilePage = null;
  let htmlFallbackEvidence = buildFallbackEvidence(url);
  let extractedEvidence = buildFallbackEvidence(url);
  const screenshotUrls = {
    desktop: null,
    mobile: null,
  };
  const visualMetrics = {
    desktop: null,
    mobile: null,
  };

  try {
    const html = await fetchPageHtml(url);
    htmlFallbackEvidence = buildEvidenceFromHtml(html, url);
  } catch (error) {
    console.error("HTML extraction fallback failed", error.message);
  }

  try {
    console.log("Launching browser");
    browser = await chromium.launch({ headless: true });

    desktopPage = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    await preparePage(desktopPage, url, "desktop");
    extractedEvidence = mergeEvidence(await extractPageData(desktopPage), htmlFallbackEvidence);
    visualMetrics.desktop = await collectVisualMetrics(desktopPage);

    try {
      await preparePageForScreenshot(desktopPage, "desktop");
      const desktopBuffer = await desktopPage.screenshot({
        type: "png",
        fullPage: false,
        animations: "disabled",
      });
      screenshotUrls.desktop = bufferToDataUrl(desktopBuffer);
      console.log("Desktop screenshot captured");
    } catch (error) {
      console.error("Desktop screenshot failed", error.message);
    }

    mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
    });
    await preparePage(mobilePage, url, "mobile");
    visualMetrics.mobile = await collectVisualMetrics(mobilePage);

    try {
      await preparePageForScreenshot(mobilePage, "mobile");
      const mobileBuffer = await mobilePage.screenshot({
        type: "png",
        fullPage: false,
        animations: "disabled",
      });
      screenshotUrls.mobile = bufferToDataUrl(mobileBuffer);
      console.log("Mobile screenshot captured");
    } catch (error) {
      console.error("Mobile screenshot failed", error.message);
    }

    if (!screenshotUrls.desktop && !screenshotUrls.mobile) {
      warnings.push(i18n.screenshotWarning);
    }

    return {
      evidence: {
        ...extractedEvidence,
        screenshotsAvailable: Boolean(screenshotUrls.desktop || screenshotUrls.mobile),
        visual: {
          desktop: visualMetrics.desktop,
          mobile: visualMetrics.mobile,
        },
      },
      screenshotUrls,
      visualMetrics,
    };
  } catch (error) {
    console.error("Screenshot failed", error.message);
    warnings.push(i18n.screenshotWarning);
    return {
      evidence: mergeEvidence(extractedEvidence, htmlFallbackEvidence),
      screenshotUrls,
      visualMetrics,
    };
  } finally {
    await desktopPage?.close().catch(() => {});
    await mobilePage?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

function isWeakEvidence(evidence) {
  if (evidence.pageSignals?.notFoundDetected) {
    return true;
  }
  const noTrustSignals =
    evidence.trust.reviewsCount === 0 &&
    evidence.trust.trustKeywordsCount === 0 &&
    evidence.trust.paymentSignalsCount === 0;
  const lowText = evidence.text.totalTextLength < 1500;
  const weakCta = !evidence.ctas.primaryText || evidence.ctas.ctaCount <= 1 || !evidence.ctas.aboveTheFold;

  return noTrustSignals && lowText && weakCta;
}

function isStrongEvidence(evidence) {
  if (evidence.pageSignals?.notFoundDetected) {
    return false;
  }
  const strongTrust =
    evidence.trust.reviewsCount >= 2 ||
    evidence.trust.trustKeywordsCount >= 3 ||
    evidence.trust.paymentSignalsCount >= 2;
  const strongStructure =
    evidence.structure.sectionsCount >= 4 &&
    evidence.structure.h1.length >= 1 &&
    evidence.structure.h2.length >= 2 &&
    evidence.text.totalTextLength >= 2500;
  const strongCta =
    Boolean(evidence.ctas.primaryText) &&
    evidence.ctas.ctaCount >= 2 &&
    evidence.ctas.aboveTheFold;

  return strongTrust && strongStructure && strongCta;
}

function buildDimensionScores(evidence) {
  const errorPenalty = evidence.pageSignals?.notFoundDetected ? 4 : 0;
  const consentPenalty =
    evidence.pageSignals?.consentOverlayDetected && !evidence.product.productDetailScore ? 1.5 : 0;
  const trustSignalWeight =
    evidence.trust.reviewsCount * 1.3 +
    evidence.trust.trustKeywordsCount * 1.1 +
    evidence.trust.paymentSignalsCount * 1 +
    (evidence.trust.returnPolicyDetected ? 1.5 : 0);
  const structureWeight =
    evidence.structure.h1.length * 1.2 +
    evidence.structure.h2.length * 0.9 +
    evidence.structure.h3.length * 0.4 +
    Math.min(evidence.structure.sectionsCount, 8) * 0.45 +
    (evidence.structure.metaDescription ? 1 : 0) +
    (evidence.structure.totalTextLength >= 2200 ? 1 : 0);
  const ctaWeight =
    (evidence.ctas.primaryText ? 2.5 : 0) +
    Math.min(evidence.ctas.ctaCount, 5) * 0.6 +
    (evidence.ctas.aboveTheFold ? 2 : 0);
  const productWeight =
    evidence.product.productDetailScore * 6 +
    (evidence.product.ingredientsDetected ? 1 : 0) +
    (evidence.product.benefitsDetected ? 1 : 0) +
    (evidence.product.usageInstructionsDetected ? 1 : 0);
  const textWeight =
    Math.min(evidence.text.totalTextLength / 900, 4) +
    Math.min(evidence.text.keywordHits / 4, 3) +
    Math.min(evidence.text.keywordDensity * 120, 2);
  const screenshotWeight = evidence.screenshotsAvailable ? 1.2 : -1.2;

  let trust = clampScore(1 + (trustSignalWeight - errorPenalty - consentPenalty) / 1.6, 2);
  let clarity = clampScore(
    1 + (structureWeight + productWeight + ctaWeight * 0.5 - errorPenalty - consentPenalty) / 2.2,
    2,
  );
  let friction = clampScore(
    1 +
      (ctaWeight +
        (evidence.trust.returnPolicyDetected ? 1.5 : 0) +
        evidence.trust.paymentSignalsCount * 0.7 -
        errorPenalty -
        consentPenalty) /
        1.8,
    2,
  );
  let mobile = clampScore(
    1 +
      ((evidence.ctas.aboveTheFold ? 2 : 0) +
        Math.min(evidence.structure.h1.length + evidence.structure.h2.length, 4) +
        (evidence.screenshotsAvailable ? 2 : 0) -
        errorPenalty) /
        1.5,
    2,
  );
  let visualQuality = clampScore(
    1 +
      ((evidence.screenshotsAvailable ? 3 : 0) +
        (evidence.ctas.aboveTheFold ? 2 : 0) +
        Math.min(evidence.structure.sectionsCount, 6) * 0.4 -
        errorPenalty -
        consentPenalty) /
        1.4,
    2,
  );
  let brandMaturity = clampScore(
    1 +
      (trustSignalWeight +
        structureWeight +
        productWeight +
        textWeight +
        screenshotWeight -
        errorPenalty * 1.5 -
        consentPenalty) /
        3.2,
    2,
  );

  if (isWeakEvidence(evidence)) {
    trust = Math.min(trust, 3);
    clarity = Math.min(clarity, 3);
    friction = Math.min(friction, 3);
    mobile = Math.min(mobile, 3);
    visualQuality = Math.min(visualQuality, 3);
    brandMaturity = Math.min(brandMaturity, 3);
  }

  if (isStrongEvidence(evidence)) {
    trust = Math.max(trust, 8);
    clarity = Math.max(clarity, 8);
    friction = Math.max(friction, 8);
    mobile = Math.max(mobile, 7);
    visualQuality = Math.max(visualQuality, evidence.screenshotsAvailable ? 8 : 7);
    brandMaturity = Math.max(brandMaturity, 8);
  }

  return {
    trust,
    clarity,
    friction,
    mobile,
    visualQuality,
    brandMaturity,
  };
}

function buildFrontendScores(dimensionScores) {
  return {
    aboveTheFold: clampScore(
      safeAverage([dimensionScores.clarity, dimensionScores.visualQuality, dimensionScores.mobile]),
      4,
    ),
    valueProposition: clampScore(
      safeAverage([dimensionScores.clarity, dimensionScores.brandMaturity]),
      4,
    ),
    emotionalHook: clampScore(
      safeAverage([dimensionScores.brandMaturity, dimensionScores.visualQuality]),
      4,
    ),
    cta: clampScore(safeAverage([dimensionScores.friction, dimensionScores.clarity]), 4),
    trustSignals: clampScore(dimensionScores.trust, 4),
    informationHierarchy: clampScore(
      safeAverage([dimensionScores.clarity, dimensionScores.visualQuality]),
      4,
    ),
    conversionFriction: clampScore(dimensionScores.friction, 4),
    differentiation: clampScore(
      safeAverage([dimensionScores.brandMaturity, dimensionScores.clarity]),
      4,
    ),
    brandVoice: clampScore(dimensionScores.brandMaturity, 4),
  };
}

function buildConfidence(evidence, isEvidenceWeak) {
  if (evidence.pageSignals?.notFoundDetected) {
    return "low";
  }

  const confidenceBase =
    evidence.structure.totalTextLength >= 2500 ? 1 : evidence.structure.totalTextLength >= 1400 ? 0.6 : 0.2;
  const trustBase =
    evidence.trust.reviewsCount +
    evidence.trust.trustKeywordsCount +
    evidence.trust.paymentSignalsCount;
  const signalBase =
    confidenceBase +
    Math.min(trustBase / 4, 1) +
    (evidence.ctas.primaryText ? 0.5 : 0) +
    (evidence.screenshotsAvailable ? 0.7 : -0.2) +
    evidence.product.productDetailScore -
    (evidence.pageSignals?.consentOverlayDetected ? 0.35 : 0);

  if (isEvidenceWeak || signalBase < 1.3) {
    return "low";
  }

  if (signalBase < 2.4) {
    return "medium";
  }

  return "high";
}

function detectPrimaryProblem(evidence, scores) {
  const aboveTheFoldWeak =
    evidence.pageSignals?.notFoundDetected ||
    clampScore(Math.min(scores?.valueProposition ?? 10, scores?.aboveTheFold ?? 10), 10) <= 6 ||
    evidence.structure.h1.length === 0 ||
    !evidence.ctas.aboveTheFold;

  if (aboveTheFoldWeak) {
    return "VALUE_PROPOSITION";
  }

  const primaryCta = sanitizeCtaText(evidence.ctas.primaryText);
  const ctaWeak =
    !primaryCta ||
    isGenericCta(primaryCta, "en") ||
    isGenericCta(primaryCta, "de") ||
    clampScore(scores?.cta ?? 10, 10) <= 6;

  if (ctaWeak) {
    return "CTA";
  }

  const trustWeak =
    evidence.trust.reviewsCount === 0 &&
    evidence.trust.trustKeywordsCount === 0 &&
    evidence.trust.paymentSignalsCount === 0;

  if (trustWeak || clampScore(scores?.trustSignals ?? 10, 10) <= 6) {
    return "TRUST";
  }

  const mobileWeak =
    evidence.screenshotsAvailable &&
    clampScore(scores?.informationHierarchy ?? 10, 10) <= 5 &&
    clampScore(scores?.aboveTheFold ?? 10, 10) <= 7;

  if (mobileWeak) {
    return "MOBILE";
  }

  return "FRICTION";
}

function estimateRevenueImpact({ revenueRange, trafficSource, primaryProblem, language }) {
  const revenueMidpoints = {
    "<50k": 30000,
    "50k-200k": 100000,
    "200k-1M": 500000,
    ">1M": 1200000,
    unknown: null,
  };
  const problemWeights = {
    VALUE_PROPOSITION: 0.35,
    CTA: 0.25,
    TRUST: 0.25,
    FRICTION: 0.15,
    MOBILE: 0.2,
    UNKNOWN: 0.15,
  };
  const trafficModifiers = {
    paid: 1.3,
    social: 1.2,
    organic: 1.0,
    direct: 0.9,
    mixed: 1.0,
    unknown: 0.8,
  };
  const monthlyRevenue = revenueMidpoints[revenueRange] ?? null;
  const safeTrafficSource = trafficModifiers[trafficSource] ? trafficSource : "unknown";
  const safeProblem = problemWeights[primaryProblem] ? primaryProblem : "UNKNOWN";

  if (!monthlyRevenue) {
    return {
      monthlyImpactLow: null,
      monthlyImpactHigh: null,
      currency: "EUR",
      confidence: "low",
      explanation:
        language === "de"
          ? "F\u00fcr eine belastbare Umsatzsch\u00e4tzung fehlt der Monatsumsatz."
          : "A reliable revenue estimate requires monthly revenue context.",
    };
  }

  const monthlyImpact =
    monthlyRevenue * 0.12 * problemWeights[safeProblem] * trafficModifiers[safeTrafficSource];
  const monthlyImpactLow = Math.round(monthlyImpact * 0.7);
  const monthlyImpactHigh = Math.round(monthlyImpact * 1.3);
  const problemLabels =
    language === "de"
      ? {
          VALUE_PROPOSITION: "Wertversprechen",
          CTA: "CTA-Klarheit",
          TRUST: "Vertrauen",
          FRICTION: "Reibung",
          MOBILE: "Mobile Experience",
          UNKNOWN: "allgemeiner CRO-Hebel",
        }
      : {
          VALUE_PROPOSITION: "value proposition",
          CTA: "CTA clarity",
          TRUST: "trust",
          FRICTION: "friction",
          MOBILE: "mobile experience",
          UNKNOWN: "general CRO lever",
        };
  const explanation =
    language === "de"
      ? `Gesch\u00e4tztes monatliches Potenzial: ca. ${monthlyImpactLow.toLocaleString("de-DE")} bis ${monthlyImpactHigh.toLocaleString("de-DE")} EUR, basierend auf typischen CRO-Hebeln, einem konservativen Uplift-Potenzial von 12 % des Monatsumsatzes, dem Schwerpunkt ${problemLabels[safeProblem]} und dem Traffic-Mix ${safeTrafficSource}.`
      : `Estimated monthly upside: about ${monthlyImpactLow.toLocaleString("en-US")} to ${monthlyImpactHigh.toLocaleString("en-US")} EUR, based on typical CRO levers, a conservative 12% uplift assumption, the primary issue ${problemLabels[safeProblem]}, and the traffic mix ${safeTrafficSource}.`;

  return {
    monthlyImpactLow,
    monthlyImpactHigh,
    currency: "EUR",
    confidence: safeTrafficSource === "unknown" ? "low" : "medium",
    explanation,
  };
}

function buildImpactHeadline(impactEstimate, language) {
  if (
    typeof impactEstimate?.monthlyImpactLow === "number" &&
    typeof impactEstimate?.monthlyImpactHigh === "number"
  ) {
    const locale = language === "de" ? "de-DE" : "en-US";
    const range = `${impactEstimate.monthlyImpactLow.toLocaleString(locale)}-${impactEstimate.monthlyImpactHigh.toLocaleString(locale)} EUR`;
    return language === "de"
      ? `Geschätztes Umsatzpotenzial: ${range} / Monat`
      : `Estimated revenue opportunity: ${range} / month`;
  }

  return language === "de"
    ? "Umsatzpotenzial berechenbar nach Eingabe des Monatsumsatzes"
    : "Revenue opportunity available after monthly revenue input";
}

function buildPrimaryDecisionConfidence(evidence) {
  if (!evidence.screenshotsAvailable) {
    return "low";
  }

  if (isStrongEvidence(evidence)) {
    return "high";
  }

  return isWeakEvidence(evidence) ? "low" : "medium";
}

function buildDecisionSuggestedCopy(type, evidence, language) {
  if (!["CTA", "MOBILE"].includes(type)) {
    return null;
  }

  const originalCta = sanitizeCtaText(evidence.ctas.primaryText);
  const suggested = sanitizeCtaText(buildEvidenceDrivenCta(evidence, language));

  if (!suggested) {
    return null;
  }

  if (originalCta && suggested.toLowerCase() === originalCta.toLowerCase()) {
    return null;
  }

  if (isGenericCta(suggested, language)) {
    return null;
  }

  return suggested;
}

function buildDomOnlyEvidenceNote(language) {
  return language === "de"
    ? "Screenshots fehlen, daher ist dieser Punkt nur aus DOM/Text ableitbar."
    : "Screenshots are missing, so this point is derived from DOM/text only.";
}

function selectPrimaryDecision({ evidence, scores, impactEstimate, language }) {
  const type = detectPrimaryProblem(evidence, scores);
  const confidence = buildPrimaryDecisionConfidence(evidence);
  const productType = inferProductType(evidence, language);
  const originalCta = sanitizeCtaText(evidence.ctas.primaryText);
  const suggestedCopy = buildDecisionSuggestedCopy(type, evidence, language);
  const evidencePoints = [];

  const addEvidence = (value) => {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
      return;
    }
    if (!evidencePoints.includes(normalized)) {
      evidencePoints.push(normalized);
    }
  };

  if (type === "VALUE_PROPOSITION") {
    addEvidence(
      language === "de"
        ? evidence.structure.h1.length === 0
          ? "Es wurde keine klare H1-Headline mit erkennbarem Produktnutzen erkannt."
          : `Es wurde ${evidence.structure.h1.length} H1-Headline erkannt, aber das Nutzenversprechen bleibt im ersten Screen schwach.`
        : evidence.structure.h1.length === 0
          ? "No clear H1 headline with an obvious product payoff was detected."
          : `${evidence.structure.h1.length} H1 headline was detected, but the value proposition stays weak in the first screen.`
    );
    addEvidence(
      language === "de"
        ? evidence.ctas.aboveTheFold
          ? `Oberhalb des ersten Scrolls wurde ein CTA erkannt, aber er ist noch nicht eng genug mit einem klaren Ergebnis verknüpft.`
          : "Oberhalb des ersten Scrolls wurde keine klare Handlungsführung als nächster Schritt erkannt."
        : evidence.ctas.aboveTheFold
          ? "A CTA was detected above the first scroll, but it is not tightly connected to a clear outcome."
          : "No clear next-step guidance was detected above the first scroll."
    );
    addEvidence(
      language === "de"
        ? `Die Seite liefert ${evidence.text.totalTextLength} Zeichen Text und eine Produkttiefe von ${evidence.product.productDetailScore}, aber der Kernnutzen verdichtet sich nicht früh genug.`
        : `The page provides ${evidence.text.totalTextLength} characters of text and a product depth score of ${evidence.product.productDetailScore}, but the core payoff does not condense early enough.`
    );
  } else if (type === "CTA") {
    addEvidence(
      language === "de"
        ? originalCta
          ? `Der primäre CTA lautet nur "${originalCta}" und erklärt keinen konkreten nächsten Nutzen.`
          : "Es wurde kein belastbarer primärer CTA als nächster Schritt erkannt."
        : originalCta
          ? `The primary CTA is only "${originalCta}" and does not explain a concrete next payoff.`
          : "No reliable primary CTA was detected as the next step."
    );
    addEvidence(
      language === "de"
        ? `Insgesamt wurden ${evidence.ctas.ctaCount} CTA-Signale erkannt, was die Handlungsführung aktuell zu dünn macht.`
        : `${evidence.ctas.ctaCount} CTA signals were detected overall, which makes the action path too thin right now.`
    );
    addEvidence(
      language === "de"
        ? evidence.ctas.aboveTheFold
          ? "Der CTA ist oberhalb des ersten Scrolls technisch vorhanden, wirkt aber noch zu generisch."
          : "Der CTA ist nicht klar genug oberhalb des ersten Scrolls verankert."
        : evidence.ctas.aboveTheFold
          ? "The CTA is technically present above the first scroll, but it still reads as too generic."
          : "The CTA is not clearly anchored above the first scroll."
    );
  } else if (type === "TRUST") {
    addEvidence(
      language === "de"
        ? `Es wurden nur ${evidence.trust.reviewsCount} Bewertungs-Signale, ${evidence.trust.trustKeywordsCount} weitere Vertrauens-Treffer und ${evidence.trust.paymentSignalsCount} Zahlungs-Signale erkannt.`
        : `Only ${evidence.trust.reviewsCount} review signals, ${evidence.trust.trustKeywordsCount} additional trust hits, and ${evidence.trust.paymentSignalsCount} payment signals were detected.`
    );
    addEvidence(
      language === "de"
        ? evidence.trust.returnPolicyDetected
          ? "Rückgabe-Hinweise sind zwar vorhanden, tragen den Kaufmoment aber noch nicht stark genug."
          : "Es wurde kein klarer Rückgabe- oder Risikoabbau direkt für den Kaufmoment erkannt."
        : evidence.trust.returnPolicyDetected
          ? "Return-policy cues are present, but they are not carrying the purchase moment strongly enough."
          : "No clear return or risk-reduction cue was detected around the purchase moment."
    );
    addEvidence(
      language === "de"
        ? "Ohne belastbare Vertrauenssignale am Kaufmoment bleibt die Kaufentscheidung unnötig offen."
        : "Without strong trust cues near the purchase moment, the buying decision stays unnecessarily open."
    );
  } else if (type === "MOBILE") {
    addEvidence(
      language === "de"
        ? "Die mobile Bewertung ist schwächer als die strukturelle Gesamtleistung der Seite."
        : "The mobile score is weaker than the page's overall structural performance."
    );
    addEvidence(
      language === "de"
        ? `Es wurden ${evidence.structure.h2.length} H2-Signale und ${evidence.ctas.ctaCount} CTA-Signale erkannt, aber die Argumente verdichten sich mobil nicht früh genug.`
        : `${evidence.structure.h2.length} H2 signals and ${evidence.ctas.ctaCount} CTA signals were detected, but the arguments do not compress early enough on mobile.`
    );
    addEvidence(
      language === "de"
        ? "Die mobile Priorisierung braucht weniger Streuung und früheren Kaufkontext vor dem ersten Scroll."
        : "Mobile prioritization needs less spread and earlier buying context before the first scroll."
    );
  } else {
    addEvidence(
      language === "de"
        ? `Es wurden ${evidence.ctas.ctaCount} CTA-Signale, ${evidence.trust.paymentSignalsCount} Zahlungs-Signale und ${evidence.trust.reviewsCount} Bewertungs-Signale erkannt, aber der Kaufmoment bleibt noch zu offen.`
        : `${evidence.ctas.ctaCount} CTA signals, ${evidence.trust.paymentSignalsCount} payment signals, and ${evidence.trust.reviewsCount} review signals were detected, but the purchase moment still stays too open.`
    );
    addEvidence(
      language === "de"
        ? evidence.trust.returnPolicyDetected
          ? "Rückgabe-Hinweise sind vorhanden, aber Preis, CTA und Absicherung greifen noch nicht eng genug ineinander."
          : "Preis, CTA und Absicherung greifen noch nicht eng genug ineinander."
        : evidence.trust.returnPolicyDetected
          ? "Return cues are present, but price, CTA, and reassurance are not yet working tightly enough together."
          : "Price, CTA, and reassurance are not yet working tightly enough together."
    );
    addEvidence(
      language === "de"
        ? `Die Seite liefert ${evidence.structure.sectionsCount} Sektionen, wodurch der Weg zur Entscheidung erklärend statt entschlossen wirkt.`
        : `The page uses ${evidence.structure.sectionsCount} sections, so the path to conversion feels explanatory rather than decisive.`
    );
  }

  if (!evidence.screenshotsAvailable) {
    addEvidence(buildDomOnlyEvidenceNote(language));
  }

  const evidenceList = evidencePoints.slice(0, 3);
  while (evidenceList.length < 2) {
    evidenceList.push(buildDomOnlyEvidenceNote(language));
  }

  const contentByType =
    language === "de"
      ? {
          VALUE_PROPOSITION: {
            title: "Der erste Screen erklärt den Produktnutzen nicht klar genug",
            problem:
              "Die Seite zeigt zwar Produktkontext, aber der konkrete Nutzen verdichtet sich im ersten Screen noch nicht stark genug für kalten Traffic.",
            action:
              "Verdichte Headline, erste Supporting-Zeilen und CTA auf ein klares Ergebnis, damit der Nutzen vor Details und Navigation steht.",
            expectedOutcome:
              "Mehr Besucher verstehen schneller, warum dieses Produkt relevant ist, und gehen mit höherer Kaufabsicht weiter.",
          },
          CTA: {
            title: "Der CTA ist sichtbar, aber nicht handlungsstark genug",
            problem:
              "Der nächste Schritt ist aktuell zu generisch formuliert oder nicht klar genug als Nutzenversprechen lesbar.",
            action:
              "Formuliere den primären CTA ergebnisorientierter und platziere ihn enger an den direkt spürbaren Nutzen des Produkts.",
            expectedOutcome:
              "Mehr Nutzer erkennen schneller, was der Klick bringt, und brechen seltener vor dem nächsten Schritt ab.",
          },
          TRUST: {
            title: "Vertrauen fehlt direkt am Kaufmoment",
            problem:
              "Die Seite liefert zu wenig belastbare Sicherheits- und Proof-Signale genau dort, wo Nutzer den Kauf absichern wollen.",
            action:
              "Ziehe Reviews, Garantien, Rückgabe- und Zahlungs-Hinweise dichter an Preis und primäre CTA, statt sie später oder diffuser zu zeigen.",
            expectedOutcome:
              "Die Kaufentscheidung wirkt weniger riskant, wodurch mehr Nutzer mit bestehendem Interesse tatsächlich weitergehen.",
          },
          MOBILE: {
            title: "Mobile Nutzer sehen zu wenig Kaufargumente vor dem ersten Scroll",
            problem:
              "Mobil verdichten sich Nutzen, Proof und Handlungsführung nicht früh genug, obwohl diese Signale für schnelle Entscheidungen zentral sind.",
            action:
              "Straffe den mobilen ersten Screen, priorisiere Nutzen vor Nebensignalen und bringe CTA plus Vertrauenskontext früher in die Reihenfolge.",
            expectedOutcome:
              "Mobile Nutzer bekommen früher genug Kaufkontext, wodurch der erste Scroll seltener zum Abbruchpunkt wird.",
          },
          FRICTION: {
            title: "Der Kaufmoment lässt noch zu viele offene Fragen zu",
            problem:
              "Der Weg vom Interesse zur Entscheidung ist noch nicht entschlossen genug geführt und überlässt dem Nutzer zu viel Interpretationsarbeit.",
            action:
              "Bringe CTA, Risikoabbau und letzte Kaufargumente enger zusammen, damit der Abschluss wie der logische nächste Schritt wirkt.",
            expectedOutcome:
              "Mehr Nutzer erreichen den Kaufmoment mit weniger Unsicherheit und weniger Reibung vor dem Abschluss.",
          },
        }
      : {
          VALUE_PROPOSITION: {
            title: "The first screen does not explain the product payoff clearly enough",
            problem:
              "The page shows product context, but the concrete payoff still does not compress strongly enough in the first screen for cold traffic.",
            action:
              "Tighten the headline, first supporting lines, and CTA around one clear outcome so the value lands before details and navigation.",
            expectedOutcome:
              "More visitors will understand faster why this product matters and move forward with stronger buying intent.",
          },
          CTA: {
            title: "The CTA is visible, but it is not action-strong enough",
            problem:
              "The next step is still phrased too generically or does not read clearly enough as a concrete shopper payoff.",
            action:
              "Rewrite the primary CTA around a clearer outcome and place it closer to the most immediate product benefit.",
            expectedOutcome:
              "More users will understand what the click gives them and drop off less before the next step.",
          },
          TRUST: {
            title: "Trust is missing right at the buying moment",
            problem:
              "The page gives too little proof and reassurance exactly where shoppers want to de-risk the purchase.",
            action:
              "Pull reviews, guarantees, return cues, and payment reassurance closer to price and the primary CTA instead of leaving them later or more diffuse.",
            expectedOutcome:
              "The purchase feels less risky, so more already-interested users continue instead of hesitating.",
          },
          MOBILE: {
            title: "Mobile users see too few buying arguments before the first scroll",
            problem:
              "On mobile, value, proof, and action guidance do not compress early enough even though those signals drive faster decisions.",
            action:
              "Tighten the mobile first screen, prioritize value before secondary signals, and move CTA plus reassurance earlier in the sequence.",
            expectedOutcome:
              "Mobile visitors get enough buying context earlier, so the first scroll becomes less of a drop-off point.",
          },
          FRICTION: {
            title: "The buying moment still leaves too many open questions",
            problem:
              "The path from interest to decision is not yet guided decisively enough and leaves too much interpretation work to the shopper.",
            action:
              "Bring the CTA, risk reduction, and final buying arguments closer together so the next step feels like the logical conclusion.",
            expectedOutcome:
              "More shoppers reach the purchase moment with less uncertainty and less friction before conversion.",
          },
        };

  return {
    type,
    title: contentByType[type].title,
    impactHeadline: buildImpactHeadline(impactEstimate, language),
    problem: contentByType[type].problem,
    evidence: evidenceList,
    action: contentByType[type].action,
    suggestedCopy,
    expectedOutcome: contentByType[type].expectedOutcome,
    confidence,
  };
}

function buildDomOnlyVisualFindings(evidence, scores, language) {
  return language === "de"
    ? [
        {
          title: "DOM/Text-Basis",
          observation: "Screenshots fehlen. Diese Bewertung ist nur aus DOM/Text ableitbar.",
          impact: "MEDIUM",
        },
        {
          title: "CTA-Struktur",
          observation: `Es wurden ${evidence.ctas.ctaCount} CTA-Signale erkannt; der Klarheitswert für den ersten Screen liegt bei ${clampScore(scores?.aboveTheFold ?? 0)}/10.`,
          impact: clampScore(scores?.cta ?? 0) <= 6 ? "HIGH" : "MEDIUM",
        },
        {
          title: "Vertrauenslage",
          observation: `Es wurden ${evidence.trust.reviewsCount} Bewertungs-Signale, ${evidence.trust.trustKeywordsCount} weitere Vertrauens-Treffer und ${evidence.trust.paymentSignalsCount} Zahlungs-Signale erfasst.`,
          impact: clampScore(scores?.trustSignals ?? 0) <= 6 ? "HIGH" : "MEDIUM",
        },
      ]
    : [
        {
          title: "DOM/text basis",
          observation: "Screenshots are missing. This rating is derived from DOM/text only.",
          impact: "MEDIUM",
        },
        {
          title: "CTA structure",
          observation: `${evidence.ctas.ctaCount} CTA signals were detected; the first-screen clarity score is ${clampScore(scores?.aboveTheFold ?? 0)}/10.`,
          impact: clampScore(scores?.cta ?? 0) <= 6 ? "HIGH" : "MEDIUM",
        },
        {
          title: "Trust baseline",
          observation: `${evidence.trust.reviewsCount} review signals, ${evidence.trust.trustKeywordsCount} additional trust hits, and ${evidence.trust.paymentSignalsCount} payment signals were captured.`,
          impact: clampScore(scores?.trustSignals ?? 0) <= 6 ? "HIGH" : "MEDIUM",
        },
      ];
}

function sanitizeConversionFlowForEvidence(flow, fallbackFlow, evidence) {
  const sanitized = {};
  for (const key of ["entry", "firstScreen", "interest", "trust", "decision"]) {
    const value = normalizeWhitespace(flow?.[key]);
    const hasBlockedPhrase = /not visible|nicht sichtbar/i.test(value);
    sanitized[key] = !value || (hasBlockedPhrase && !evidence.screenshotsAvailable)
      ? fallbackFlow[key]
      : value;
  }
  return sanitized;
}

function buildEvidenceSummary(evidence, confidence, language) {
  const trustTotal =
    evidence.trust.reviewsCount +
    evidence.trust.trustKeywordsCount +
    evidence.trust.paymentSignalsCount;

  if (language === "de") {
    return `Die Auswertung basiert auf ${evidence.structure.h1.length + evidence.structure.h2.length + evidence.structure.h3.length} Überschriften, ${evidence.ctas.ctaCount} CTA-Signalen, ${trustTotal} Trust-Signalen und ${evidence.text.totalTextLength} Zeichen Fließtext. Confidence: ${confidence}.`;
  }

  return `This evaluation is grounded in ${evidence.structure.h1.length + evidence.structure.h2.length + evidence.structure.h3.length} headings, ${evidence.ctas.ctaCount} CTA signals, ${trustTotal} trust signals, and ${evidence.text.totalTextLength} characters of body text. Confidence: ${confidence}.`;
}

function buildEvidenceSummaryV2(evidence, confidence, language) {
  const trustTotal =
    evidence.trust.reviewsCount +
    evidence.trust.trustKeywordsCount +
    evidence.trust.paymentSignalsCount;
  const statusSuffix = evidence.pageSignals?.notFoundDetected
    ? language === "de"
      ? " Die extrahierte Seite wirkt wie eine Fehler- oder Missing-Page."
      : " The extracted page appears to be an error or missing page."
    : evidence.pageSignals?.consentOverlayDetected
      ? language === "de"
        ? " Consent- oder Privacy-Inhalte wurden als Störsignal erkannt."
        : " Consent or privacy overlay content was detected as noise."
      : "";

  if (language === "de") {
    return `Die Auswertung basiert auf ${evidence.structure.h1.length + evidence.structure.h2.length + evidence.structure.h3.length} Überschriften, ${evidence.ctas.ctaCount} CTA-Signalen und ${trustTotal} Vertrauenssignalen bei ${evidence.text.totalTextLength} Zeichen Fließtext. Konfidenz: ${confidence}.${statusSuffix}`;
  }

  return `This evaluation is grounded in ${evidence.structure.h1.length + evidence.structure.h2.length + evidence.structure.h3.length} headings, ${evidence.ctas.ctaCount} CTA signals, and ${trustTotal} trust signals across ${evidence.text.totalTextLength} characters of body text. Confidence: ${confidence}.${statusSuffix}`;
}

function inferProductType(evidence, language) {
  const source = [
    evidence.structure.title,
    ...evidence.structure.h1,
    ...evidence.structure.h2,
    ...evidence.structure.h3,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const catalog = [
    {
      match: /(leave[- ]?in|leave in)/i,
      de: "Leave-in",
      en: "leave-in",
    },
    {
      match: /(conditioner)/i,
      de: "Conditioner",
      en: "conditioner",
    },
    {
      match: /(cleanser|wash)/i,
      de: "Cleanser",
      en: "cleanser",
    },
    {
      match: /(serum)/i,
      de: "Serum",
      en: "serum",
    },
    {
      match: /(cream|moisturizer|moisturiser)/i,
      de: "Creme",
      en: "cream",
    },
    {
      match: /(shampoo)/i,
      de: "Shampoo",
      en: "shampoo",
    },
    {
      match: /(mask|masque)/i,
      de: "Maske",
      en: "mask",
    },
    {
      match: /(exfoliant|acid|bha|aha|peel)/i,
      de: "Exfoliant",
      en: "exfoliant",
    },
  ];

  const found = catalog.find((item) => item.match.test(source));
  if (!found) {
    return language === "de" ? "Produkt" : "product";
  }

  return language === "de" ? found.de : found.en;
}

function inferOutcomePhrase(evidence, language) {
  const source = [
    evidence.structure.title,
    ...evidence.structure.h1,
    ...evidence.structure.h2,
    ...evidence.structure.h3,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const mappings = [
    { match: /(frizz|smooth|sleek)/i, de: "Frizz reduzieren", en: "reduce frizz" },
    { match: /(glow|radiance|bright)/i, de: "mehr Glow erzielen", en: "boost glow" },
    {
      match: /(hydrate|hydration|moisture|plump)/i,
      de: "mehr Feuchtigkeit aufbauen",
      en: "boost hydration",
    },
    {
      match: /(clean|cleanser|wash)/i,
      de: "sanft reinigen",
      en: "cleanse gently",
    },
    {
      match: /(firm|peptide|repair|barrier)/i,
      de: "die Hautbarriere stärken",
      en: "support the skin barrier",
    },
    {
      match: /(exfoliat|bha|aha|clarify|pore)/i,
      de: "die Haut klarer wirken lassen",
      en: "clarify skin",
    },
    {
      match: /(curl)/i,
      de: "Locken definieren",
      en: "define curls",
    },
  ];

  const found = mappings.find((item) => item.match.test(source));
  if (!found) {
    return language === "de" ? "sichtbare Ergebnisse erzielen" : "get visible results";
  }

  return language === "de" ? found.de : found.en;
}

function isGenericCta(value, language) {
  const normalized = sanitizeCtaText(value).toLowerCase();
  if (!normalized) {
    return true;
  }

  const genericPhrases =
    language === "de"
      ? [
          "jetzt kaufen",
          "kaufen",
          "jetzt shoppen",
          "shoppen",
          "mehr erfahren",
          "hier klicken",
          "in den warenkorb",
          "warenkorb",
          "zur kasse",
          "jetzt ansehen",
        ]
      : [
          "buy now",
          "shop now",
          "learn more",
          "click here",
          "add to cart",
          "add to bag",
          "shop",
          "buy",
          "checkout",
        ];

  return (
    genericPhrases.includes(normalized) ||
    /\b(cart|bag|basket|checkout|warenkorb)\b/.test(normalized) ||
    /[€$£]\s*\d/.test(String(value || "")) ||
    /\b\d+\b/.test(normalized)
  );
}

function buildEvidenceDrivenCta(evidence, language) {
  const originalCta = sanitizeCtaText(evidence.ctas.primaryText);
  if (originalCta && !isGenericCta(originalCta, language)) {
    return originalCta;
  }

  const productType = inferProductType(evidence, language);
  const outcome = inferOutcomePhrase(evidence, language);

  if (language === "de") {
    if (/cleanser/i.test(productType)) {
      return `Mit diesem Cleanser ${outcome}`;
    }
    if (/leave-in|conditioner|shampoo|maske/i.test(productType)) {
      return `${outcome} mit ${productType} starten`;
    }
    if (/cleanser|serum|creme|exfoliant/i.test(productType)) {
      if (/erzielen$/i.test(outcome)) {
        return `${outcome} mit diesem ${productType}`;
      }
      return `${outcome} mit diesem ${productType} erzielen`;
    }
    if (/erzielen$/i.test(outcome)) {
      return `Jetzt ${outcome}`;
    }
    return `${outcome} mit diesem Produkt`;
  }

  if (/cleanser/i.test(productType)) {
    return `${capitalizePhrase(outcome)} with this cleanser`;
  }
  if (/leave-in|conditioner|shampoo|mask/i.test(productType)) {
    return `Start ${outcome} with this ${productType}`;
  }

  if (/cleanser|serum|cream|exfoliant/i.test(productType)) {
    return `${capitalizePhrase(outcome)} with this ${productType}`;
  }

  return `Get better results with this product`;
}

function containsPlaceholderText(value) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return (
    normalized.includes("headline") ||
    normalized.includes("subheadline") ||
    normalized.includes("lorem ipsum") ||
    normalized.includes("placeholder") ||
    normalized.includes("insert") ||
    normalized.includes("cta text") ||
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "unknown" ||
    normalized === "null" ||
    normalized === "undefined" ||
    normalized === "lacking"
  );
}

function detectLanguageIssues(result, language) {
  const fields = [
    result.headline,
    result.subheadline,
    result.summary,
    result.biggestLeak,
    result.cta,
    ...(result.priorityActions || []),
    ...(result.recommendedSections || []),
    ...((result.improvements || []).flatMap((item) => [
      item.title,
      item.problem,
      item.whyItHurts,
      item.fix,
    ])),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (language === "de") {
    return /\bthe\b|\btrust\b|\bclarity\b|\bfriction\b|\breturn-policy\b|\bshop now\b|\bbuy now\b|\bheadline\b|\bsubheadline\b|\bnot visible\b/.test(
      fields,
    );
  }

  return /\bund\b|\bvertrauen\b|\bklarheit\b|\breibung\b|\bwarenkorb\b|\bnicht sichtbar\b|\bvertrauenssignale\b/.test(
    fields,
  );
}

function hasEvidenceLinkedImprovements(result, evidence) {
  const sourceTokens = [
    evidence.structure.h1.length,
    evidence.structure.h2.length,
    evidence.structure.sectionsCount,
    evidence.ctas.ctaCount,
    evidence.trust.reviewsCount,
    evidence.trust.trustKeywordsCount,
    evidence.trust.paymentSignalsCount,
    evidence.product.productDetailScore,
    evidence.text.totalTextLength,
  ].map((value) => String(value));

  return (result.improvements || []).every((item) => {
    const problem = normalizeWhitespace(item.problem).toLowerCase();
    const fix = normalizeWhitespace(item.fix).toLowerCase();
    return (
      problem.length >= 20 &&
      fix.length >= 16 &&
      (sourceTokens.some((token) => problem.includes(token)) ||
        /\bh1\b|\bh2\b|\bh3\b|\bcta\b|\breview\b|\bpayment\b|\bsection\b|\btext\b|\bprodukt\b|\bproduct\b/.test(
          `${problem} ${fix}`,
        ))
    );
  });
}

function validateAiResultQuality(result, evidence, language) {
  if (!result) {
    return { valid: false, reason: "EMPTY_RESULT" };
  }

  if (detectLanguageIssues(result, language)) {
    return { valid: false, reason: "MIXED_LANGUAGE" };
  }

  if (
    containsPlaceholderText(result.headline) ||
    containsPlaceholderText(result.subheadline) ||
    containsPlaceholderText(result.summary) ||
    containsPlaceholderText(result.cta)
  ) {
    return { valid: false, reason: "PLACEHOLDER_TEXT" };
  }

  if (isGenericCta(result.cta, language)) {
    return { valid: false, reason: "GENERIC_CTA" };
  }

  if (!["low", "medium", "high"].includes(String(result.confidence || "").toLowerCase())) {
    return { valid: false, reason: "INVALID_CONFIDENCE" };
  }

  if (!Array.isArray(result.improvements) || !result.improvements.length) {
    return { valid: false, reason: "MISSING_IMPROVEMENTS" };
  }

  if (!hasEvidenceLinkedImprovements(result, evidence)) {
    return { valid: false, reason: "UNGROUNDED_IMPROVEMENTS" };
  }

  if (isWeakEvidence(evidence)) {
    const weakScores = [
      result.scores?.trustSignals,
      result.scores?.valueProposition,
      result.scores?.cta,
    ].map((value) => clampScore(value, 10));
    if (weakScores.some((value) => value > 4)) {
      return { valid: false, reason: "WEAK_EVIDENCE_SCORES_TOO_HIGH" };
    }
  }

  if (isStrongEvidence(evidence)) {
    const strongScores = [
      result.scores?.trustSignals,
      result.scores?.valueProposition,
      result.scores?.cta,
    ].map((value) => clampScore(value, 1));
    if (strongScores.some((value) => value < 7)) {
      return { valid: false, reason: "STRONG_EVIDENCE_SCORES_TOO_LOW" };
    }
  }

  return { valid: true, reason: "OK" };
}

function buildHeuristicResult(url, audience, evidence, dimensionScores, confidence, language) {
  const i18n = getLanguagePack(language);
  const host = getHostnameLabel(url).split(".")[0];
  const audienceLabel = normalizeWhitespace(audience) || host;
  const productCue =
    evidence.structure.h1[0] ||
    evidence.structure.title ||
    evidence.ctas.primaryText ||
    host;
  const weak = isWeakEvidence(evidence);
  const strong = isStrongEvidence(evidence);

  const headline =
    language === "de"
      ? strong
        ? `${productCue} wirkt als starke Premium-Experience für ${audienceLabel}`
        : weak
          ? `${host.charAt(0).toUpperCase() + host.slice(1)} liefert für ${audienceLabel} noch zu wenig belastbare Kaufargumente`
          : `${host.charAt(0).toUpperCase() + host.slice(1)} zeigt Potenzial, muss den Nutzen für ${audienceLabel} aber klarer und vertrauensstärker kommunizieren`
      : strong
        ? `${productCue} already reads like a strong premium experience for ${audienceLabel}`
        : weak
          ? `${host.charAt(0).toUpperCase() + host.slice(1)} still gives ${audienceLabel} too few reliable buying reasons`
          : `${host.charAt(0).toUpperCase() + host.slice(1)} shows potential, but needs clearer value communication and stronger trust for ${audienceLabel}`;

  const subheadline =
    language === "de"
      ? `Die Bewertung nutzt nur die extrahierte Evidenz: Struktur, CTA-Signale, Trust-Hinweise, Produkttiefe und Screenshot-Verfügbarkeit. Confidence: ${confidence}.`
      : `This evaluation uses only extracted evidence: structure, CTA signals, trust cues, product depth, and screenshot availability. Confidence: ${confidence}.`;

  const cta = buildEvidenceDrivenCta(evidence, language);

  const summary =
    language === "de"
      ? `Trust liegt bei ${dimensionScores.trust}/10, Clarity bei ${dimensionScores.clarity}/10 und Friction bei ${dimensionScores.friction}/10. Diese Werte folgen direkt aus ${evidence.trust.reviewsCount} Review-Signalen, ${evidence.trust.paymentSignalsCount} Payment-Signalen, ${evidence.ctas.ctaCount} CTA-Treffern, ${evidence.structure.sectionsCount} Sektionen und einer Produkttiefenbewertung von ${evidence.product.productDetailScore}.`
      : `Trust lands at ${dimensionScores.trust}/10, clarity at ${dimensionScores.clarity}/10, and friction at ${dimensionScores.friction}/10. Those scores are driven directly by ${evidence.trust.reviewsCount} review signals, ${evidence.trust.paymentSignalsCount} payment signals, ${evidence.ctas.ctaCount} CTA hits, ${evidence.structure.sectionsCount} sections, and a product depth score of ${evidence.product.productDetailScore}.`;

  const biggestLeak =
    weak
      ? language === "de"
        ? "Das größte Leak liegt im fehlenden Vertrauens- und Reibungsabbau: Ohne starke Trust-Signale, klare CTA-Führung und ausreichende Inhaltstiefe bleibt die Kaufentscheidung zu offen."
        : "The biggest leak is missing trust and friction reduction: without strong trust cues, clear CTA guidance, and enough content depth, the buying decision stays too open."
      : dimensionScores.trust < dimensionScores.clarity
        ? language === "de"
          ? "Das größte Leak liegt zwischen Interesse und Vertrauen: Die Seite erklärt eher, als dass sie die Kaufentscheidung aktiv absichert."
          : "The biggest leak sits between interest and trust, where the page explains more than it actively de-risks the decision."
        : language === "de"
          ? "Das größte Leak liegt im ersten Screen: Das Nutzenversprechen und die nächste Aktion sind noch nicht eng genug gekoppelt."
          : "The biggest leak sits in the first screen, where the value proposition and next action are not yet tightly coupled.";

  const conversionFlow =
    language === "de"
      ? {
          entry: `Der Einstieg startet mit ${evidence.structure.h1.length} H1- und ${evidence.structure.h2.length} H2-Signalen. Das erklärt einen Clarity-Wert von ${dimensionScores.clarity}/10.`,
          firstScreen: `Above the fold ${evidence.ctas.aboveTheFold ? "liegt" : "fehlt"} eine klare CTA-Führung. ${evidence.ctas.ctaCount} CTA-Signale wurden erkannt.`,
          interest: `Im Lesefluss stehen ${evidence.text.totalTextLength} Zeichen Text und eine Produkttiefenbewertung von ${evidence.product.productDetailScore} zur Verfügung.`,
          trust: `Trust stützt sich auf ${evidence.trust.reviewsCount} Review-Signale, ${evidence.trust.trustKeywordsCount} Trust-Treffer und ${evidence.trust.paymentSignalsCount} Payment-Signale.`,
          decision: `Am Entscheidungspunkt wirken ${evidence.trust.returnPolicyDetected ? "Rückgabe-Hinweise" : "kaum Rückgabe-Hinweise"} und die CTA-Führung direkt auf den Friction-Wert von ${dimensionScores.friction}/10.`,
        }
      : {
          entry: `Entry begins with ${evidence.structure.h1.length} H1 signals and ${evidence.structure.h2.length} H2 signals, which drives a clarity score of ${dimensionScores.clarity}/10.`,
          firstScreen: `Above the fold, clear CTA guidance ${evidence.ctas.aboveTheFold ? "is present" : "is missing"}. ${evidence.ctas.ctaCount} CTA signals were detected.`,
          interest: `In the reading flow, the page offers ${evidence.text.totalTextLength} characters of text and a product depth score of ${evidence.product.productDetailScore}.`,
          trust: `Trust currently leans on ${evidence.trust.reviewsCount} review signals, ${evidence.trust.trustKeywordsCount} trust hits, and ${evidence.trust.paymentSignalsCount} payment signals.`,
          decision: `At the decision point, ${evidence.trust.returnPolicyDetected ? "return-policy cues are visible" : "return-policy reassurance is weak"}, which directly shapes a friction score of ${dimensionScores.friction}/10.`,
        };

  const improvements =
    language === "de"
      ? [
          {
            title: "Above-the-fold-Klarheit",
            problem: `Die Seite zeigt ${evidence.structure.h1.length} H1-Signale, aber nur ${evidence.ctas.ctaCount} CTA-Signale und ${evidence.ctas.aboveTheFold ? "eine sichtbare" : "keine sichtbare"} CTA im ersten Screen.`,
            whyItHurts: `Dadurch bleibt der Nutzen für kalten Traffic mit Clarity ${dimensionScores.clarity}/10 zu wenig verdichtet.`,
            fix: "Verdichte Headline, H2-Struktur und primäre CTA stärker auf ein klares Ergebnis und den nächsten Schritt.",
            impact: "HIGH",
          },
          {
            title: "Trust und Sicherheit",
            problem: `Es wurden ${evidence.trust.reviewsCount} Review-Signale, ${evidence.trust.trustKeywordsCount} Trust-Treffer und ${evidence.trust.paymentSignalsCount} Payment-Signale erkannt.`,
            whyItHurts: `Wenn diese Signale schwach oder spät erscheinen, bleibt der Trust-Wert bei ${dimensionScores.trust}/10 hängen.`,
            fix: "Ziehe Reviews, Garantien, Rückgabe- und Payment-Hinweise näher an Preis und CTA.",
            impact: "HIGH",
          },
          {
            title: "Produkt-Tiefe",
            problem: `Die Produkttiefen-Bewertung liegt bei ${evidence.product.productDetailScore}.`,
            whyItHurts: "Ohne klar sichtbare Inhaltsstoffe, Benefits oder Anwendung bleibt Differenzierung zu abstrakt.",
            fix: "Mache Inhaltsstoffe, Nutzen und Anwendung konkreter und leichter scanbar.",
            impact: "MEDIUM",
          },
        ]
      : [
          {
            title: "Above-the-fold clarity",
            problem: `The page shows ${evidence.structure.h1.length} H1 signals but only ${evidence.ctas.ctaCount} CTA signals and ${evidence.ctas.aboveTheFold ? "a visible" : "no visible"} above-the-fold CTA.`,
            whyItHurts: `That leaves the payoff too compressed for cold traffic, which keeps clarity at ${dimensionScores.clarity}/10.`,
            fix: "Tighten the headline, H2 structure, and primary CTA around one clear outcome and next step.",
            impact: "HIGH",
          },
          {
            title: "Trust and reassurance",
            problem: `The extractor found ${evidence.trust.reviewsCount} review signals, ${evidence.trust.trustKeywordsCount} trust hits, and ${evidence.trust.paymentSignalsCount} payment signals.`,
            whyItHurts: `When those cues are weak or late, trust stalls at ${dimensionScores.trust}/10.`,
            fix: "Pull reviews, guarantees, return cues, and payment reassurance closer to the price and CTA.",
            impact: "HIGH",
          },
          {
            title: "Product depth",
            problem: `The product depth score is ${evidence.product.productDetailScore}.`,
            whyItHurts: "Without clearly visible ingredients, benefits, or usage guidance, differentiation stays too abstract.",
            fix: "Make ingredients, benefits, and usage guidance more concrete and more scannable.",
            impact: "MEDIUM",
          },
        ];

  const visualFindings =
    language === "de"
      ? [
          {
            title: i18n.findings.hierarchy,
            observation: `Es wurden ${evidence.structure.sectionsCount} Sektionen, ${evidence.structure.h1.length} H1-Signale und ${evidence.structure.h2.length} H2-Signale erkannt.`,
            impact: dimensionScores.clarity >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.cta,
            observation: `Primäre CTA: "${evidence.ctas.primaryText || "keine erkannt"}". Above the fold: ${evidence.ctas.aboveTheFold ? "ja" : "nein"}.`,
            impact: dimensionScores.friction >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.trust,
            observation: `${evidence.trust.reviewsCount} Review-Signale, ${evidence.trust.trustKeywordsCount} Trust-Treffer und ${evidence.trust.paymentSignalsCount} Payment-Signale wurden erfasst.`,
            impact: dimensionScores.trust >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.mobile,
            observation: `Screenshots verfügbar: ${evidence.screenshotsAvailable ? "ja" : "nein"}. Ohne mobile Evidenz sinkt die Confidence automatisch.`,
            impact: evidence.screenshotsAvailable ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.density,
            observation: `${evidence.text.totalTextLength} Zeichen Text, Produkt-Keyword-Dichte ${evidence.text.keywordDensity}.`,
            impact: evidence.text.totalTextLength >= 2500 ? "MEDIUM" : "HIGH",
          },
        ]
      : [
          {
            title: i18n.findings.hierarchy,
            observation: `${evidence.structure.sectionsCount} sections, ${evidence.structure.h1.length} H1 signals, and ${evidence.structure.h2.length} H2 signals were detected.`,
            impact: dimensionScores.clarity >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.cta,
            observation: `Primary CTA: "${evidence.ctas.primaryText || "none detected"}". Above the fold: ${evidence.ctas.aboveTheFold ? "yes" : "no"}.`,
            impact: dimensionScores.friction >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.trust,
            observation: `${evidence.trust.reviewsCount} review signals, ${evidence.trust.trustKeywordsCount} trust hits, and ${evidence.trust.paymentSignalsCount} payment signals were captured.`,
            impact: dimensionScores.trust >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.mobile,
            observation: `Screenshots available: ${evidence.screenshotsAvailable ? "yes" : "no"}. Missing screenshot evidence automatically lowers confidence.`,
            impact: evidence.screenshotsAvailable ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.density,
            observation: `${evidence.text.totalTextLength} characters of text and a product keyword density of ${evidence.text.keywordDensity}.`,
            impact: evidence.text.totalTextLength >= 2500 ? "MEDIUM" : "HIGH",
          },
        ];

  const recommendedSections = [...i18n.sections];
  const priorityActions = [
    i18n.priority.clarity,
    i18n.priority.trust,
    evidence.product.productDetailScore < 0.6 ? i18n.priority.proof : i18n.priority.friction,
  ];

  return {
    headline,
    subheadline,
    cta,
    summary,
    scores: buildFrontendScores(dimensionScores),
    visualScore: clampScore(dimensionScores.visualQuality, 4),
    mobileScore: clampScore(dimensionScores.mobile, 4),
    visualFindings,
    biggestLeak,
    conversionFlow,
    improvements,
    recommendedSections,
    priorityActions,
  };
}

function buildHeuristicResultV2(url, audience, evidence, dimensionScores, confidence, language) {
  const i18n = getLanguagePack(language);
  const host = getHostnameLabel(url).split(".")[0];
  const audienceLabel = normalizeWhitespace(audience) || host;
  const productCue =
    evidence.structure.h1[0] ||
    evidence.structure.title ||
    sanitizeCtaText(evidence.ctas.primaryText) ||
    host;
  const weak = isWeakEvidence(evidence);
  const strong = isStrongEvidence(evidence);
  const trustCount =
    evidence.trust.reviewsCount +
    evidence.trust.trustKeywordsCount +
    evidence.trust.paymentSignalsCount;
  const cta = buildEvidenceDrivenCta(evidence, language);

  const headline =
    language === "de"
      ? strong
        ? `${productCue} wirkt bereits wie eine starke Premium-Produktseite für ${audienceLabel}`
        : weak
          ? `${host.charAt(0).toUpperCase() + host.slice(1)} liefert für ${audienceLabel} derzeit zu wenig belastbare Kaufargumente`
          : `${host.charAt(0).toUpperCase() + host.slice(1)} zeigt Potenzial, muss den Nutzen für ${audienceLabel} aber klarer und vertrauensstärker kommunizieren`
      : strong
        ? `${productCue} already reads like a strong premium product page for ${audienceLabel}`
        : weak
          ? `${host.charAt(0).toUpperCase() + host.slice(1)} currently gives ${audienceLabel} too few reliable buying reasons`
          : `${host.charAt(0).toUpperCase() + host.slice(1)} shows potential, but needs clearer value communication and stronger trust for ${audienceLabel}`;

  const subheadline =
    language === "de"
      ? `Die Bewertung nutzt nur extrahierte Evidenz aus Struktur, CTA-Signalen, Vertrauenssignalen, Produkttiefe und Screenshot-Verfügbarkeit. Konfidenz: ${confidence}.`
      : `This evaluation uses only extracted evidence from structure, CTA signals, trust signals, product depth, and screenshot availability. Confidence: ${confidence}.`;

  const summary =
    language === "de"
      ? `Vertrauen liegt bei ${dimensionScores.trust}/10, Klarheit bei ${dimensionScores.clarity}/10 und Reibung bei ${dimensionScores.friction}/10. Diese Werte folgen direkt aus ${trustCount} Vertrauenssignalen, ${evidence.ctas.ctaCount} CTA-Treffern, ${evidence.structure.sectionsCount} Sektionen und einer Produkttiefenbewertung von ${evidence.product.productDetailScore}.`
      : `Trust lands at ${dimensionScores.trust}/10, clarity at ${dimensionScores.clarity}/10, and friction at ${dimensionScores.friction}/10. Those scores follow directly from ${trustCount} trust signals, ${evidence.ctas.ctaCount} CTA hits, ${evidence.structure.sectionsCount} sections, and a product depth score of ${evidence.product.productDetailScore}.`;

  const biggestLeak = weak
    ? language === "de"
      ? "Das größte Leak liegt im fehlenden Vertrauens- und Reibungsabbau: Ohne starke Vertrauenssignale, klare CTA-Führung und ausreichende Inhaltstiefe bleibt die Kaufentscheidung zu offen."
      : "The biggest leak is missing trust and friction reduction: without strong trust cues, clear CTA guidance, and enough content depth, the buying decision stays too open."
    : dimensionScores.trust < dimensionScores.clarity
      ? language === "de"
        ? "Das größte Leak liegt zwischen Interesse und Vertrauen: Die Seite erklärt das Produkt eher, als dass sie die Kaufentscheidung aktiv absichert."
        : "The biggest leak sits between interest and trust, where the page explains the product more than it actively de-risks the decision."
      : language === "de"
        ? "Das größte Leak liegt im ersten Screen: Nutzenversprechen und nächste Aktion sind noch nicht eng genug gekoppelt."
        : "The biggest leak sits in the first screen, where the value proposition and next action are not yet tightly coupled.";

  const conversionFlow =
    language === "de"
      ? {
          entry: `Der Einstieg startet mit ${evidence.structure.h1.length} H1- und ${evidence.structure.h2.length} H2-Signalen. Das treibt einen Klarheitswert von ${dimensionScores.clarity}/10.`,
          firstScreen: evidence.ctas.aboveTheFold
            ? `Oberhalb des ersten Scrolls wurde eine CTA-Führung aus der DOM-Struktur erkannt. Insgesamt wurden ${evidence.ctas.ctaCount} CTA-Signale erfasst.`
            : `Oberhalb des ersten Scrolls wurde keine klare CTA-Führung aus der DOM-Struktur erkannt. Insgesamt wurden ${evidence.ctas.ctaCount} CTA-Signale erfasst.`,
          interest: `Im Lesefluss stehen ${evidence.text.totalTextLength} Zeichen Text und eine Produkttiefenbewertung von ${evidence.product.productDetailScore} zur Verfügung.`,
          trust: `Vertrauen stützt sich aktuell auf ${evidence.trust.reviewsCount} Bewertungs-Signale, ${evidence.trust.trustKeywordsCount} weitere Vertrauens-Treffer und ${evidence.trust.paymentSignalsCount} Zahlungs-Signale.`,
          decision: `Am Entscheidungspunkt wirken ${evidence.trust.returnPolicyDetected ? "erkennbare Rückgabe-Hinweise" : "kaum erkennbare Rückgabe-Hinweise"} direkt auf die wahrgenommene Reibung von ${dimensionScores.friction}/10.`,
        }
      : {
          entry: `Entry begins with ${evidence.structure.h1.length} H1 signals and ${evidence.structure.h2.length} H2 signals, which drives a clarity score of ${dimensionScores.clarity}/10.`,
          firstScreen: evidence.ctas.aboveTheFold
            ? `CTA guidance was detected above the first scroll in the DOM structure. ${evidence.ctas.ctaCount} CTA signals were detected overall.`
            : `No clear CTA guidance was detected above the first scroll in the DOM structure. ${evidence.ctas.ctaCount} CTA signals were detected overall.`,
          interest: `In the reading flow, the page offers ${evidence.text.totalTextLength} characters of text and a product depth score of ${evidence.product.productDetailScore}.`,
          trust: `Trust currently leans on ${evidence.trust.reviewsCount} review signals, ${evidence.trust.trustKeywordsCount} additional trust hits, and ${evidence.trust.paymentSignalsCount} payment signals.`,
          decision: `At the decision point, ${evidence.trust.returnPolicyDetected ? "return-policy cues are detectable" : "return-policy reassurance is barely detectable"}, which directly shapes friction at ${dimensionScores.friction}/10.`,
        };

  const improvements = strong
    ? language === "de"
      ? [
          {
            title: "Feintuning im ersten Screen",
            problem: `Die Seite hat ${evidence.ctas.ctaCount} CTA-Signale und ${evidence.structure.h2.length} H2-Signale, kann das Nutzenversprechen im ersten Screen aber noch enger bündeln.`,
            whyItHurts: "Auch starke Seiten verlieren Momentum, wenn der erste Kaufimpuls mehrere Ideen gleichzeitig verarbeiten muss.",
            fix: "Verdichte Headline, erste Benefit-Zeile und primäre CTA stärker auf ein sichtbares Ergebnis und den unmittelbar nächsten Schritt.",
            impact: "MEDIUM",
          },
          {
            title: "Trust näher an die Kaufhandlung",
            problem: `Es sind ${trustCount} Vertrauenssignale sichtbar, aber nicht jedes davon wirkt direkt am ersten Kaufimpuls.`,
            whyItHurts: "Selbst gute Seiten verschenken Conversion-Potenzial, wenn Proof und Sicherheit erst nach zusätzlichem Scrollen greifen.",
            fix: "Ziehe Reviews, Zahlungsarten oder Rückgabe-Hinweise näher an Preis und primäre CTA, statt sie nur tiefer im Layout wirken zu lassen.",
            impact: "MEDIUM",
          },
          {
            title: "Produkttiefe schneller scanbar machen",
            problem: `Die Produkttiefen-Bewertung liegt bei ${evidence.product.productDetailScore} und deutet auf Substanz hin, die noch schneller erfassbar werden kann.`,
            whyItHurts: "Wenn gute Produktdetails zu spät greifbar werden, sinkt die Geschwindigkeit der Kaufentscheidung.",
            fix: "Fasse Inhaltsstoffe, Nutzen oder Anwendung näher am ersten Kaufblock in einem kompakteren Modul zusammen.",
            impact: "LOW",
          },
        ]
      : [
          {
            title: "First-screen tightening",
            problem: `The page already has ${evidence.ctas.ctaCount} CTA signals and ${evidence.structure.h2.length} H2 signals, but the first screen can still tighten the payoff around one clearer outcome.`,
            whyItHurts: "Even strong pages lose momentum when the hero asks the shopper to process too many parallel ideas before the first click.",
            fix: "Tighten the headline, first benefit line, and primary CTA around one visible outcome and one next step.",
            impact: "MEDIUM",
          },
          {
            title: "Move trust closer to action",
            problem: `${trustCount} trust signals are present, but not all of them work hard enough at the exact buying moment.`,
            whyItHurts: "Strong pages still leave conversion upside on the table when proof and reassurance appear after extra scanning.",
            fix: "Pull reviews, payment reassurance, or return cues closer to the price and primary CTA rather than leaving them deeper in the layout.",
            impact: "MEDIUM",
          },
          {
            title: "Make product depth faster to scan",
            problem: `The product depth score is ${evidence.product.productDetailScore}, which suggests real substance that can still become easier to process quickly.`,
            whyItHurts: "When good product details take too long to decode, decision speed drops even on otherwise strong pages.",
            fix: "Condense ingredients, benefits, or usage guidance into a tighter module closer to the first buying block.",
            impact: "LOW",
          },
        ]
    : language === "de"
      ? [
          {
            title: "Klarheit im ersten Screen",
            problem: `Die Seite zeigt ${evidence.structure.h1.length} H1-Signale, aber nur ${evidence.ctas.ctaCount} CTA-Signale und ${evidence.ctas.aboveTheFold ? "eine sichtbare" : "keine sichtbare"} CTA im ersten Screen.`,
            whyItHurts: `Dadurch bleibt der Nutzen für kalten Traffic bei nur ${dimensionScores.clarity}/10 zu wenig verdichtet.`,
            fix: "Verdichte Headline, H2-Struktur und primäre CTA stärker auf ein klares Ergebnis und den nächsten Schritt.",
            impact: "HIGH",
          },
          {
            title: "Vertrauen und Sicherheit",
            problem: `Es wurden ${evidence.trust.reviewsCount} Bewertungs-Signale, ${evidence.trust.trustKeywordsCount} weitere Vertrauens-Treffer und ${evidence.trust.paymentSignalsCount} Zahlungs-Signale erkannt.`,
            whyItHurts: `Wenn diese Signale schwach oder spät erscheinen, bleibt das Vertrauen bei ${dimensionScores.trust}/10 und die Kaufentscheidung wirkt riskanter als nötig.`,
            fix: "Ziehe Bewertungen, Garantien, Rückgabe- und Zahlungs-Hinweise näher an Preis und CTA.",
            impact: "HIGH",
          },
          {
            title: "Produkt-Tiefe",
            problem: `Die Produkttiefen-Bewertung liegt bei ${evidence.product.productDetailScore}.`,
            whyItHurts: "Ohne klar sichtbare Inhaltsstoffe, Nutzen oder Anwendung bleibt die Differenzierung zu abstrakt.",
            fix: "Mache Inhaltsstoffe, Nutzen und Anwendung konkreter und leichter scanbar.",
            impact: "MEDIUM",
          },
        ]
      : [
          {
            title: "Above-the-fold clarity",
            problem: `The page shows ${evidence.structure.h1.length} H1 signals but only ${evidence.ctas.ctaCount} CTA signals and ${evidence.ctas.aboveTheFold ? "a visible" : "no visible"} above-the-fold CTA.`,
            whyItHurts: `That leaves the payoff under-defined for cold traffic, which holds clarity to ${dimensionScores.clarity}/10.`,
            fix: "Tighten the headline, H2 structure, and primary CTA around one clear outcome and next step.",
            impact: "HIGH",
          },
          {
            title: "Trust and reassurance",
            problem: `The extractor found ${evidence.trust.reviewsCount} review signals, ${evidence.trust.trustKeywordsCount} trust hits, and ${evidence.trust.paymentSignalsCount} payment signals.`,
            whyItHurts: `When those cues are weak or late, trust stays at ${dimensionScores.trust}/10 and the purchase feels riskier than it should.`,
            fix: "Pull reviews, guarantees, return cues, and payment reassurance closer to the price and CTA.",
            impact: "HIGH",
          },
          {
            title: "Product depth",
            problem: `The product depth score is ${evidence.product.productDetailScore}.`,
            whyItHurts: "Without clearly visible ingredients, benefits, or usage guidance, differentiation stays too abstract.",
            fix: "Make ingredients, benefits, and usage guidance more concrete and more scannable.",
            impact: "MEDIUM",
          },
        ];

  const visualFindings =
    language === "de"
      ? [
          {
            title: i18n.findings.hierarchy,
            observation: `Es wurden ${evidence.structure.sectionsCount} Sektionen, ${evidence.structure.h1.length} H1-Signale und ${evidence.structure.h2.length} H2-Signale erkannt.`,
            impact: dimensionScores.clarity >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.cta,
            observation: `Primäre CTA: "${sanitizeCtaText(evidence.ctas.primaryText) || "nicht sichtbar"}". Im ersten Screen: ${evidence.ctas.aboveTheFold ? "ja" : "nein"}.`,
            impact: dimensionScores.friction >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.trust,
            observation: `${evidence.trust.reviewsCount} Bewertungs-Signale, ${evidence.trust.trustKeywordsCount} weitere Vertrauens-Treffer und ${evidence.trust.paymentSignalsCount} Zahlungs-Signale wurden erfasst.`,
            impact: dimensionScores.trust >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.mobile,
            observation: `Screenshots verfügbar: ${evidence.screenshotsAvailable ? "ja" : "nein"}. Ohne mobile Evidenz sinkt die Konfidenz automatisch.`,
            impact: evidence.screenshotsAvailable ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.density,
            observation: `${evidence.text.totalTextLength} Zeichen Text, Produkt-Keyword-Dichte ${evidence.text.keywordDensity}.`,
            impact: evidence.text.totalTextLength >= 2500 ? "MEDIUM" : "HIGH",
          },
        ]
      : [
          {
            title: i18n.findings.hierarchy,
            observation: `${evidence.structure.sectionsCount} sections, ${evidence.structure.h1.length} H1 signals, and ${evidence.structure.h2.length} H2 signals were detected.`,
            impact: dimensionScores.clarity >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.cta,
            observation: `Primary CTA: "${sanitizeCtaText(evidence.ctas.primaryText) || "not visible"}". In the first screen: ${evidence.ctas.aboveTheFold ? "yes" : "no"}.`,
            impact: dimensionScores.friction >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.trust,
            observation: `${evidence.trust.reviewsCount} review signals, ${evidence.trust.trustKeywordsCount} additional trust hits, and ${evidence.trust.paymentSignalsCount} payment signals were captured.`,
            impact: dimensionScores.trust >= 7 ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.mobile,
            observation: `Screenshots available: ${evidence.screenshotsAvailable ? "yes" : "no"}. Missing screenshot evidence automatically lowers confidence.`,
            impact: evidence.screenshotsAvailable ? "MEDIUM" : "HIGH",
          },
          {
            title: i18n.findings.density,
            observation: `${evidence.text.totalTextLength} characters of text and a product keyword density of ${evidence.text.keywordDensity}.`,
            impact: evidence.text.totalTextLength >= 2500 ? "MEDIUM" : "HIGH",
          },
        ];

  const recommendedSections = [...i18n.sections];
  const priorityActions = [
    i18n.priority.clarity,
    i18n.priority.trust,
    evidence.product.productDetailScore < 0.6 ? i18n.priority.proof : i18n.priority.friction,
  ];

  return {
    headline,
    subheadline,
    cta,
    summary,
    scores: buildFrontendScores(dimensionScores),
    visualScore: clampScore(dimensionScores.visualQuality, 4),
    mobileScore: clampScore(dimensionScores.mobile, 4),
    visualFindings,
    biggestLeak,
    conversionFlow,
    improvements,
    recommendedSections,
    priorityActions,
  };
}

function buildAiPrompt(evidence) {
  return `Analyze this ecommerce product page based ONLY on the provided evidence.
Do not assume missing information.
If evidence is weak, lower confidence and scores.

Evidence:
${JSON.stringify(evidence)}

Task:
- Evaluate Trust, Clarity, Friction
- Return realistic scores (1–10)
- Strong brands must score significantly higher than weak pages
- Avoid average clustering (no 5/5/5 bias)

Also return:
confidence: low | medium | high

Return JSON only with:
{
  "headline": "string",
  "subheadline": "string",
  "cta": "string",
  "summary": "string",
  "scores": {
    "aboveTheFold": number,
    "valueProposition": number,
    "emotionalHook": number,
    "cta": number,
    "trustSignals": number,
    "informationHierarchy": number,
    "conversionFriction": number,
    "differentiation": number,
    "brandVoice": number
  },
  "visualScore": number,
  "mobileScore": number,
  "visualFindings": [
    { "title": "string", "observation": "string", "impact": "HIGH|MEDIUM|LOW" }
  ],
  "biggestLeak": "string",
  "conversionFlow": {
    "entry": "string",
    "firstScreen": "string",
    "interest": "string",
    "trust": "string",
    "decision": "string"
  },
  "improvements": [
    {
      "title": "string",
      "problem": "string",
      "whyItHurts": "string",
      "fix": "string",
      "impact": "HIGH|MEDIUM|LOW"
    }
  ],
  "recommendedSections": ["string"],
  "priorityActions": ["string"],
  "confidence": "low|medium|high"
}`;
} 

function buildAiPromptV2(evidence, language) {
  const responseLanguage = language === "de" ? "German" : "English";
  const notVisibleText = language === "de" ? "nicht sichtbar" : "not visible";
  const weakEvidenceInstruction =
    language === "de"
      ? "Wenn Textlänge, Struktur und Vertrauenssignale schwach sind, müssen die Scores klar niedrig sein (1 bis 4) und die Begründung direkt klingen."
      : "If text length, structure, and trust signals are weak, scores must be clearly low (1 to 4) and the explanation must be direct.";

  return `Analyze this ecommerce product page based ONLY on the provided evidence.
No invention.
Only use facts visible in the evidence.
If a data point is missing, say "${notVisibleText}".

Language lock:
- Output ONLY ${responseLanguage}.
- Do not mix languages.

Screenshot rule:
- If screenshotsAvailable is false, do not make visual claims, screenshot claims, or layout claims that require image evidence.
- In that case, phrase observations as derived from DOM/text evidence instead of saying "${notVisibleText}" for visual states.

CTA rule:
- Do not invent unrealistic CTAs.
- CTA must match the product context, sound like real ecommerce language, and stay actionable.
- If the original CTA already fits the evidence, keep it.
- Never return cart UI labels, bag labels, checkout labels, or CTA text that includes prices.

Scoring rule:
- Avoid middle bias.
- Strong evidence may score above 7.
- Weak evidence must score between 1 and 4.
- Use the evidence, not generic assumptions.

Improvement rule:
- Every improvement must be grounded in actual evidence.
- problem = evidence-based issue
- whyItHurts = conversion psychology consequence
- fix = concrete, realistic change that fits the visible page structure
- Do not contradict the existing page content.
- Reference visible structure like H1, H2, sections, CTA, trust cues, or product detail where possible.

Confidence rule:
- high = strong evidence and screenshots
- medium = partial data
- low = weak extraction

${weakEvidenceInstruction}

Evidence:
${JSON.stringify(evidence)}

Return JSON only with:
{
  "headline": "string",
  "subheadline": "string",
  "cta": "string",
  "summary": "string",
  "scores": {
    "aboveTheFold": number,
    "valueProposition": number,
    "emotionalHook": number,
    "cta": number,
    "trustSignals": number,
    "informationHierarchy": number,
    "conversionFriction": number,
    "differentiation": number,
    "brandVoice": number
  },
  "visualScore": number,
  "mobileScore": number,
  "visualFindings": [
    { "title": "string", "observation": "string", "impact": "HIGH|MEDIUM|LOW" }
  ],
  "biggestLeak": "string",
  "conversionFlow": {
    "entry": "string",
    "firstScreen": "string",
    "interest": "string",
    "trust": "string",
    "decision": "string"
  },
  "improvements": [
    {
      "title": "string",
      "problem": "string",
      "whyItHurts": "string",
      "fix": "string",
      "impact": "HIGH|MEDIUM|LOW"
    }
  ],
  "recommendedSections": ["string"],
  "priorityActions": ["string"],
  "confidence": "low|medium|high"
}`;
}

function extractJsonObject(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    throw new Error("AI response was empty.");
  }

  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || normalized;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function extractAiMessageContent(data) {
  const choice = data?.choices?.[0] || {};
  const message = choice.message || {};

  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const joined = message.content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item.text === "string") {
          return item.text;
        }

        if (item?.type === "output_text" && typeof item?.text === "string") {
          return item.text;
        }

        return "";
      })
      .join("\n")
      .trim();

    if (joined) {
      return joined;
    }
  }

  if (typeof choice.text === "string" && choice.text.trim()) {
    return choice.text;
  }

  if (typeof message.refusal === "string" && message.refusal.trim()) {
    return message.refusal;
  }

  return "";
}

function sanitizeImpact(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return ["HIGH", "MEDIUM", "LOW"].includes(normalized) ? normalized : "MEDIUM";
}

function normalizeAiResult(raw, heuristicResult, evidence, language) {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI response was not a valid object.");
  }

  const weak = isWeakEvidence(evidence);
  const strong = isStrongEvidence(evidence);
  const scores = {};

  for (const key of SCORE_KEYS) {
    let score = clampScore(raw.scores?.[key], heuristicResult.scores[key]);
    if (weak) {
      score = Math.min(score, 3);
    }
    if (strong) {
      score = Math.max(score, 8);
    }
    scores[key] = score;
  }

  const normalizeTextArray = (items, fallback, limit) => {
    if (!Array.isArray(items)) {
      return fallback.slice(0, limit);
    }
    const output = items
      .map((item) => (typeof item === "string" ? normalizeWhitespace(item) : ""))
      .filter(Boolean)
      .slice(0, limit);
    return output.length ? output : fallback.slice(0, limit);
  };

  const normalizeFlow = (flow) => {
    const output = {};
    for (const key of ["entry", "firstScreen", "interest", "trust", "decision"]) {
      output[key] =
        typeof flow?.[key] === "string" && normalizeWhitespace(flow[key])
          ? normalizeWhitespace(flow[key])
          : heuristicResult.conversionFlow[key];
    }
    return output;
  };

  const normalizeVisualFindings = (items) => {
    if (!Array.isArray(items)) {
      return heuristicResult.visualFindings;
    }

    const output = items
      .map((item, index) => {
        const fallback = heuristicResult.visualFindings[index] || heuristicResult.visualFindings[0];
        if (!item || typeof item !== "object") {
          return null;
        }
        const observation = normalizeWhitespace(item.observation);
        if (!observation) {
          return null;
        }
        return {
          title: normalizeWhitespace(item.title) || fallback.title,
          observation,
          impact: sanitizeImpact(item.impact || fallback.impact),
        };
      })
      .filter(Boolean)
      .slice(0, 5);

    return output.length ? output : heuristicResult.visualFindings;
  };

  const normalizeImprovements = (items) => {
    if (!Array.isArray(items)) {
      return heuristicResult.improvements;
    }

    const output = items
      .map((item, index) => {
        const fallback = heuristicResult.improvements[index] || heuristicResult.improvements[0];
        if (!item || typeof item !== "object") {
          return null;
        }
        const title = normalizeWhitespace(item.title) || fallback.title;
        const problem = normalizeWhitespace(item.problem);
        const whyItHurts = normalizeWhitespace(item.whyItHurts);
        const fix = normalizeWhitespace(item.fix);
        if (!problem || !whyItHurts || !fix) {
          return null;
        }
        return {
          title,
          problem,
          whyItHurts,
          fix,
          impact: sanitizeImpact(item.impact || fallback.impact),
        };
      })
      .filter(Boolean)
      .slice(0, 6);

    return output.length ? output : heuristicResult.improvements;
  };

  const visualScore = weak
    ? Math.min(clampScore(raw.visualScore, heuristicResult.visualScore), 3)
    : strong
      ? Math.max(clampScore(raw.visualScore, heuristicResult.visualScore), 8)
      : clampScore(raw.visualScore, heuristicResult.visualScore);
  const mobileScore = weak
    ? Math.min(clampScore(raw.mobileScore, heuristicResult.mobileScore), 3)
    : strong
      ? Math.max(clampScore(raw.mobileScore, heuristicResult.mobileScore), 7)
      : clampScore(raw.mobileScore, heuristicResult.mobileScore);

  return {
    headline: normalizeWhitespace(raw.headline) || heuristicResult.headline,
    subheadline: normalizeWhitespace(raw.subheadline) || heuristicResult.subheadline,
    cta: isGenericCta(raw.cta, language)
      ? buildEvidenceDrivenCta(evidence, language)
      : sanitizeCtaText(raw.cta) || buildEvidenceDrivenCta(evidence, language),
    summary: normalizeWhitespace(raw.summary) || heuristicResult.summary,
    scores,
    visualScore,
    mobileScore,
    visualFindings: normalizeVisualFindings(raw.visualFindings),
    biggestLeak: normalizeWhitespace(raw.biggestLeak) || heuristicResult.biggestLeak,
    conversionFlow: normalizeFlow(raw.conversionFlow),
    improvements: normalizeImprovements(raw.improvements),
    recommendedSections: normalizeTextArray(
      raw.recommendedSections,
      heuristicResult.recommendedSections,
      5,
    ),
    priorityActions: normalizeTextArray(raw.priorityActions, heuristicResult.priorityActions, 3),
    confidence: ["low", "medium", "high"].includes(
      normalizeWhitespace(raw.confidence).toLowerCase(),
    )
      ? normalizeWhitespace(raw.confidence).toLowerCase()
      : null,
  };
}

async function fetchOpenRouterCompletion(messages) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY_MISSING");
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:8787",
      "X-Title": "AI Conversion Engine",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.2,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OPENROUTER_HTTP_${response.status}: ${errorText.slice(0, 240)}`);
  }

  return response.json();
}

async function callOpenRouterAI(evidence, language) {
  const attempts = [
    [
      {
        role: "system",
        content:
          "You are a strict ecommerce conversion analyst. Use only provided evidence, never assume missing data, and keep weak evidence visibly weak.",
      },
      {
        role: "user",
        content: buildAiPromptV2(evidence, language),
      },
    ],
    [
      {
        role: "system",
        content:
          "Return raw JSON only. No markdown, no commentary, no code fences. Use only the provided evidence. Fix any mixed language, generic CTA, placeholder text, or unsupported claims.",
      },
      {
        role: "user",
        content: buildAiPromptV2(evidence, language),
      },
    ],
  ];

  let lastError = new Error("AI response was empty.");

  for (const messages of attempts) {
    try {
      const data = await fetchOpenRouterCompletion(messages);
      const content = extractAiMessageContent(data);
      const parsed = extractJsonObject(content);
      const validation = validateAiResultQuality(parsed, evidence, language);
      if (!validation.valid) {
        throw new Error(`AI_RESULT_INVALID_${validation.reason}`);
      }
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError;
}

function buildResponse({
  url,
  audience,
  evidence,
  screenshotUrls,
  visualMetrics,
  warnings,
  aiResult,
  isFallback,
  language,
  revenueRange,
  trafficSource,
}) {
  const dimensionScores = buildDimensionScores(evidence);
  const heuristicResult = buildHeuristicResultV2(
    url,
    audience,
    evidence,
    dimensionScores,
    buildConfidence(evidence, isWeakEvidence(evidence)),
    language,
  );
  const normalizedAiResult = aiResult
    ? normalizeAiResult(aiResult, heuristicResult, evidence, language)
    : heuristicResult;
  const isEvidenceWeak = isWeakEvidence(evidence);
  const qualityCheck = validateAiResultQuality(normalizedAiResult, evidence, language);
  const finalResult = qualityCheck.valid ? normalizedAiResult : heuristicResult;
  const confidence =
    qualityCheck.valid && finalResult.confidence
      ? finalResult.confidence
      : buildConfidence(evidence, isEvidenceWeak);

  const finalWarnings = uniqueList(warnings, 8);
  const finalEvidence = {
    ...evidence,
    screenshotsAvailable: Boolean(screenshotUrls.desktop || screenshotUrls.mobile),
    visual: visualMetrics,
  };
  const primaryProblem = detectPrimaryProblem(finalEvidence, finalResult.scores);
  const impactEstimate = estimateRevenueImpact({
    revenueRange,
    trafficSource,
    primaryProblem,
    language,
  });
  const primaryDecision = selectPrimaryDecision({
    evidence: finalEvidence,
    scores: finalResult.scores,
    impactEstimate,
    language,
  });
  const visualFindings = finalEvidence.screenshotsAvailable
    ? finalResult.visualFindings
    : buildDomOnlyVisualFindings(finalEvidence, finalResult.scores, language);
  const conversionFlow = sanitizeConversionFlowForEvidence(
    finalResult.conversionFlow,
    heuristicResult.conversionFlow,
    finalEvidence,
  );

  return {
    headline: finalResult.headline,
    subheadline: finalResult.subheadline,
    cta: finalResult.cta,
    summary: finalResult.summary,
    scores: finalResult.scores,
    visualScore: finalResult.visualScore,
    mobileScore: finalResult.mobileScore,
    visualFindings,
    biggestLeak: finalResult.biggestLeak,
    conversionFlow,
    improvements: finalResult.improvements,
    recommendedSections: finalResult.recommendedSections,
    priorityActions: finalResult.priorityActions,
    screenshotUrls,
    evidence: finalEvidence,
    confidence,
    isFallback: Boolean(isFallback || !qualityCheck.valid),
    warnings: finalWarnings,
    isEvidenceWeak,
    desktopScreenshot: screenshotUrls.desktop,
    mobileScreenshot: screenshotUrls.mobile,
    desktopScreenshotUrl: screenshotUrls.desktop,
    mobileScreenshotUrl: screenshotUrls.mobile,
    screenshotDesktop: screenshotUrls.desktop,
    screenshotMobile: screenshotUrls.mobile,
    evidenceSummary: buildEvidenceSummaryV2(finalEvidence, confidence, language),
    impactEstimate,
    primaryDecision,
  };
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/analyze") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  let submittedUrl = "";
  let submittedAudience = "";
  let submittedLanguage = "de";
  let submittedRevenueRange = "unknown";
  let submittedTrafficSource = "unknown";
  const warnings = [];

  try {
    console.log("request received");
    const rawBody = await readRequestBody(request);
    const body = JSON.parse(rawBody || "{}");

    submittedLanguage = body.language === "en" ? "en" : "de";
    submittedUrl = validatePublicUrl(body.url);
    submittedAudience = normalizeWhitespace(body.audience);
    submittedRevenueRange =
      typeof body.revenueRange === "string" && body.revenueRange.trim()
        ? body.revenueRange.trim()
        : "unknown";
    submittedTrafficSource =
      typeof body.trafficSource === "string" && body.trafficSource.trim()
        ? body.trafficSource.trim()
        : "unknown";

    let evidence;
    let screenshotUrls;
    let visualMetrics;

    try {
      const captureResult = await withTimeout(
        captureAndExtract(submittedUrl, warnings, submittedLanguage),
        SCREENSHOT_TIMEOUT_MS,
        "SCREENSHOT_CAPTURE",
      );
      evidence = captureResult.evidence;
      screenshotUrls = captureResult.screenshotUrls;
      visualMetrics = captureResult.visualMetrics;
    } catch (error) {
      console.error("Screenshot failed", error.message);
      warnings.push(getLanguagePack(submittedLanguage).screenshotWarning);
      if (error.message === "SCREENSHOT_CAPTURE_TIMEOUT") {
        warnings.push(getLanguagePack(submittedLanguage).timeoutWarning);
      }
      try {
        evidence = buildEvidenceFromHtml(await fetchPageHtml(submittedUrl), submittedUrl);
      } catch {
        evidence = buildFallbackEvidence(submittedUrl);
      }
      screenshotUrls = { desktop: null, mobile: null };
      visualMetrics = { desktop: null, mobile: null };
    }

    evidence.screenshotsAvailable = Boolean(screenshotUrls.desktop || screenshotUrls.mobile);
    if (evidence.pageSignals?.notFoundDetected) {
      warnings.push(
        submittedLanguage === "de"
          ? "Die extrahierte Zielseite wirkt wie eine Fehler- oder Missing-Page. Die Analyse bewertet daher diesen Zustand statt einer echten Produktseite."
          : "The extracted target page appears to be an error or missing page. The analysis is therefore evaluating that state instead of a real product page.",
      );
    } else if (evidence.pageSignals?.consentOverlayDetected) {
      warnings.push(
        submittedLanguage === "de"
          ? "Consent- oder Privacy-Overlays wurden erkannt und als Störsignal aus der Extraktion herausgefiltert."
          : "Consent or privacy overlays were detected and filtered out as noise during extraction.",
      );
    }

    console.log("extraction complete", {
      title: evidence.structure.title,
      sections: evidence.structure.sectionsCount,
      ctaCount: evidence.ctas.ctaCount,
      trustSignals:
        evidence.trust.reviewsCount +
        evidence.trust.trustKeywordsCount +
        evidence.trust.paymentSignalsCount,
      productDetailScore: evidence.product.productDetailScore,
      totalTextLength: evidence.text.totalTextLength,
    });

    console.log("Screenshots available", {
      desktop: Boolean(screenshotUrls.desktop),
      mobile: Boolean(screenshotUrls.mobile),
    });

    let aiResult = null;
    let isFallback = false;

    try {
      console.log("AI call start");
      aiResult = await withTimeout(
        callOpenRouterAI(evidence, submittedLanguage),
        AI_TIMEOUT_MS,
        "AI_ANALYSIS",
      );
      console.log("AI call success");
    } catch (error) {
      console.error("AI call failure", error.message);
      warnings.push(getLanguagePack(submittedLanguage).aiWarning);
      if (error.message === "AI_ANALYSIS_TIMEOUT") {
        warnings.push(getLanguagePack(submittedLanguage).timeoutWarning);
      }
      isFallback = true;
    }

    const finalResponse = buildResponse({
      url: submittedUrl,
      audience: submittedAudience,
      evidence,
      screenshotUrls,
      visualMetrics,
      warnings,
      aiResult,
      isFallback,
      language: submittedLanguage,
      revenueRange: submittedRevenueRange,
      trafficSource: submittedTrafficSource,
    });

    console.log("final response summary", {
      confidence: finalResponse.confidence,
      isFallback: finalResponse.isFallback,
      isEvidenceWeak: finalResponse.isEvidenceWeak,
      desktopScreenshot: Boolean(finalResponse.screenshotUrls.desktop),
      mobileScreenshot: Boolean(finalResponse.screenshotUrls.mobile),
    });

    sendJson(response, 200, finalResponse);
  } catch (error) {
    logServerError("api/analyze", error);

    const invalidMessage =
      error instanceof Error && error.message === "A valid URL is required."
        ? getLanguagePack(submittedLanguage).invalidUrl
        : null;

    if (invalidMessage) {
      sendJson(response, 400, { error: invalidMessage });
      return;
    }

    warnings.push(getLanguagePack(submittedLanguage).aiWarning);
    const fallbackEvidence = buildFallbackEvidence(submittedUrl);
    const fallbackResponse = buildResponse({
      url: submittedUrl,
      audience: submittedAudience,
      evidence: fallbackEvidence,
      screenshotUrls: { desktop: null, mobile: null },
      visualMetrics: { desktop: null, mobile: null },
      warnings,
      aiResult: null,
      isFallback: true,
      language: submittedLanguage,
      revenueRange: submittedRevenueRange,
      trafficSource: submittedTrafficSource,
    });

    console.log("final response summary", {
      confidence: fallbackResponse.confidence,
      isFallback: fallbackResponse.isFallback,
      isEvidenceWeak: fallbackResponse.isEvidenceWeak,
      desktopScreenshot: false,
      mobileScreenshot: false,
    });

    sendJson(response, 200, fallbackResponse);
  }
});

console.log("Server starting...");
server.listen(PORT, () => {
  console.log(`AI Conversion Engine API listening on http://localhost:${PORT}`);
});
