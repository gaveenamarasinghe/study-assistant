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

// Helper to instantiate Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Resilient wrapper with exponential backoff for transient 503 / high demand spikes
async function generateWithRetry(params: any, retries = 3, delayMs = 1500): Promise<any> {
  const ai = getGeminiClient();
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const errStr = String(err?.message || err);
      const isTransient = errStr.includes('503') || errStr.includes('high demand') || errStr.includes('UNAVAILABLE') || errStr.includes('ResourceExhausted') || errStr.includes('429');
      if (isTransient && attempt < retries) {
        console.warn(`Attempt ${attempt} encountered transient error, retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }
      throw err;
    }
  }
}

// 1. Generate Comprehensive Notes
app.post('/api/generate-notes', async (req: Request, res: Response) => {
  try {
    const { topic, level = 'Undergraduate', focusArea = '', depth = 'Comprehensive' } = req.body;
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      res.status(400).json({ error: 'Topic is required.' });
      return;
    }

    const prompt = `You are a world-class academic educator and tutor.
Create a structured, high-yield, engaging study note document for the topic: "${topic.trim()}".
Target Academic Level: ${level}
Depth: ${depth}
${focusArea ? `Special Focus Area: ${focusArea}` : ''}

Provide thorough explanations, clear mental models, practical examples, formulas/definitions, and exam tips.`;

    const response = await generateWithRetry({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an elite academic professor who writes crystal-clear, pedagogically sound, structured study guides with rich explanations and intuitive analogies.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Engaging, academic title for the study notes' },
            topic: { type: Type.STRING, description: 'Subject or core topic' },
            level: { type: Type.STRING, description: 'Academic difficulty level' },
            estimatedReadTime: { type: Type.STRING, description: 'Estimated read time like 7 min' },
            summaryBrief: { type: Type.STRING, description: 'High-level 2-3 sentence executive synopsis of the topic' },
            prerequisites: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Key prior knowledge or foundational concepts helpful before learning this',
            },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  heading: { type: Type.STRING, description: 'Section title' },
                  subheading: { type: Type.STRING, description: 'Sub-topic or core inquiry' },
                  content: {
                    type: Type.STRING,
                    description: 'Detailed, highly readable markdown text with clear paragraphs, bolded key terms, bullet points, and real-world analogies.',
                  },
                  keyTakeaway: { type: Type.STRING, description: 'One-sentence golden rule or takeaway for this section' },
                },
                required: ['heading', 'content', 'keyTakeaway'],
              },
              description: 'Detailed study sections (typically 4 to 6 comprehensive sections)',
            },
            keyTerms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  exampleOrFormula: { type: Type.STRING },
                },
                required: ['term', 'definition'],
              },
              description: 'Key vocabulary terms, formulas, or fundamental definitions',
            },
            misconceptions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  myth: { type: Type.STRING, description: 'Common student mistake or misconception' },
                  reality: { type: Type.STRING, description: 'The scientifically/academically accurate fact' },
                },
                required: ['myth', 'reality'],
              },
              description: 'Common pitfalls and misconceptions students make',
            },
            examTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Strategic tips for answering exam or interview questions on this topic',
            },
            selfTestQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3-4 reflective self-check questions for active recall',
            },
          },
          required: ['title', 'topic', 'summaryBrief', 'sections', 'keyTerms', 'misconceptions', 'examTips'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No content returned from AI');
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (err: any) {
    console.error('Error generating notes:', err);
    res.status(500).json({ error: err.message || 'Failed to generate study notes.' });
  }
});

// 2. Summarize Notes (From generated notes or user-pasted text)
app.post('/api/summarize-notes', async (req: Request, res: Response) => {
  try {
    const { topic = 'Study Notes', notesText } = req.body;
    if (!notesText || typeof notesText !== 'string' || !notesText.trim()) {
      res.status(400).json({ error: 'notesText is required to summarize.' });
      return;
    }

    const prompt = `Summarize the following study material on "${topic}".
Transform it into high-impact review formats:
1. Executive TL;DR
2. 5-7 core bullet takeaways
3. Active Recall Flashcards (front concept/question, back clear explanation)
4. Concept Map nodes (showing relationships between key ideas)
5. Quick revision cheat-sheet table

Source Material:
${notesText.slice(0, 15000)}`;

    const response = await generateWithRetry({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert in active recall, spaced repetition, and cognitive study methods. Create crisp, high-yield summaries and flashcards.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Summary Title' },
            executiveSummary: { type: Type.STRING, description: 'Concise 2-paragraph high-density summary' },
            keyBullets: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '5-8 essential bullet takeaways',
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  front: { type: Type.STRING, description: 'Question or concept prompt' },
                  back: { type: Type.STRING, description: 'Concise answer, mechanism, or proof' },
                  category: { type: Type.STRING, description: 'Tag or subtopic' },
                },
                required: ['id', 'front', 'back'],
              },
              description: 'Flashcards for spaced repetition',
            },
            conceptMap: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  concept: { type: Type.STRING },
                  connectedTo: { type: Type.STRING },
                  relationship: { type: Type.STRING, description: 'e.g. leads to, component of, enables, regulates' },
                  note: { type: Type.STRING },
                },
                required: ['concept', 'connectedTo', 'relationship'],
              },
              description: 'Relational concept connections for mental mapping',
            },
            cheatSheet: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  value: { type: Type.STRING },
                },
                required: ['key', 'value'],
              },
              description: 'Quick lookup definitions / formulas',
            },
          },
          required: ['title', 'executiveSummary', 'keyBullets', 'flashcards', 'cheatSheet'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No content returned from AI');
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (err: any) {
    console.error('Error summarizing notes:', err);
    res.status(500).json({ error: err.message || 'Failed to summarize notes.' });
  }
});

// 3. Generate Interactive Quiz
app.post('/api/generate-quiz', async (req: Request, res: Response) => {
  try {
    const {
      topic,
      notesText = '',
      difficulty = 'Medium',
      questionCount = 6,
    } = req.body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      res.status(400).json({ error: 'Topic is required.' });
      return;
    }

    const prompt = `Create an engaging, academically rigorous interactive quiz for the topic: "${topic.trim()}".
Difficulty Level: ${difficulty}
Total Questions: ${Math.min(Math.max(questionCount, 4), 10)}
${notesText ? `Ground the questions in the following reference notes if relevant:\n${notesText.slice(0, 10000)}` : ''}

Include a mix of:
1. Multiple Choice Questions (MCQ) with 4 plausible options, testing deep understanding rather than mere recall.
2. True / False with nuanced conceptual justification.
3. Short Answer / Conceptual checks with clear key grading criteria.

Ensure every question includes a thorough explanation that teaches why the correct answer is right and why the common alternatives are misleading.`;

    const response = await generateWithRetry({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert psychometrician and educator who designs fair, insightful test questions that test application and reasoning.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Quiz Title' },
            topic: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            recommendedTimeMinutes: { type: Type.INTEGER, description: 'Recommended completion time in minutes' },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Unique question id e.g. q1, q2' },
                  type: {
                    type: Type.STRING,
                    description: 'Question format: "mcq", "true_false", or "short_answer"',
                  },
                  question: { type: Type.STRING, description: 'The question text' },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'For MCQ: array of 4 distinct choices. For true_false: ["True", "False"]. Empty for short_answer.',
                  },
                  correctAnswer: {
                    type: Type.STRING,
                    description: 'The exact string matching the correct option or key model answer',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'Comprehensive pedagogical explanation of the solution',
                  },
                  hint: { type: Type.STRING, description: 'Subtle nudge hint if the student is stuck' },
                  conceptTested: { type: Type.STRING, description: 'The specific concept or skill being measured' },
                },
                required: ['id', 'type', 'question', 'correctAnswer', 'explanation', 'conceptTested'],
              },
            },
          },
          required: ['title', 'topic', 'difficulty', 'questions'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No content returned from AI');
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (err: any) {
    console.error('Error generating quiz:', err);
    res.status(500).json({ error: err.message || 'Failed to generate quiz.' });
  }
});

// 4. AI Evaluation for Short-Answer Quiz Questions
app.post('/api/evaluate-answer', async (req: Request, res: Response) => {
  try {
    const { question, expectedAnswer, userAnswer, conceptTested } = req.body;

    if (!question || !userAnswer) {
      res.status(400).json({ error: 'Question and userAnswer are required.' });
      return;
    }

    const prompt = `You are evaluating a student's answer to an open-ended quiz question.
Question: ${question}
Concept Tested: ${conceptTested || 'Core Concept'}
Expected / Model Answer: ${expectedAnswer}

Student's Submitted Answer:
"${userAnswer}"

Grade the student constructively:
1. Is it substantially correct? (boolean)
2. Score out of 100 based on understanding of core principles.
3. Brief encouraging feedback explaining what they understood well and any subtle nuance or detail they missed.`;

    const response = await generateWithRetry({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            score: { type: Type.INTEGER, description: 'Score between 0 and 100' },
            feedback: { type: Type.STRING, description: 'Supportive, educational feedback' },
            keyMissingPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Points missed or could be strengthened (if any)',
            },
          },
          required: ['isCorrect', 'score', 'feedback'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No content returned from AI');
    }

    res.json(JSON.parse(text));
  } catch (err: any) {
    console.error('Error evaluating answer:', err);
    res.status(500).json({ error: err.message || 'Failed to evaluate answer.' });
  }
});

// 5. Ask Study Tutor / Clarify Concept
app.post('/api/ask-tutor', async (req: Request, res: Response) => {
  try {
    const { topic, contextSnippet, question, mode = 'explain' } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Question is required.' });
      return;
    }

    let styleInstruction = 'Provide a clear, engaging explanation suitable for a curious student.';
    if (mode === 'eli5') {
      styleInstruction = 'Explain using a simple, intuitive real-world analogy as if explaining to a beginner or child (ELI5).';
    } else if (mode === 'exam_prep') {
      styleInstruction = 'Explain how to write a top-scoring exam answer on this specific aspect.';
    }

    const prompt = `Topic: ${topic || 'General'}
${contextSnippet ? `Context from Study Notes: "${contextSnippet}"\n` : ''}
Student's Question: "${question}"

Instruction: ${styleInstruction}`;

    const response = await generateWithRetry({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an encouraging, patient, brilliant personal study tutor. Keep responses concise, formatted with clean bullets, and easy to absorb.',
      },
    });

    res.json({ answer: response.text || 'No response generated.' });
  } catch (err: any) {
    console.error('Error asking tutor:', err);
    res.status(500).json({ error: err.message || 'Failed to get tutor answer.' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
