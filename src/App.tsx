import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { NotesView } from './components/NotesView';
import { SummaryView } from './components/SummaryView';
import { QuizView } from './components/QuizView';
import { LibraryView } from './components/LibraryView';
import { NewTopicModal } from './components/NewTopicModal';
import { AskTutorModal } from './components/AskTutorModal';

import {
  loadSavedTopics,
  saveTopic,
  deleteTopic,
} from './utils/storage';

import {
  SavedStudyTopic,
  StudyNotes,
  SummaryData,
  QuizData,
} from './types/study';

import {
  Loader2,
  AlertCircle,
  Sparkles,
  BookOpen,
  Layers,
  Award,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type ActiveView = 'notes' | 'summary' | 'quiz' | 'library';

type GenerateTopicParams = {
  topic: string;
  level: string;
  depth: string;
  focusArea: string;
};

/* -------------------------------------------------------------------------- */
/* API helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Safely parse JSON from an API response.
 */
async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!text) {
    throw new Error(`Server returned an empty response (${res.status}).`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Server returned invalid JSON (${res.status}).`
    );
  }
}

/**
 * Convert backend/API errors into useful messages for the UI.
 */
function getApiErrorMessage(
  status: number,
  errorData?: unknown
): string {
  const data =
    errorData && typeof errorData === 'object'
      ? (errorData as Record<string, unknown>)
      : {};

  const rawMessage =
    typeof data.message === 'string'
      ? data.message
      : typeof data.error === 'string'
        ? data.error
        : '';

  const lowerMessage = rawMessage.toLowerCase();

  // Gemini daily quota exhausted.
  if (
    status === 429 &&
    (
      lowerMessage.includes('quota') ||
      lowerMessage.includes('resource_exhausted') ||
      lowerMessage.includes('generate_content_free_tier_requests') ||
      lowerMessage.includes('daily')
    )
  ) {
    return (
      'Gemini API quota has been exhausted for this project. ' +
      'Please enable billing/use a paid Gemini project, or wait until ' +
      'the quota resets before generating another quiz.'
    );
  }

  // Temporary Gemini overload.
  if (status === 503) {
    return (
      'The Gemini service is temporarily unavailable or overloaded. ' +
      'Please wait a moment and try again.'
    );
  }

  // Authentication.
  if (status === 401) {
    return (
      'Gemini API authentication failed. Check that your API key is ' +
      'configured correctly on the server.'
    );
  }

  // Permission / project configuration.
  if (status === 403) {
    return (
      'Gemini API access was denied. Check the API key, project, ' +
      'billing, and API permissions.'
    );
  }

  // Bad request.
  if (status === 400) {
    return (
      rawMessage ||
      'The request sent to the Gemini API was invalid.'
    );
  }

  // Generic server error.
  if (status >= 500) {
    return (
      rawMessage ||
      'The AI service encountered a server error. Please try again.'
    );
  }

  return (
    rawMessage ||
    `Request failed with HTTP ${status}.`
  );
}

/**
 * Make a POST request and provide consistent error handling.
 */
async function postJson<T>(
  url: string,
  body: unknown
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(`Network error calling ${url}:`, error);

    throw new Error(
      'Unable to connect to the server. Check your internet connection ' +
      'and make sure the backend is running.'
    );
  }

  let data: unknown = undefined;

  try {
    data = await parseResponse<unknown>(response);
  } catch (parseError) {
    if (!response.ok) {
      throw new Error(
        getApiErrorMessage(response.status)
      );
    }

    throw parseError;
  }

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(response.status, data)
    );
  }

  return data as T;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function isValidStudyNotes(value: unknown): value is StudyNotes {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const notes = value as Partial<StudyNotes>;

  return (
    typeof notes.title === 'string' &&
    typeof notes.summaryBrief === 'string' &&
    Array.isArray(notes.sections)
  );
}

function isValidSummary(value: unknown): value is SummaryData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.keys(value).length > 0;
}

function isValidQuiz(value: unknown): value is QuizData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const quiz = value as Record<string, unknown>;

  return (
    Array.isArray(quiz.questions) ||
    Array.isArray(quiz.items) ||
    Object.keys(quiz).length > 0
  );
}

/* -------------------------------------------------------------------------- */
/* App                                                                        */
/* -------------------------------------------------------------------------- */

export default function App() {
  /* ------------------------------------------------------------------------ */
  /* State                                                                    */
  /* ------------------------------------------------------------------------ */

  const [topics, setTopics] = useState<SavedStudyTopic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string>('');

  const [activeView, setActiveView] =
    useState<ActiveView>('notes');

  // Loading states
  const [isGeneratingNotes, setIsGeneratingNotes] =
    useState(false);

  const [isGeneratingSummary, setIsGeneratingSummary] =
    useState(false);

  const [isGeneratingQuiz, setIsGeneratingQuiz] =
    useState(false);

  // Modals
  const [isNewTopicModalOpen, setIsNewTopicModalOpen] =
    useState(false);

  const [isTutorModalOpen, setIsTutorModalOpen] =
    useState(false);

  const [tutorContextSnippet, setTutorContextSnippet] =
    useState<string | undefined>(undefined);

  // Error toast
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Initial load                                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    try {
      const loaded = loadSavedTopics();

      setTopics(Array.isArray(loaded) ? loaded : []);

      if (loaded.length > 0) {
        setActiveTopicId(loaded[0].id);
      }
    } catch (error) {
      console.error('Failed to load saved topics:', error);

      setTopics([]);
      setErrorMessage(
        'Unable to load your saved study topics.'
      );
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Current topic                                                             */
  /* ------------------------------------------------------------------------ */

  const currentTopic =
    topics.find((topic) => topic.id === activeTopicId) ||
    topics[0] ||
    null;

  /* ------------------------------------------------------------------------ */
  /* Utility functions                                                         */
  /* ------------------------------------------------------------------------ */

  const showError = (message: string) => {
    setErrorMessage(message);

    // Automatically remove the toast after 8 seconds.
    window.setTimeout(() => {
      setErrorMessage((current) =>
        current === message ? null : current
      );
    }, 8000);
  };

  const refreshTopics = () => {
    try {
      const updated = loadSavedTopics();
      setTopics(Array.isArray(updated) ? updated : []);
      return updated;
    } catch (error) {
      console.error('Failed to refresh topics:', error);
      return topics;
    }
  };

  /* ------------------------------------------------------------------------ */
  /* 1. Generate Notes                                                        */
  /* ------------------------------------------------------------------------ */

  const handleGenerateTopic = async ({
    topic,
    level,
    depth,
    focusArea,
  }: GenerateTopicParams) => {
    if (isGeneratingNotes) {
      return;
    }

    const cleanTopic = topic.trim();

    if (!cleanTopic) {
      showError('Please enter a study topic.');
      return;
    }

    setIsGeneratingNotes(true);
    setErrorMessage(null);

    try {
      const notesData = await postJson<unknown>(
        '/api/generate-notes',
        {
          topic: cleanTopic,
          level,
          depth,
          focusArea,
        }
      );

      if (!isValidStudyNotes(notesData)) {
        throw new Error(
          'The AI returned an invalid study-notes response.'
        );
      }

      const now = Date.now();

      const newNotes: StudyNotes = {
        ...notesData,
        id: `notes-${now}`,
        createdAt: now,
      };

      const topicId = `topic-${now}`;

      const newTopicItem: SavedStudyTopic = {
        id: topicId,
        topic: notesData.title || cleanTopic,
        level: notesData.level || level,
        notes: newNotes,
        updatedAt: now,
      };

      saveTopic(newTopicItem);

      const updatedTopics = refreshTopics();

      setActiveTopicId(topicId);
      setActiveView('notes');
      setIsNewTopicModalOpen(false);

      /*
       * Generate the summary in the background.
       *
       * IMPORTANT:
       * This is intentionally not awaited. If summary generation fails
       * because Gemini quota is exhausted, the notes themselves remain
       * successfully saved.
       */
      void generateSummaryForTopic(
        newTopicItem,
        newNotes
      );
    } catch (error) {
      console.error('Notes generation error:', error);

      showError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while generating notes.'
      );
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* 2. Generate Summary                                                      */
  /* ------------------------------------------------------------------------ */

  const generateSummaryForTopic = async (
    topicItem: SavedStudyTopic,
    notesObj: StudyNotes
  ): Promise<boolean> => {
    if (!notesObj.sections?.length) {
      console.warn(
        'Cannot generate summary: no note sections available.'
      );
      return false;
    }

    setIsGeneratingSummary(true);

    try {
      const notesText = [
        notesObj.title,
        notesObj.summaryBrief,
        notesObj.sections
          .map(
            (section) =>
              `${section.heading}\n${section.content}`
          )
          .join('\n\n'),
      ]
        .filter(Boolean)
        .join('\n\n');

      const summaryPayload = await postJson<unknown>(
        '/api/summarize-notes',
        {
          topic: topicItem.topic,
          notesText,
        }
      );

      if (!isValidSummary(summaryPayload)) {
        throw new Error(
          'The AI returned an invalid summary response.'
        );
      }

      const newSummary: SummaryData = {
        ...(summaryPayload as SummaryData),
        generatedFromTopic: topicItem.topic,
        createdAt: Date.now(),
      };

      const updatedTopic: SavedStudyTopic = {
        ...topicItem,
        summary: newSummary,
        updatedAt: Date.now(),
      };

      saveTopic(updatedTopic);
      refreshTopics();

      return true;
    } catch (error) {
      console.error('Summary generation error:', error);

      /*
       * Background summary failures shouldn't overwrite the user's
       * successful notes generation with an error toast unless this
       * was a manually requested operation.
       */
      return false;
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* 3. Manual Summary                                                        */
  /* ------------------------------------------------------------------------ */

  const handleGenerateSummary = async () => {
    if (!currentTopic?.notes) {
      showError(
        'There are no study notes available to summarize.'
      );
      return;
    }

    if (isGeneratingSummary) {
      return;
    }

    setIsGeneratingSummary(true);
    setErrorMessage(null);

    try {
      const notesText = [
        currentTopic.notes.title,
        currentTopic.notes.summaryBrief,
        currentTopic.notes.sections
          .map(
            (section) =>
              `${section.heading}\n${section.content}`
          )
          .join('\n\n'),
      ]
        .filter(Boolean)
        .join('\n\n');

      const summaryPayload = await postJson<unknown>(
        '/api/summarize-notes',
        {
          topic: currentTopic.topic,
          notesText,
        }
      );

      if (!isValidSummary(summaryPayload)) {
        throw new Error(
          'The AI returned an invalid summary response.'
        );
      }

      const newSummary: SummaryData = {
        ...(summaryPayload as SummaryData),
        generatedFromTopic: currentTopic.topic,
        createdAt: Date.now(),
      };

      const updatedTopic: SavedStudyTopic = {
        ...currentTopic,
        summary: newSummary,
        updatedAt: Date.now(),
      };

      saveTopic(updatedTopic);
      refreshTopics();

      setActiveView('summary');
    } catch (error) {
      console.error('Manual summary generation error:', error);

      showError(
        error instanceof Error
          ? error.message
          : 'Failed to summarize notes.'
      );
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* 4. Summarize Custom Text                                                 */
  /* ------------------------------------------------------------------------ */

  const handleSummarizeCustomText = async (
    rawText: string,
    customTitle?: string
  ) => {
    if (isGeneratingSummary) {
      return;
    }

    const cleanText = rawText.trim();

    if (!cleanText) {
      showError('Please enter some text to summarize.');
      return;
    }

    setIsGeneratingSummary(true);
    setErrorMessage(null);

    try {
      const title =
        customTitle?.trim() || 'Custom Material';

      const summaryPayload = await postJson<unknown>(
        '/api/summarize-notes',
        {
          topic: title,
          notesText: cleanText,
        }
      );

      if (!isValidSummary(summaryPayload)) {
        throw new Error(
          'The AI returned an invalid summary response.'
        );
      }

      const newSummary: SummaryData = {
        ...(summaryPayload as SummaryData),
        generatedFromTopic: title,
        createdAt: Date.now(),
      };

      if (currentTopic) {
        const updated: SavedStudyTopic = {
          ...currentTopic,
          summary: newSummary,
          updatedAt: Date.now(),
        };

        saveTopic(updated);
        refreshTopics();
      } else {
        const newTopic: SavedStudyTopic = {
          id: `custom-${Date.now()}`,
          topic: title,
          level: 'Custom',
          summary: newSummary,
          updatedAt: Date.now(),
        };

        saveTopic(newTopic);
        refreshTopics();
        setActiveTopicId(newTopic.id);
      }

      setActiveView('summary');
    } catch (error) {
      console.error(
        'Custom summary generation error:',
        error
      );

      showError(
        error instanceof Error
          ? error.message
          : 'Failed to summarize raw text.'
      );
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* 5. Generate Quiz                                                         */
  /* ------------------------------------------------------------------------ */

  const handleGenerateQuiz = async (
    customDifficulty?: string,
    customCount?: number
  ) => {
    if (!currentTopic) {
      showError(
        'Please create or select a study topic first.'
      );
      return;
    }

    if (isGeneratingQuiz) {
      return;
    }

    setIsGeneratingQuiz(true);
    setErrorMessage(null);

    try {
      const notesContext = currentTopic.notes
        ? currentTopic.notes.sections
            .map(
              (section) =>
                `${section.heading}: ${section.content}`
            )
            .join('\n\n')
        : '';

      if (!notesContext.trim()) {
        throw new Error(
          'This topic does not contain enough study notes to generate a quiz.'
        );
      }

      const difficulty =
        customDifficulty?.trim() || 'Medium';

      const questionCount =
        Number.isFinite(customCount) &&
        Number(customCount) > 0
          ? Math.min(Math.max(Number(customCount), 1), 20)
          : 6;

      const quizPayload = await postJson<unknown>(
        '/api/generate-quiz',
        {
          topic: currentTopic.topic,
          notesText: notesContext,
          difficulty,
          questionCount,
        }
      );

      if (!isValidQuiz(quizPayload)) {
        throw new Error(
          'The AI returned an invalid quiz response. ' +
          'Please check the /api/generate-quiz response format.'
        );
      }

      const newQuiz: QuizData = {
        ...(quizPayload as QuizData),
        id: `quiz-${Date.now()}`,
        createdAt: Date.now(),
      };

      const updatedTopic: SavedStudyTopic = {
        ...currentTopic,
        quiz: newQuiz,
        updatedAt: Date.now(),
      };

      saveTopic(updatedTopic);
      refreshTopics();

      setActiveView('quiz');
    } catch (error) {
      console.error('Quiz generation error:', error);

      showError(
        error instanceof Error
          ? error.message
          : 'Failed to build quiz.'
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* 6. Tutor                                                                  */
  /* ------------------------------------------------------------------------ */

  const handleOpenTutor = (
    snippet?: string
  ) => {
    setTutorContextSnippet(snippet);
    setIsTutorModalOpen(true);
  };

  /* ------------------------------------------------------------------------ */
  /* 7. Delete Topic                                                          */
  /* ------------------------------------------------------------------------ */

  const handleDeleteTopic = (id: string) => {
    try {
      const updated = deleteTopic(id);

      setTopics(updated);

      if (activeTopicId === id) {
        if (updated.length > 0) {
          setActiveTopicId(updated[0].id);
          setActiveView('notes');
        } else {
          setActiveTopicId('');
          setActiveView('notes');
        }
      }
    } catch (error) {
      console.error('Delete topic error:', error);

      showError(
        'Unable to delete this study topic.'
      );
    }
  };

  /* ------------------------------------------------------------------------ */
  /* 8. Select Topic                                                          */
  /* ------------------------------------------------------------------------ */

  const handleSelectTopicFromLibrary = (
    topicItem: SavedStudyTopic,
    initialTab: 'notes' | 'summary' | 'quiz' = 'notes'
  ) => {
    setActiveTopicId(topicItem.id);
    setActiveView(initialTab);
    setErrorMessage(null);
  };

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-h-screen flex flex-col bg-stone-100/60 text-stone-900">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}

      <Header
        currentTopic={currentTopic}
        savedTopics={topics}
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenNewTopic={() =>
          setIsNewTopicModalOpen(true)
        }
        onOpenTutor={() =>
          handleOpenTutor()
        }
        onSwitchTopic={(topic) => {
          setActiveTopicId(topic.id);
        }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Error Toast                                                         */}
      {/* ------------------------------------------------------------------ */}

      {errorMessage && (
        <div className="max-w-4xl mx-auto px-4 mt-4 w-full">
          <div
            role="alert"
            className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />

              <span className="leading-5">
                {errorMessage}
              </span>
            </div>

            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() =>
                setErrorMessage(null)
              }
              className="text-rose-600 hover:text-rose-900 font-bold px-2 py-0.5 shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Main Content                                                        */}
      {/* ------------------------------------------------------------------ */}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {/* ================================================================ */}
        {/* NOTES                                                             */}
        {/* ================================================================ */}

        {activeView === 'notes' &&
          currentTopic?.notes && (
            <NotesView
              notes={currentTopic.notes}
              onOpenTutor={handleOpenTutor}
              onGenerateSummary={
                handleGenerateSummary
              }
              onGenerateQuiz={() =>
                handleGenerateQuiz()
              }
              isGeneratingSummary={
                isGeneratingSummary
              }
              isGeneratingQuiz={
                isGeneratingQuiz
              }
            />
          )}

        {activeView === 'notes' &&
          (!currentTopic ||
            !currentTopic.notes) && (
            <div className="max-w-md mx-auto my-16 text-center bg-white p-8 rounded-2xl border border-stone-200 space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">
                No Study Notes Yet
              </h2>

              <p className="text-xs text-stone-500">
                Start by typing any subject or topic
                to generate comprehensive study notes.
              </p>

              <button
                type="button"
                onClick={() =>
                  setIsNewTopicModalOpen(true)
                }
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />

                <span>
                  Generate Notes for a Topic
                </span>
              </button>
            </div>
          )}

        {/* ================================================================ */}
        {/* SUMMARY                                                           */}
        {/* ================================================================ */}

        {activeView === 'summary' &&
          currentTopic?.summary && (
            <SummaryView
              summary={currentTopic.summary}
              topicTitle={currentTopic.topic}
              onGenerateQuiz={() =>
                handleGenerateQuiz()
              }
              onSummarizeCustomText={
                handleSummarizeCustomText
              }
              isCustomSummarizing={
                isGeneratingSummary
              }
            />
          )}

        {activeView === 'summary' &&
          !currentTopic?.summary && (
            <div className="max-w-md mx-auto my-16 text-center bg-white p-8 rounded-2xl border border-stone-200 space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">
                No Summary Available
              </h2>

              <p className="text-xs text-stone-500">
                Summarize your active study notes
                into active recall flashcards,
                concept maps, and cheat-sheets.
              </p>

              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={
                  isGeneratingSummary ||
                  !currentTopic?.notes
                }
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingSummary ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />

                    <span>
                      Summarizing Notes...
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />

                    <span>
                      Summarize Current Notes
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

        {/* ================================================================ */}
        {/* QUIZ                                                              */}
        {/* ================================================================ */}

        {activeView === 'quiz' &&
          currentTopic?.quiz && (
            <QuizView
              quiz={currentTopic.quiz}
              onRetakeWithDifficulty={(
                difficulty,
                count
              ) =>
                handleGenerateQuiz(
                  difficulty,
                  count
                )
              }
              onOpenTutor={handleOpenTutor}
              isLoadingNewQuiz={
                isGeneratingQuiz
              }
            />
          )}

        {activeView === 'quiz' &&
          !currentTopic?.quiz && (
            <div className="max-w-md mx-auto my-16 text-center bg-white p-8 rounded-2xl border border-stone-200 space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
                <Award className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">
                No Quiz Generated Yet
              </h2>

              <p className="text-xs text-stone-500">
                Generate an interactive assessment
                with multiple choice questions,
                true/false, and conceptual checks.
              </p>

              <button
                type="button"
                onClick={() =>
                  handleGenerateQuiz()
                }
                disabled={
                  isGeneratingQuiz ||
                  !currentTopic?.notes
                }
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingQuiz ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />

                    <span>
                      Synthesizing Quiz...
                    </span>
                  </>
                ) : (
                  <>
                    <Award className="w-3.5 h-3.5" />

                    <span>
                      Generate Practice Quiz
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

        {/* ================================================================ */}
        {/* LIBRARY                                                           */}
        {/* ================================================================ */}

        {activeView === 'library' && (
          <LibraryView
            topics={topics}
            onSelectTopic={
              handleSelectTopicFromLibrary
            }
            onDeleteTopic={
              handleDeleteTopic
            }
            onOpenNewTopicModal={() =>
              setIsNewTopicModalOpen(true)
            }
          />
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* New Topic Modal                                                     */}
      {/* ------------------------------------------------------------------ */}

      <NewTopicModal
        isOpen={isNewTopicModalOpen}
        onClose={() =>
          setIsNewTopicModalOpen(false)
        }
        onSubmit={handleGenerateTopic}
        isLoading={isGeneratingNotes}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Ask Tutor Modal                                                     */}
      {/* ------------------------------------------------------------------ */}

      <AskTutorModal
        isOpen={isTutorModalOpen}
        onClose={() =>
          setIsTutorModalOpen(false)
        }
        topic={
          currentTopic?.topic ||
          'General Science & Humanities'
        }
        contextSnippet={
          tutorContextSnippet
        }
      />
    </div>
  );
}
