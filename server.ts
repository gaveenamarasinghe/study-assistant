import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

/* =========================================================
   Gemini configuration
   ========================================================= */

const PRIMARY_MODEL = 'gemini-3.8-flash';

// Keep this small. Do NOT use fallback models to bypass
// a project-level daily quota.
const FALLBACK_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
];

const MAX_TRANSIENT_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 15000;

/* =========================================================
   Error types
   ========================================================= */

class GeminiApiError extends Error {
  statusCode: number;
  code: string;
  isDailyQuotaExceeded: boolean;
  isTemporaryUnavailable: boolean;
  isRateLimited: boolean;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      isDailyQuotaExceeded?: boolean;
      isTemporaryUnavailable?: boolean;
      isRateLimited?: boolean;
    } = {},
  ) {
    super(message);

    this.name = 'GeminiApiError';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'GEMINI_ERROR';
    this.isDailyQuotaExceeded = options.isDailyQuotaExceeded ?? false;
    this.isTemporaryUnavailable = options.isTemporaryUnavailable ?? false;
    this.isRateLimited = options.isRateLimited ?? false;
  }
}

/* =========================================================
   Gemini client
   ========================================================= */

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new GeminiApiError(
      'GEMINI_API_KEY is not configured on the server.',
      {
        statusCode: 500,
        code: 'GEMINI_API_KEY_MISSING',
      },
    );
  }

  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/* =========================================================
   Gemini error parsing
   ========================================================= */

function stringifyError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function parseGeminiError(err: any): GeminiApiError {
  const message = stringifyError(err);

  const lower = message.toLowerCase();

  const statusCode =
    Number(err?.status) ||
    Number(err?.statusCode) ||
    Number(err?.response?.status) ||
    (lower.includes('429') ? 429 : 0) ||
    (lower.includes('503') ? 503 : 0) ||
    500;

  /*
   * IMPORTANT:
   *
   * Gemini daily quota errors contain things such as:
   *
   * GenerateRequestsPerDayPerProject-FreeTier
   * generate_content_free_tier_requests
   * quota exceeded
   *
   * These are NOT temporary request-rate-limit errors.
   *
   * Retrying them wastes requests and can make the situation worse.
   */

  const isDailyQuotaExceeded =
    lower.includes('generatedrequestsperdayperproject') ||
    lower.includes('generaterequestsperdayperproject') ||
    lower.includes('generate_requests_per_day') ||
    lower.includes('generate_content_free_tier_requests') ||
    lower.includes('generaterequestsperday') ||
    lower.includes('daily quota') ||
    lower.includes('quota exceeded') ||
    lower.includes('quota_exceeded') ||
    lower.includes('perdayperproject') ||
    lower.includes('free_tier_requests');

  const isRateLimited =
    statusCode === 429 &&
    !isDailyQuotaExceeded &&
    (
      lower.includes('rate limit') ||
      lower.includes('rate_limit') ||
      lower.includes('too many requests') ||
      lower.includes('resource exhausted') ||
      lower.includes('resourceexhausted')
    );

  const isTemporaryUnavailable =
    statusCode === 503 ||
    lower.includes('service unavailable') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('temporarily unavailable');

  if (isDailyQuotaExceeded) {
    return new GeminiApiError(
      'Gemini daily project quota has been exhausted. Please wait for the quota to reset or upgrade the Gemini API billing tier.',
      {
        statusCode: 429,
        code: 'GEMINI_DAILY_QUOTA_EXCEEDED',
        isDailyQuotaExceeded: true,
      },
    );
  }

  if (isRateLimited) {
    return new GeminiApiError(
      'Gemini API rate limit reached. Please retry shortly.',
      {
        statusCode: 429,
        code: 'GEMINI_RATE_LIMITED',
        isRateLimited: true,
      },
    );
  }

  if (isTemporaryUnavailable) {
    return new GeminiApiError(
      'Gemini is temporarily unavailable or experiencing high demand.',
      {
        statusCode: 503,
        code: 'GEMINI_TEMPORARILY_UNAVAILABLE',
        isTemporaryUnavailable: true,
      },
    );
  }

  /*
   * Preserve authentication errors.
   */

  if (
    statusCode === 401 ||
    lower.includes('unauthenticated') ||
    lower.includes('invalid api key') ||
    lower.includes('api key not valid')
  ) {
    return new GeminiApiError(
      'Gemini API authentication failed. Check GEMINI_API_KEY.',
      {
        statusCode: 401,
        code: 'GEMINI_AUTH_ERROR',
      },
    );
  }

  if (
    statusCode === 403 ||
    lower.includes('permission denied') ||
    lower.includes('permission_denied')
  ) {
    return new GeminiApiError(
      'Gemini API permission was denied. Check the API key, project, and enabled API access.',
      {
        statusCode: 403,
        code: 'GEMINI_PERMISSION_ERROR',
      },
    );
  }

  return new GeminiApiError(
    message || 'Gemini API request failed.',
    {
      statusCode: statusCode >= 400 ? statusCode : 500,
      code: 'GEMINI_REQUEST_FAILED',
    },
  );
}

/* =========================================================
   Delay helper
   ========================================================= */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* =========================================================
   Single Gemini request
   ========================================================= */

async function callGemini(params: any): Promise<any> {
  const ai = getGeminiClient();

  try {
    return await ai.models.generateContent(params);
  } catch (err: any) {
    throw parseGeminiError(err);
  }
}

/* =========================================================
   Retry only genuinely temporary errors
   ========================================================= */

async function callGeminiWithRetry(
  params: any,
  retries = MAX_TRANSIENT_RETRIES,
): Promise<any> {
  let delayMs = INITIAL_RETRY_DELAY_MS;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await callGemini(params);
    } catch (err: any) {
      const parsedError =
        err instanceof GeminiApiError
          ? err
          : parseGeminiError(err);

      /*
       * NEVER retry daily quota exhaustion.
       *
       * This is the key fix for the logs you were seeing.
       */
      if (parsedError.isDailyQuotaExceeded) {
        console.error(
          '[Gemini] Daily project quota exhausted. No retry will be attempted.',
        );

        throw parsedError;
      }

      const canRetry =
        parsedError.isTemporaryUnavailable ||
        parsedError.isRateLimited;

      if (!canRetry || attempt >= retries) {
        throw parsedError;
      }

      /*
       * Small jitter prevents several simultaneous requests
       * from retrying at exactly the same moment.
       */
      const jitter = Math.floor(Math.random() * 500);
      const waitMs = Math.min(
        delayMs + jitter,
        MAX_RETRY_DELAY_MS,
      );

      console.warn(
        `[Gemini] Temporary error on attempt ${attempt}/${retries}. ` +
        `Retrying in ${waitMs}ms. ` +
        `code=${parsedError.code}`,
      );

      await sleep(waitMs);

      delayMs = Math.min(
        delayMs * 2,
        MAX_RETRY_DELAY_MS,
      );
    }
  }

  throw new GeminiApiError(
    'Gemini request failed after retries.',
    {
      statusCode: 503,
      code: 'GEMINI_RETRY_EXHAUSTED',
      isTemporaryUnavailable: true,
    },
  );
}

/* =========================================================
   Model fallback
   ========================================================= */

/*
 * IMPORTANT:
 *
 * Fallback models are only useful when the current model itself
 * is temporarily unavailable.
 *
 * If the project daily quota is exhausted, changing models
 * does NOT bypass the project quota.
 */

async function generateWithGeminiFallback(
  params: any,
): Promise<any> {
  const models = [
    PRIMARY_MODEL,
    ...FALLBACK_MODELS,
  ];

  let lastError: GeminiApiError | undefined;

  for (let index = 0; index < models.length; index++) {
    const model = models[index];

    try {
      console.log(`[Gemini] Trying model: ${model}`);

      return await callGeminiWithRetry({
        ...params,
        model,
      });
    } catch (err: any) {
      const parsedError =
        err instanceof GeminiApiError
          ? err
          : parseGeminiError(err);

      lastError = parsedError;

      /*
       * Absolutely no model fallback for daily quota.
       */
      if (parsedError.isDailyQuotaExceeded) {
        console.error(
          `[Gemini] Daily quota exhausted on ${model}. ` +
          `Stopping model fallback.`,
        );

        throw parsedError;
      }

      /*
       * Authentication / permission / invalid-request errors
       * should also not be sent to other models.
       */
      if (
        parsedError.statusCode === 400 ||
        parsedError.statusCode === 401 ||
        parsedError.statusCode === 403
      ) {
        throw parsedError;
      }

      /*
       * Only continue to another model after a temporary
       * availability failure.
       */
      if (!parsedError.isTemporaryUnavailable) {
        throw parsedError;
      }

      if (index < models.length - 1) {
        console.warn(
          `[Gemini] ${model} temporarily unavailable. ` +
          `Trying fallback model ${models[index + 1]}.`,
        );
      }
    }
  }

  throw (
    lastError ??
    new GeminiApiError(
      'All Gemini models are temporarily unavailable.',
      {
        statusCode: 503,
        code: 'GEMINI_ALL_MODELS_UNAVAILABLE',
        isTemporaryUnavailable: true,
      },
    )
  );
}

/* =========================================================
   Response helpers
   ========================================================= */

function getResponseText(response: any): string {
  const text = response?.text;

  if (typeof text === 'string' && text.trim()) {
    return text.trim();
  }

  /*
   * Fallback for response shapes where .text isn't populated.
   */
  const parts =
    response?.candidates?.[0]?.content?.parts;

  if (Array.isArray(parts)) {
    const combined = parts
      .map((part: any) => part?.text)
      .filter(
        (value: any): value is string =>
          typeof value === 'string',
      )
      .join('');

    if (combined.trim()) {
      return combined.trim();
    }
  }

  throw new GeminiApiError(
    'Gemini returned an empty response.',
    {
      statusCode: 502,
      code: 'GEMINI_EMPTY_RESPONSE',
    },
  );
}

function parseJsonResponse(text: string): any {
  let cleaned = text.trim();

  /*
   * Gemini normally returns clean JSON when responseMimeType
   * is application/json, but this protects against accidental
   * markdown fences.
   */
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new GeminiApiError(
      'Gemini returned invalid JSON.',
      {
        statusCode: 502,
        code: 'GEMINI_INVALID_JSON',
      },
    );
  }
}

/* =========================================================
   API error response
   ========================================================= */

function sendApiError(
  res: Response,
  err: unknown,
  fallbackMessage: string,
): void {
  const parsedError =
    err instanceof GeminiApiError
      ? err
      : parseGeminiError(err);

  console.error(
    '[API Error]',
    parsedError.code,
    parsedError.message,
  );

  if (parsedError.isDailyQuotaExceeded) {
    res.status(429).json({
      error:
        'Gemini daily quota has been exhausted. Please wait for the quota to reset or upgrade your Gemini API billing tier.',
      code: 'GEMINI_DAILY_QUOTA_EXCEEDED',
      retryable: false,
    });
    return;
  }

  if (parsedError.isRateLimited) {
    res.status(429).json({
      error:
        'Gemini rate limit reached. Please wait a moment and try again.',
      code: 'GEMINI_RATE_LIMITED',
      retryable: true,
    });
    return;
  }

  if (parsedError.isTemporaryUnavailable) {
    res.status(503).json({
      error:
        'Gemini is temporarily unavailable due to high demand. Please try again shortly.',
      code: 'GEMINI_TEMPORARILY_UNAVAILABLE',
      retryable: true,
    });
    return;
  }

  if (parsedError.statusCode === 401) {
    res.status(401).json({
      error:
        'Gemini API authentication failed. Check your GEMINI_API_KEY.',
      code: 'GEMINI_AUTH_ERROR',
      retryable: false,
    });
    return;
  }

  if (parsedError.statusCode === 403) {
    res.status(403).json({
      error:
        'Gemini API permission was denied. Check your API key and Google AI project.',
      code: 'GEMINI_PERMISSION_ERROR',
      retryable: false,
    });
    return;
  }

  if (parsedError.statusCode === 400) {
    res.status(400).json({
      error: parsedError.message || fallbackMessage,
      code: 'GEMINI_BAD_REQUEST',
      retryable: false,
    });
    return;
  }

  res.status(
    parsedError.statusCode >= 400 &&
    parsedError.statusCode < 600
      ? parsedError.statusCode
      : 500,
  ).json({
    error: parsedError.message || fallbackMessage,
    code: parsedError.code || 'GEMINI_ERROR',
    retryable: false,
  });
}

/* =========================================================
   Basic validation helpers
   ========================================================= */

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
}

function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    Math.max(Math.round(parsed), min),
    max,
  );
}

/* =========================================================
   1. Generate Comprehensive Notes
   ========================================================= */

app.post(
  '/api/generate-notes',
  async (req: Request, res: Response) => {
    try {
      const {
        topic,
        level = 'Undergraduate',
        focusArea = '',
        depth = 'Comprehensive',
      } = req.body;

      if (!isNonEmptyString(topic)) {
        res.status(400).json({
          error: 'Topic is required.',
          code: 'INVALID_TOPIC',
        });
        return;
      }

      const cleanTopic = topic.trim();

      const prompt = `You are a world-class academic educator and tutor.

Create a structured, high-yield, engaging study note document for the topic: "${cleanTopic}".

Target Academic Level: ${level}
Depth: ${depth}
${focusArea ? `Special Focus Area: ${focusArea}` : ''}

Provide thorough explanations, clear mental models, practical examples, formulas/definitions, and exam tips.`;

      const response =
        await generateWithGeminiFallback({
          contents: prompt,
          config: {
            systemInstruction:
              'You are an elite academic professor who writes crystal-clear, pedagogically sound, structured study guides with rich explanations and intuitive analogies.',
            responseMimeType:
              'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description:
                    'Engaging, academic title for the study notes',
                },
                topic: {
                  type: Type.STRING,
                  description:
                    'Subject or core topic',
                },
                level: {
                  type: Type.STRING,
                  description:
                    'Academic difficulty level',
                },
                estimatedReadTime: {
                  type: Type.STRING,
                  description:
                    'Estimated read time like 7 min',
                },
                summaryBrief: {
                  type: Type.STRING,
                  description:
                    'High-level 2-3 sentence executive synopsis of the topic',
                },
                prerequisites: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description:
                    'Key prior knowledge or foundational concepts helpful before learning this',
                },
                sections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      heading: {
                        type: Type.STRING,
                        description:
                          'Section title',
                      },
                      subheading: {
                        type: Type.STRING,
                        description:
                          'Sub-topic or core inquiry',
                      },
                      content: {
                        type: Type.STRING,
                        description:
                          'Detailed, highly readable markdown text with clear paragraphs, bolded key terms, bullet points, and real-world analogies.',
                      },
                      keyTakeaway: {
                        type: Type.STRING,
                        description:
                          'One-sentence golden rule or takeaway for this section',
                      },
                    },
                    required: [
                      'heading',
                      'content',
                      'keyTakeaway',
                    ],
                  },
                  description:
                    'Detailed study sections, typically 4 to 6 comprehensive sections',
                },
                keyTerms: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      term: {
                        type: Type.STRING,
                      },
                      definition: {
                        type: Type.STRING,
                      },
                      exampleOrFormula: {
                        type: Type.STRING,
                      },
                    },
                    required: [
                      'term',
                      'definition',
                    ],
                  },
                  description:
                    'Key vocabulary terms, formulas, or fundamental definitions',
                },
                misconceptions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      myth: {
                        type: Type.STRING,
                        description:
                          'Common student mistake or misconception',
                      },
                      reality: {
                        type: Type.STRING,
                        description:
                          'The scientifically/academically accurate fact',
                      },
                    },
                    required: [
                      'myth',
                      'reality',
                    ],
                  },
                  description:
                    'Common pitfalls and misconceptions students make',
                },
                examTips: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description:
                    'Strategic tips for answering exam or interview questions on this topic',
                },
                selfTestQuestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description:
                    '3-4 reflective self-check questions for active recall',
                },
              },
              required: [
                'title',
                'topic',
                'summaryBrief',
                'sections',
                'keyTerms',
                'misconceptions',
                'examTips',
              ],
            },
          },
        });

      const text = getResponseText(response);
      const data = parseJsonResponse(text);

      res.json(data);
    } catch (err: any) {
      sendApiError(
        res,
        err,
        'Failed to generate study notes.',
      );
    }
  },
);

/* =========================================================
   2. Summarize Notes
   ========================================================= */

app.post(
  '/api/summarize-notes',
  async (req: Request, res: Response) => {
    try {
      const {
        topic = 'Study Notes',
        notesText,
      } = req.body;

      if (!isNonEmptyString(notesText)) {
        res.status(400).json({
          error:
            'notesText is required to summarize.',
          code: 'INVALID_NOTES_TEXT',
        });
        return;
      }

      const cleanTopic =
        typeof topic === 'string' &&
        topic.trim()
          ? topic.trim()
          : 'Study Notes';

      const prompt = `Summarize the following study material on "${cleanTopic}".

Transform it into high-impact review formats:

1. Executive TL;DR
2. 5-7 core bullet takeaways
3. Active Recall Flashcards (front concept/question, back clear explanation)
4. Concept Map nodes (showing relationships between key ideas)
5. Quick revision cheat-sheet table

Source Material:
${notesText.slice(0, 15000)}`;

      const response =
        await generateWithGeminiFallback({
          contents: prompt,
          config: {
            systemInstruction:
              'You are an expert in active recall, spaced repetition, and cognitive study methods. Create crisp, high-yield summaries and flashcards.',
            responseMimeType:
              'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description:
                    'Summary Title',
                },
                executiveSummary: {
                  type: Type.STRING,
                  description:
                    'Concise 2-paragraph high-density summary',
                },
                keyBullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description:
                    '5-8 essential bullet takeaways',
                },
                flashcards: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: {
                        type: Type.STRING,
                      },
                      front: {
                        type: Type.STRING,
                        description:
                          'Question or concept prompt',
                      },
                      back: {
                        type: Type.STRING,
                        description:
                          'Concise answer, mechanism, or proof',
                      },
                      category: {
                        type: Type.STRING,
                        description:
                          'Tag or subtopic',
                      },
                    },
                    required: [
                      'id',
                      'front',
                      'back',
                    ],
                  },
                  description:
                    'Flashcards for spaced repetition',
                },
                conceptMap: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      concept: {
                        type: Type.STRING,
                      },
                      connectedTo: {
                        type: Type.STRING,
                      },
                      relationship: {
                        type: Type.STRING,
                        description:
                          'e.g. leads to, component of, enables, regulates',
                      },
                      note: {
                        type: Type.STRING,
                      },
                    },
                    required: [
                      'concept',
                      'connectedTo',
                      'relationship',
                    ],
                  },
                  description:
                    'Relational concept connections for mental mapping',
                },
                cheatSheet: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      key: {
                        type: Type.STRING,
                      },
                      value: {
                        type: Type.STRING,
                      },
                    },
                    required: [
                      'key',
                      'value',
                    ],
                  },
                  description:
                    'Quick lookup definitions / formulas',
                },
              },
              required: [
                'title',
                'executiveSummary',
                'keyBullets',
                'flashcards',
                'cheatSheet',
              ],
            },
          },
        });

      const text = getResponseText(response);
      const data = parseJsonResponse(text);

      res.json(data);
    } catch (err: any) {
      sendApiError(
        res,
        err,
        'Failed to summarize notes.',
      );
    }
  },
);

/* =========================================================
   3. Generate Interactive Quiz
   ========================================================= */

app.post(
  '/api/generate-quiz',
  async (req: Request, res: Response) => {
    try {
      const {
        topic,
        notesText = '',
        difficulty = 'Medium',
        questionCount = 6,
      } = req.body;

      if (!isNonEmptyString(topic)) {
        res.status(400).json({
          error: 'Topic is required.',
          code: 'INVALID_TOPIC',
        });
        return;
      }

      const count = clampInteger(
        questionCount,
        4,
        10,
        6,
      );

      const cleanTopic = topic.trim();

      const prompt = `Create an engaging, academically rigorous interactive quiz for the topic: "${cleanTopic}".

Difficulty Level: ${difficulty}
Total Questions: ${count}

${
  isNonEmptyString(notesText)
    ? `Ground the questions in the following reference notes if relevant:

${notesText.slice(0, 10000)}`
    : ''
}

Include a mix of:

1. Multiple Choice Questions (MCQ) with 4 plausible options, testing deep understanding rather than mere recall.
2. True / False with nuanced conceptual justification.
3. Short Answer / Conceptual checks with clear key grading criteria.

Ensure every question includes a thorough explanation that teaches why the correct answer is right and why the common alternatives are misleading.`;

      const response =
        await generateWithGeminiFallback({
          contents: prompt,
          config: {
            systemInstruction:
              'You are an expert psychometrician and educator who designs fair, insightful test questions that test application and reasoning.',
            responseMimeType:
              'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description:
                    'Quiz Title',
                },
                topic: {
                  type: Type.STRING,
                },
                difficulty: {
                  type: Type.STRING,
                },
                recommendedTimeMinutes: {
                  type: Type.INTEGER,
                  description:
                    'Recommended completion time in minutes',
                },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: {
                        type: Type.STRING,
                        description:
                          'Unique question id e.g. q1, q2',
                      },
                      type: {
                        type: Type.STRING,
                        description:
                          'Question format: mcq, true_false, or short_answer',
                      },
                      question: {
                        type: Type.STRING,
                        description:
                          'The question text',
                      },
                      options: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.STRING,
                        },
                        description:
                          'For MCQ: array of 4 distinct choices. For true_false: ["True", "False"]. Empty for short_answer.',
                      },
                      correctAnswer: {
                        type: Type.STRING,
                        description:
                          'The exact string matching the correct option or key model answer',
                      },
                      explanation: {
                        type: Type.STRING,
                        description:
                          'Comprehensive pedagogical explanation of the solution',
                      },
                      hint: {
                        type: Type.STRING,
                        description:
                          'Subtle nudge hint if the student is stuck',
                      },
                      conceptTested: {
                        type: Type.STRING,
                        description:
                          'The specific concept or skill being measured',
                      },
                    },
                    required: [
                      'id',
                      'type',
                      'question',
                      'correctAnswer',
                      'explanation',
                      'conceptTested',
                    ],
                  },
                },
              },
              required: [
                'title',
                'topic',
                'difficulty',
                'questions',
              ],
            },
          },
        });

      const text = getResponseText(response);
      const data = parseJsonResponse(text);

      /*
       * Basic server-side validation so malformed AI output
       * doesn't silently reach the React app.
       */
      if (
        !data ||
        !Array.isArray(data.questions) ||
        data.questions.length === 0
      ) {
        throw new GeminiApiError(
          'Gemini returned an invalid quiz structure.',
          {
            statusCode: 502,
            code: 'INVALID_QUIZ_RESPONSE',
          },
        );
      }

      res.json(data);
    } catch (err: any) {
      sendApiError(
        res,
        err,
        'Failed to generate quiz.',
      );
    }
  },
);

/* =========================================================
   4. AI Evaluation for Short-Answer Quiz Questions
   ========================================================= */

app.post(
  '/api/evaluate-answer',
  async (req: Request, res: Response) => {
    try {
      const {
        question,
        expectedAnswer,
        userAnswer,
        conceptTested,
      } = req.body;

      if (
        !isNonEmptyString(question) ||
        !isNonEmptyString(userAnswer)
      ) {
        res.status(400).json({
          error:
            'Question and userAnswer are required.',
          code: 'INVALID_ANSWER_REQUEST',
        });
        return;
      }

      const prompt = `You are evaluating a student's answer to an open-ended quiz question.

Question:
${question}

Concept Tested:
${conceptTested || 'Core Concept'}

Expected / Model Answer:
${expectedAnswer || 'Not provided'}

Student's Submitted Answer:
"${userAnswer}"

Grade the student constructively:

1. Is it substantially correct? (boolean)
2. Score out of 100 based on understanding of core principles.
3. Brief encouraging feedback explaining what they understood well and any subtle nuance or detail they missed.`;

      const response =
        await generateWithGeminiFallback({
          contents: prompt,
          config: {
            responseMimeType:
              'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isCorrect: {
                  type: Type.BOOLEAN,
                },
                score: {
                  type: Type.INTEGER,
                  description:
                    'Score between 0 and 100',
                },
                feedback: {
                  type: Type.STRING,
                  description:
                    'Supportive, educational feedback',
                },
                keyMissingPoints: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description:
                    'Points missed or could be strengthened (if any)',
                },
              },
              required: [
                'isCorrect',
                'score',
                'feedback',
              ],
            },
          },
        });

      const text = getResponseText(response);
      const data = parseJsonResponse(text);

      res.json(data);
    } catch (err: any) {
      sendApiError(
        res,
        err,
        'Failed to evaluate answer.',
      );
    }
  },
);

/* =========================================================
   5. Ask Study Tutor / Clarify Concept
   ========================================================= */

app.post(
  '/api/ask-tutor',
  async (req: Request, res: Response) => {
    try {
      const {
        topic,
        contextSnippet,
        question,
        mode = 'explain',
      } = req.body;

      if (!isNonEmptyString(question)) {
        res.status(400).json({
          error: 'Question is required.',
          code: 'INVALID_TUTOR_QUESTION',
        });
        return;
      }

      let styleInstruction =
        'Provide a clear, engaging explanation suitable for a curious student.';

      if (mode === 'eli5') {
        styleInstruction =
          'Explain using a simple, intuitive real-world analogy as if explaining to a beginner or child (ELI5).';
      } else if (mode === 'exam_prep') {
        styleInstruction =
          'Explain how to write a top-scoring exam answer on this specific aspect.';
      }

      const prompt = `Topic: ${topic || 'General'}

${
  contextSnippet
    ? `Context from Study Notes: "${String(
        contextSnippet,
      ).slice(0, 8000)}"\n`
    : ''
}

Student's Question:
"${question}"

Instruction:
${styleInstruction}`;

      const response =
        await generateWithGeminiFallback({
          contents: prompt,
          config: {
            systemInstruction:
              'You are an encouraging, patient, brilliant personal study tutor. Keep responses concise, formatted with clean bullets, and easy to absorb.',
          },
        });

      res.json({
        answer:
          getResponseText(response) ||
          'No response generated.',
      });
    } catch (err: any) {
      sendApiError(
        res,
        err,
        'Failed to get tutor answer.',
      );
    }
  },
);

/* =========================================================
   Health check
   ========================================================= */

app.get(
  '/api/health',
  (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'study-app-server',
      geminiConfigured:
        Boolean(
          process.env.GEMINI_API_KEY?.trim(),
        ),
    });
  },
);

/* =========================================================
   Vite / production frontend
   ========================================================= */

async function startServer() {
  const isProduction =
    process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const {
      createServer: createViteServer,
    } = await import('vite');

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(
      __dirname,
      'dist',
    );

    app.use(
      express.static(distPath),
    );

    app.get(
      '*',
      (_req: Request, res: Response) => {
        res.sendFile(
          path.resolve(
            distPath,
            'index.html',
          ),
        );
      },
    );
  }

  app.listen(
    PORT,
    '0.0.0.0',
    () => {
      console.log(
        `Server running on http://0.0.0.0:${PORT}`,
      );
    },
  );
}

/* =========================================================
   Startup
   ========================================================= */

startServer().catch((err) => {
  console.error(
    'Failed to start server:',
    err,
  );

  process.exit(1);
});
