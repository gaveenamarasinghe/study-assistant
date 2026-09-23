import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// ============================================================
// ENVIRONMENT
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env locally.
// On Vercel, GEMINI_API_KEY comes from Vercel Environment Variables.
if (!process.env.VERCEL) {
  const envPath = path.resolve(process.cwd(), ".env");

  dotenv.config({
    path: envPath,
    override: false,
  });

  console.log("======================================");
  console.log("Local environment");
  console.log("Working directory:", process.cwd());
  console.log(".env path:", envPath);
  console.log(
    "GEMINI_API_KEY:",
    process.env.GEMINI_API_KEY ? "LOADED" : "NOT LOADED"
  );
  console.log("======================================");
}

// ============================================================
// GEMINI CONFIGURATION
// ============================================================

const PRIMARY_MODEL = "gemini-3.8-flash";

const FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

// ============================================================
// GEMINI CLIENT
// ============================================================

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add GEMINI_API_KEY to Vercel Environment Variables."
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
}

// ============================================================
// ERROR HELPERS
// ============================================================

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRetryableGeminiError(error: unknown): boolean {
  const message = getErrorText(error).toLowerCase();

  return (
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("high demand") ||
    message.includes("temporarily") ||
    message.includes("resource exhausted") ||
    message.includes("resourceexhausted") ||
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  );
}

// ============================================================
// WAIT / BACKOFF
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number): number {
  const base = Math.min(
    30000,
    3000 * Math.pow(2, attempt)
  );

  const jitter = Math.floor(Math.random() * 1000);

  return base + jitter;
}

// ============================================================
// GEMINI REQUEST
// ============================================================

async function generateWithModel(
  client: GoogleGenAI,
  model: string,
  params: any,
  maxRetries = 3
): Promise<any> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      console.log(
        `[Gemini] ${model} attempt ${attempt + 1}/${maxRetries + 1}`
      );

      const response =
        await client.models.generateContent({
          ...params,
          model,
        });

      console.log(
        `[Gemini] Success using ${model}`
      );

      return response;
    } catch (error) {
      lastError = error;

      console.error(
        `[Gemini] ${model} failed:`,
        getErrorText(error)
      );

      if (!isRetryableGeminiError(error)) {
        throw error;
      }

      if (attempt >= maxRetries) {
        break;
      }

      const delay = getBackoffDelay(attempt);

      console.log(
        `[Gemini] Retrying ${model} in ${delay}ms`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

// ============================================================
// GEMINI REQUEST WITH FALLBACK MODELS
// ============================================================

async function generateWithRetry(
  params: any
): Promise<any> {
  const client = getGeminiClient();

  const models = [
    PRIMARY_MODEL,
    ...FALLBACK_MODELS,
  ];

  let lastError: unknown;

  for (const model of models) {
    try {
      return await generateWithModel(
        client,
        model,
        params,
        3
      );
    } catch (error) {
      lastError = error;

      console.error(
        `[Gemini] ${model} failed completely:`,
        getErrorText(error)
      );

      if (!isRetryableGeminiError(error)) {
        throw error;
      }

      console.log(
        `[Gemini] Moving to fallback model...`
      );
    }
  }

  throw lastError;
}

// ============================================================
// RESPONSE TEXT
// ============================================================

function getResponseText(
  response: any
): string {
  const text = response?.text;

  if (
    typeof text === "string" &&
    text.trim()
  ) {
    return text.trim();
  }

  const candidateText =
    response?.candidates?.[0]?.content?.parts
      ?.map(
        (part: any) =>
          part?.text || ""
      )
      .join("")
      .trim();

  if (candidateText) {
    return candidateText;
  }

  throw new Error(
    "Gemini returned an empty response."
  );
}

// ============================================================
// JSON PARSER
// ============================================================

function parseGeminiJson(
  response: any
): any {
  const text = getResponseText(response);

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error(
      "Gemini returned invalid JSON:"
    );

    console.error(cleaned);

    throw new Error(
      "Gemini returned invalid JSON."
    );
  }
}

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  "/api/health",
  (_req: Request, res: Response) => {
    res.json({
      success: true,

      geminiKeyLoaded:
        Boolean(
          process.env.GEMINI_API_KEY?.trim()
        ),

      primaryModel:
        PRIMARY_MODEL,

      fallbackModels:
        FALLBACK_MODELS,

      environment:
        process.env.VERCEL
          ? "vercel"
          : "local",
    });
  }
);

// ============================================================
// GENERATE NOTES
// ============================================================

app.post(
  "/api/generate-notes",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        text,
        content,
        topic,
        level,
        depth,
        focusArea,
      } = req.body;

      const sourceText =
        text ||
        content ||
        topic;

      if (
        !sourceText ||
        !String(sourceText).trim()
      ) {
        return res.status(400).json({
          error:
            "Text/content is required.",
        });
      }

      const prompt = `
Create comprehensive study notes.

Topic:
${topic || "General topic"}

Student level:
${level || "General"}

Depth:
${depth || "Detailed"}

Focus area:
${focusArea || "General"}

Study material:
${String(sourceText)}

Create clear, accurate, well-organized study notes.

Include:
- Main topics
- Important concepts
- Definitions
- Explanations
- Examples where useful
- Key points

Make the material easy for a student to study.
`;

      const response =
        await generateWithRetry({
          contents: prompt,

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                title: {
                  type: "string",
                },

                summary: {
                  type: "string",
                },

                sections: {
                  type: "array",

                  items: {
                    type: "object",

                    properties: {
                      heading: {
                        type: "string",
                      },

                      content: {
                        type: "string",
                      },

                      keyPoints: {
                        type: "array",

                        items: {
                          type: "string",
                        },
                      },
                    },

                    required: [
                      "heading",
                      "content",
                      "keyPoints",
                    ],
                  },
                },
              },

              required: [
                "title",
                "summary",
                "sections",
              ],
            },
          },
        });

      const result =
        parseGeminiJson(response);

      return res.json(result);
    } catch (error) {
      console.error(
        "Error generating notes:",
        getErrorText(error)
      );

      return res.status(500).json({
        error:
          getErrorText(error),
      });
    }
  }
);

// ============================================================
// SUMMARIZE NOTES
// ============================================================

app.post(
  "/api/summarize-notes",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        text,
        content,
        notesText,
      } = req.body;

      const sourceText =
        text ||
        content ||
        notesText;

      if (
        !sourceText ||
        !String(sourceText).trim()
      ) {
        return res.status(400).json({
          error:
            "Text/content is required.",
        });
      }

      const prompt = `
Summarize the following study material.

Create:
- A concise summary
- The most important concepts
- Important facts to remember
- Key takeaways

Study material:

${String(sourceText)}
`;

      const response =
        await generateWithRetry({
          contents: prompt,

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                summary: {
                  type: "string",
                },

                keyPoints: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                takeaways: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },
              },

              required: [
                "summary",
                "keyPoints",
                "takeaways",
              ],
            },
          },
        });

      const result =
        parseGeminiJson(response);

      return res.json(result);
    } catch (error) {
      console.error(
        "Error summarizing notes:",
        getErrorText(error)
      );

      return res.status(500).json({
        error:
          getErrorText(error),
      });
    }
  }
);

// ============================================================
// GENERATE QUIZ
// ============================================================

app.post(
  "/api/generate-quiz",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        text,
        content,
        notesText,
        numberOfQuestions,
        questionCount,
        topic,
        difficulty,
      } = req.body;

      const sourceText =
        text ||
        content ||
        notesText;

      if (
        !sourceText ||
        !String(sourceText).trim()
      ) {
        return res.status(400).json({
          error:
            "Text/content is required.",
        });
      }

      const requestedCount =
        numberOfQuestions ??
        questionCount;

      const count =
        Number(requestedCount) > 0
          ? Math.min(
              Number(requestedCount),
              20
            )
          : 6;

      const prompt = `
Create a study quiz.

Topic:
${topic || "General"}

Difficulty:
${difficulty || "Medium"}

Generate exactly ${count}
multiple-choice questions.

Each question must contain:
- question
- exactly four answer options
- correct answer
- explanation

Only use information from the supplied study material.

Study material:

${String(sourceText)}
`;

      const response =
        await generateWithRetry({
          contents: prompt,

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                questions: {
                  type: "array",

                  items: {
                    type: "object",

                    properties: {
                      question: {
                        type: "string",
                      },

                      options: {
                        type: "array",

                        items: {
                          type: "string",
                        },
                      },

                      correctAnswer: {
                        type: "string",
                      },

                      explanation: {
                        type: "string",
                      },
                    },

                    required: [
                      "question",
                      "options",
                      "correctAnswer",
                      "explanation",
                    ],
                  },
                },
              },

              required: [
                "questions",
              ],
            },
          },
        });

      const result =
        parseGeminiJson(response);

      return res.json(result);
    } catch (error) {
      console.error(
        "Error generating quiz:",
        getErrorText(error)
      );

      return res.status(500).json({
        error:
          getErrorText(error),
      });
    }
  }
);

// ============================================================
// EVALUATE ANSWER
// ============================================================

app.post(
  "/api/evaluate-answer",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        question,
        answer,
        correctAnswer,
      } = req.body;

      if (
        !question ||
        !answer
      ) {
        return res.status(400).json({
          error:
            "Question and answer are required.",
        });
      }

      const prompt = `
Evaluate the student's answer.

Question:
${question}

Student answer:
${answer}

Expected/correct answer:
${correctAnswer || "Not provided"}

Return:
- whether the answer is correct
- score from 0 to 100
- explanation
- feedback
`;

      const response =
        await generateWithRetry({
          contents: prompt,

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                correct: {
                  type: "boolean",
                },

                score: {
                  type: "number",
                },

                explanation: {
                  type: "string",
                },

                feedback: {
                  type: "string",
                },
              },

              required: [
                "correct",
                "score",
                "explanation",
                "feedback",
              ],
            },
          },
        });

      const result =
        parseGeminiJson(response);

      return res.json(result);
    } catch (error) {
      console.error(
        "Error evaluating answer:",
        getErrorText(error)
      );

      return res.status(500).json({
        error:
          getErrorText(error),
      });
    }
  }
);

// ============================================================
// ASK TUTOR
// ============================================================

app.post(
  "/api/ask-tutor",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        question,
        context,
        notes,
      } = req.body;

      if (
        !question ||
        !String(question).trim()
      ) {
        return res.status(400).json({
          error:
            "Question is required.",
        });
      }

      const prompt = `
You are a helpful study tutor.

Answer the student's question clearly
and accurately.

Use the supplied study material when available.

Explain difficult concepts simply.

Do not invent facts that are not supported
by the material.

Study material:

${context || notes || "No additional material supplied."}

Student question:

${question}
`;

      const response =
        await generateWithRetry({
          contents: prompt,

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                answer: {
                  type: "string",
                },

                keyPoints: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },
              },

              required: [
                "answer",
                "keyPoints",
              ],
            },
          },
        });

      const result =
        parseGeminiJson(response);

      return res.json(result);
    } catch (error) {
      console.error(
        "Error asking tutor:",
        getErrorText(error)
      );

      return res.status(500).json({
        error:
          getErrorText(error),
      });
    }
  }
);

// ============================================================
// LOCAL DEVELOPMENT
// ============================================================

async function startLocalServer() {
  const {
    createServer: createViteServer,
  } = await import("vite");

  const vite =
    await createViteServer({
      server: {
        middlewareMode: true,
      },

      appType: "spa",
    });

  app.use(vite.middlewares);

  const PORT =
    Number(process.env.PORT) || 3000;

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log("");
      console.log(
        "======================================"
      );
      console.log(
        `Local server: http://localhost:${PORT}`
      );
      console.log(
        `Primary model: ${PRIMARY_MODEL}`
      );
      console.log(
        `Fallback models: ${FALLBACK_MODELS.join(", ")}`
      );
      console.log(
        "Gemini API key:",
        process.env.GEMINI_API_KEY
          ? "LOADED"
          : "MISSING"
      );
      console.log(
        "======================================"
      );
      console.log("");
    }
  );
}

// ============================================================
// START LOCAL ONLY
// ============================================================

if (!process.env.VERCEL) {
  startLocalServer().catch(
    (error) => {
      console.error(
        "Failed to start local server:",
        error
      );

      process.exit(1);
    }
  );
}

// ============================================================
// VERCEL EXPORT
// ============================================================

// Vercel imports this Express application.
// Do not call app.listen() on Vercel.

export default app;
