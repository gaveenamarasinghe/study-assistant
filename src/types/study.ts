export interface NoteSection {
  heading: string;
  subheading?: string;
  content: string;
  keyTakeaway: string;
}

export interface KeyTerm {
  term: string;
  definition: string;
  exampleOrFormula?: string;
}

export interface Misconception {
  myth: string;
  reality: string;
}

export interface StudyNotes {
  id: string;
  topic: string;
  title: string;
  level: string;
  estimatedReadTime?: string;
  summaryBrief: string;
  prerequisites?: string[];
  sections: NoteSection[];
  keyTerms: KeyTerm[];
  misconceptions: Misconception[];
  examTips: string[];
  selfTestQuestions?: string[];
  createdAt: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
}

export interface ConceptConnection {
  concept: string;
  connectedTo: string;
  relationship: string;
  note?: string;
}

export interface CheatSheetItem {
  key: string;
  value: string;
}

export interface SummaryData {
  title: string;
  executiveSummary: string;
  keyBullets: string[];
  flashcards: Flashcard[];
  conceptMap?: ConceptConnection[];
  cheatSheet: CheatSheetItem[];
  generatedFromTopic?: string;
  createdAt: number;
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'true_false' | 'short_answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  hint?: string;
  conceptTested: string;
}

export interface QuizData {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  recommendedTimeMinutes?: number;
  questions: QuizQuestion[];
  createdAt: number;
}

export interface QuestionEvaluation {
  isCorrect: boolean;
  score: number;
  feedback: string;
  keyMissingPoints?: string[];
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  topic: string;
  score: number;
  total: number;
  percentage: number;
  userAnswers: Record<string, string>;
  evaluations?: Record<string, QuestionEvaluation>;
  timeSpentSeconds: number;
  completedAt: number;
}

export interface SavedStudyTopic {
  id: string;
  topic: string;
  level: string;
  notes?: StudyNotes;
  summary?: SummaryData;
  quiz?: QuizData;
  bestQuizScore?: number;
  updatedAt: number;
}
