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

// Load .env explicitly from the project root
const envPath = path.resolve(process.cwd(), ".env");

dotenv.config({
  path: envPath,
  override: true,
});

console.log("======================================");
console.log("Starting server...");
console.log("Working directory:", process.cwd());
console.log(".env path:", envPath);
console.log(
  "GEMINI_API_KEY:",
  process.env.GEMINI_API_KEY ? "LOADED" : "NOT LOADED"
);
console.log("======================================");


// ============================================================
// GEMINI CONFIGURATION
// ============================================================

// Primary model
const PRIMARY_MODEL = "gemini-3.8-flash";

// Fallback models
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
      "GEMINI_API_KEY is missing or empty. Check your .env file."
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
  // 3s, 6s, 12s, 24s, 30s max
  const base = Math.min(30000, 3000 * Math.pow(2, attempt));

  // Small random amount prevents multiple requests retrying
  // at exactly the same time.
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
  maxRetries = 5
): Promise<any> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Gemini] Model: ${model} | Attempt: ${attempt + 1}/${maxRetries + 1}`
      );

      const response = await client.models.generateContent({
        ...params,
        model,
      });

      console.log(`[Gemini] Success using ${model}`);

      return response;
    } catch (error) {
      lastError = error;

      const errorText = getErrorText(error);

      console.error(
        `[Gemini] ${model} failed on attempt ${attempt + 1}:`,
        errorText
      );

      // Do not retry permanent errors.
      if (!isRetryableGeminiError(error)) {
        throw error;
      }

      // Finished retrying this model.
      if (attempt >= maxRetries) {
        console.error(
          `[Gemini] ${model} failed after ${maxRetries + 1} attempts.`
        );
        break;
      }

      const delay = getBackoffDelay(attempt);

      console.log(
        `[Gemini] Temporary error. Retrying ${model} in ${delay}ms...`
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
        4
      );
    } catch (error) {
      lastError = error;

      const errorText = getErrorText(error);

      console.error(
        `[Gemini] Model ${model} unavailable:`,
        errorText
      );

      // If this is not a temporary error, stop immediately.
      if (!isRetryableGeminiError(error)) {
        throw error;
      }

      // Otherwise move to the next model.
      console.log(
        `[Gemini] Trying fallback model after ${model}...`
      );
    }
  }

  throw lastError;
}


// ============================================================
// RESPONSE TEXT HELPER
// ============================================================

function getResponseText(response: any): string {
  const text = response?.text;

  if (typeof text === "string" && text.trim()) {
    return text.trim();
  }

  // Some SDK versions expose the text through candidates.
  const candidateText =
    response?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || "")
      .join("")
      .trim();

  if (candidateText) {
    return candidateText;
  }

  throw new Error("Gemini returned an empty response.");
}


// ============================================================
// JSON PARSER
// ============================================================

function parseGeminiJson(response: any): any {
  const text = getResponseText(response);

  // Remove markdown code fences if Gemini returns them.
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to parse Gemini JSON:");
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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));


// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    geminiKeyLoaded: Boolean(
      process.env.GEMINI_API_KEY?.trim()
    ),
    primaryModel: PRIMARY_MODEL,
    fallbackModels: FALLBACK_MODELS,
  });
});


// ============================================================
// YOUR EXISTING ROUTES
// ============================================================
//
// IMPORTANT:
// Keep your existing /api/generate-notes,
// /api/summarize-notes,
// /api/generate-quiz,
// /api/evaluate-answer,
// /api/ask-tutor routes.
//
// The ONLY important change inside those routes is:
//
// OLD:
//
// const response = await generateWithRetry({
//   model: "gemini-3.8-flash",
//   contents: prompt,
//   config: {...}
// });
//
// NEW:
//
// const response = await generateWithRetry({
//   contents: prompt,
//   config: {...}
// });
//
// Notice that "model" is removed.
//
// generateWithRetry() automatically tries:
//
// 1. gemini-3.8-flash
// 2. gemini-3.7-flash
// 3. gemini-3.6-flash
//
// and retries temporary 503/429 errors before switching models.
//
// ============================================================


// ============================================================
// EXAMPLE: GENERATE NOTES
// ============================================================
//
// Replace the body of your existing generate-notes route
// with your existing prompt/schema if necessary.
//
// ============================================================

app.post(
  "/api/generate-notes",
  async (req: Request, res: Response) => {
    try {
      const { text, content } = req.body;

      const sourceText = text || content;

      if (!sourceText || !String(sourceText).trim()) {
        return res.status(400).json({
          error: "Text/content is required.",
        });
      }

      const prompt = `
Create clear study notes from the following material.

Return useful, accurate notes with:
- Main topics
- Important concepts
- Key points
- Definitions
- Examples where useful

Study material:

${String(sourceText)}
`;

      const response = await generateWithRetry({
        contents: prompt,

        config: {
          responseMimeType: "application/json",

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

      const result = parseGeminiJson(response);

      return res.json(result);

    } catch (error) {
      console.error(
        "Error generating notes:",
        error
      );

      return res.status(503).json({
        error:
          "Gemini is temporarily busy. Please try again in a few seconds.",
      });
    }
  }
);


// ============================================================
// EXAMPLE: SUMMARIZE NOTES
// ============================================================

app.post(
  "/api/summarize-notes",
  async (req: Request, res: Response) => {
    try {
      const { text, content } = req.body;

      const sourceText = text || content;

      if (!sourceText || !String(sourceText).trim()) {
        return res.status(400).json({
          error: "Text/content is required.",
        });
      }

      const prompt = `
Summarize the following study material.

Create:
- A concise summary
- The most important concepts
- Important facts to remember
- Key takeaways

Material:

${String(sourceText)}
`;

      const response = await generateWithRetry({
        contents: prompt,

        config: {
          responseMimeType: "application/json",

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

      const result = parseGeminiJson(response);

      return res.json(result);

    } catch (error) {
      console.error(
        "Error summarizing notes:",
        error
      );

      return res.status(503).json({
        error:
          "Gemini is temporarily busy. Please try again in a few seconds.",
      });
    }
  }
);


// ============================================================
// EXAMPLE: GENERATE QUIZ
// ============================================================

app.post(
  "/api/generate-quiz",
  async (req: Request, res: Response) => {
    try {
      const { text, content, numberOfQuestions } =
        req.body;

      const sourceText = text || content;

      if (!sourceText || !String(sourceText).trim()) {
        return res.status(400).json({
          error: "Text/content is required.",
        });
      }

      const count =
        Number(numberOfQuestions) > 0
          ? Math.min(Number(numberOfQuestions), 20)
          : 10;

      const prompt = `
Create a study quiz from the following material.

Generate exactly ${count} multiple-choice questions.

Each question must contain:
- question
- four answer options
- correct answer
- explanation

Only use information from the supplied material.

Material:

${String(sourceText)}
`;

      const response = await generateWithRetry({
        contents: prompt,

        config: {
          responseMimeType: "application/json",

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

      const result = parseGeminiJson(response);

      return res.json(result);

    } catch (error) {
      console.error(
        "Error generating quiz:",
        error
      );

      return res.status(503).json({
        error:
          "Gemini is temporarily busy. Please try again in a few seconds.",
      });
    }
  }
);


// ============================================================
// EXAMPLE: EVALUATE ANSWER
// ============================================================

app.post(
  "/api/evaluate-answer",
  async (req: Request, res: Response) => {
    try {
      const {
        question,
        answer,
        correctAnswer,
      } = req.body;

      if (!question || !answer) {
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

Return a fair evaluation with:
- whether the answer is correct
- score from 0 to 100
- explanation
- improvement advice
`;

      const response = await generateWithRetry({
        contents: prompt,

        config: {
          responseMimeType: "application/json",

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

      const result = parseGeminiJson(response);

      return res.json(result);

    } catch (error) {
      console.error(
        "Error evaluating answer:",
        error
      );

      return res.status(503).json({
        error:
          "Gemini is temporarily busy. Please try again in a few seconds.",
      });
    }
  }
);


// ============================================================
// EXAMPLE: ASK TUTOR
// ============================================================

app.post(
  "/api/ask-tutor",
  async (req: Request, res: Response) => {
    try {
      const {
        question,
        context,
        notes,
      } = req.body;

      if (!question || !String(question).trim()) {
        return res.status(400).json({
          error: "Question is required.",
        });
      }

      const prompt = `
You are a helpful study tutor.

Answer the student's question clearly and accurately.

Use the supplied study material when available.
Explain difficult concepts simply.
Do not invent facts that are not supported by the material.

Study material:
${context || notes || "No additional material supplied."}

Student question:
${question}
`;

      const response = await generateWithRetry({
        contents: prompt,

        config: {
          responseMimeType: "application/json",

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

      const result = parseGeminiJson(response);

      return res.json(result);

    } catch (error) {
      console.error(
        "Error asking tutor:",
        error
      );

      return res.status(503).json({
        error:
          "Gemini is temporarily busy. Please try again in a few seconds.",
      });
    }
  }
);


// ============================================================
// VITE
// ============================================================

async function startServer() {
  const isProduction =
    process.env.NODE_ENV === "production";

  if (!isProduction) {
    const { createServer: createViteServer } =
      await import("vite");

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },

      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(
      __dirname,
      "dist"
    );

    app.use(
      express.static(distPath)
    );

    app.get("*", (_req, res) => {
      res.sendFile(
        path.join(distPath, "index.html")
      );
    });
  }

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
        `Server running on http://localhost:${PORT}`
      );
      console.log(
        `Primary model: ${PRIMARY_MODEL}`
      );
      console.log(
        `Fallback models: ${FALLBACK_MODELS.join(", ")}`
      );
      console.log(
        "Gemini API key: " +
          (process.env.GEMINI_API_KEY
            ? "LOADED"
            : "MISSING")
      );
      console.log(
        "======================================"
      );
      console.log("");
    }
  );
}


// ============================================================
// START
// ============================================================

startServer().catch((error) => {
  console.error(
    "Failed to start server:",
    error
  );

  process.exit(1);
});
