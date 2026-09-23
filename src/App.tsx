import React, { useState, useEffect } from 'react';
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

export default function App() {
  const [topics, setTopics] = useState<SavedStudyTopic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string>('');
  const [activeView, setActiveView] = useState<
    'notes' | 'summary' | 'quiz' | 'library'
  >('notes');

  // Loading states
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

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

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    const loaded = loadSavedTopics();

    setTopics(loaded);

    if (loaded.length > 0) {
      setActiveTopicId(loaded[0].id);
    }
  }, []);

  const currentTopic =
    topics.find((t) => t.id === activeTopicId) ||
    topics[0] ||
    null;


  // ============================================================
  // 1. GENERATE NOTES FOR TOPIC
  // ============================================================

  const handleGenerateTopic = async ({
    topic,
    level,
    depth,
    focusArea,
  }: {
    topic: string;
    level: string;
    depth: string;
    focusArea: string;
  }) => {
    setIsGeneratingNotes(true);
    setErrorMessage(null);

    try {
      /*
       * IMPORTANT:
       *
       * The server expects "text" or "content".
       *
       * We now send the topic information inside "text".
       */

      const studyRequest = `
Generate comprehensive study notes about the following topic.

Topic:
${topic}

Student Level:
${level}

Depth:
${depth}

Focus Area:
${focusArea}

Please create clear, structured and accurate study notes.
Include important concepts, explanations, definitions,
examples and key points where appropriate.
`;

      const res = await fetch('/api/generate-notes', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          text: studyRequest,

          // Keep these fields too in case the server uses them.
          topic,
          level,
          depth,
          focusArea,
        }),
      });

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.error ||
            'Failed to generate study notes'
        );
      }

      const notesData = await res.json();

      const now = Date.now();

      const topicId = 'topic-' + now;

      const newNotes: StudyNotes = {
        ...notesData,
        id: 'notes-' + now,
        createdAt: now,
      };

      const newTopicItem: SavedStudyTopic = {
        id: topicId,

        topic:
          notesData.topic ||
          topic,

        level:
          notesData.level ||
          level,

        notes: newNotes,

        updatedAt: now,
      };

      saveTopic(newTopicItem);

      const updatedTopics =
        loadSavedTopics();

      setTopics(updatedTopics);

      setActiveTopicId(topicId);

      setActiveView('notes');

      setIsNewTopicModalOpen(false);

      // Automatically generate summary
      // in the background.
      generateSummaryForTopic(
        newTopicItem,
        newNotes
      );

    } catch (err: any) {
      console.error(
        'Generation error:',
        err
      );

      setErrorMessage(
        err?.message ||
          'Something went wrong while generating notes.'
      );

    } finally {
      setIsGeneratingNotes(false);
    }
  };


  // ============================================================
  // HELPER: GENERATE SUMMARY FOR TOPIC
  // ============================================================

  const generateSummaryForTopic = async (
    topicItem: SavedStudyTopic,
    notesObj: StudyNotes
  ) => {
    setIsGeneratingSummary(true);

    try {
      const notesText =
        `${notesObj.title || topicItem.topic}\n\n` +
        `${notesObj.summaryBrief || ''}\n\n` +
        (notesObj.sections || [])
          .map(
            (s) =>
              `${s.heading}\n${s.content}`
          )
          .join('\n\n');

      /*
       * IMPORTANT:
       *
       * Server expects "text" or "content".
       *
       * Previously this sent "notesText".
       */

      const res = await fetch(
        '/api/summarize-notes',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            text: notesText,
            topic: topicItem.topic,

            // Keep notesText too for compatibility
            // with older server code.
            notesText,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.error ||
            'Failed to summarize notes'
        );
      }

      const summaryPayload =
        await res.json();

      const newSummary: SummaryData = {
        ...summaryPayload,

        generatedFromTopic:
          topicItem.topic,

        createdAt: Date.now(),
      };

      const updatedTopic: SavedStudyTopic = {
        ...topicItem,

        summary: newSummary,

        updatedAt: Date.now(),
      };

      saveTopic(updatedTopic);

      setTopics(loadSavedTopics());

    } catch (err: any) {
      console.error(
        'Summary generation error:',
        err
      );

      /*
       * Don't interrupt the notes generation
       * if automatic summary generation fails.
       */
      setErrorMessage(
        err?.message ||
          'Failed to generate summary.'
      );

    } finally {
      setIsGeneratingSummary(false);
    }
  };


  // ============================================================
  // 2. GENERATE SUMMARY MANUALLY
  // ============================================================

  const handleGenerateSummary = async () => {
    if (
      !currentTopic ||
      !currentTopic.notes
    ) {
      return;
    }

    setIsGeneratingSummary(true);
    setErrorMessage(null);

    try {
      await generateSummaryForTopic(
        currentTopic,
        currentTopic.notes
      );

      setActiveView('summary');

    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          'Failed to summarize notes.'
      );

    } finally {
      setIsGeneratingSummary(false);
    }
  };


  // ============================================================
  // 3. SUMMARIZE CUSTOM TEXT
  // ============================================================

  const handleSummarizeCustomText = async (
    rawText: string,
    customTitle?: string
  ) => {
    setIsGeneratingSummary(true);
    setErrorMessage(null);

    try {
      /*
       * IMPORTANT:
       *
       * Send rawText as "text".
       */

      const res = await fetch(
        '/api/summarize-notes',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            text: rawText,

            topic:
              customTitle ||
              'Custom Material',

            // Compatibility with old server
            notesText: rawText,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.error ||
            'Failed to summarize text'
        );
      }

      const summaryPayload =
        await res.json();

      const newSummary: SummaryData = {
        ...summaryPayload,

        generatedFromTopic:
          customTitle ||
          'Custom Lecture Notes',

        createdAt: Date.now(),
      };

      if (currentTopic) {
        const updated = {
          ...currentTopic,

          summary: newSummary,

          updatedAt: Date.now(),
        };

        saveTopic(updated);

        setTopics(
          loadSavedTopics()
        );

      } else {
        const newTopic: SavedStudyTopic = {
          id: 'custom-' + Date.now(),

          topic:
            customTitle ||
            'Custom Notes',

          level: 'Custom',

          summary: newSummary,
        };

        saveTopic(newTopic);

        setTopics(
          loadSavedTopics()
        );

        setActiveTopicId(
          newTopic.id
        );
      }

      setActiveView('summary');

    } catch (err: any) {
      console.error(
        'Custom summary error:',
        err
      );

      setErrorMessage(
        err?.message ||
          'Failed to summarize raw text.'
      );

    } finally {
      setIsGeneratingSummary(false);
    }
  };


  // ============================================================
  // 4. GENERATE QUIZ
  // ============================================================

  const handleGenerateQuiz = async (
    customDifficulty?: string,
    customCount?: number
  ) => {
    if (!currentTopic) {
      return;
    }

    setIsGeneratingQuiz(true);
    setErrorMessage(null);

    try {
      const notesContext =
        currentTopic.notes
          ? (
              currentTopic.notes.sections ||
              []
            )
              .map(
                (s) =>
                  `${s.heading}: ${s.content}`
              )
              .join('\n\n')
          : '';

      /*
       * Make sure there is actually something
       * to send to the server.
       */

      if (!notesContext.trim()) {
        throw new Error(
          'There are no study notes available for this quiz yet.'
        );
      }

      /*
       * IMPORTANT:
       *
       * Server expects "text" or "content".
       *
       * Previously this only sent "notesText".
       */

      const res = await fetch(
        '/api/generate-quiz',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            text: notesContext,

            topic: currentTopic.topic,

            difficulty:
              customDifficulty ||
              'Medium',

            questionCount:
              customCount || 6,

            // Compatibility with old server
            notesText: notesContext,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.error ||
            'Failed to generate quiz'
        );
      }

      const quizPayload =
        await res.json();

      const newQuiz: QuizData = {
        ...quizPayload,

        id: 'quiz-' + Date.now(),

        createdAt: Date.now(),
      };

      const updatedTopic: SavedStudyTopic = {
        ...currentTopic,

        quiz: newQuiz,

        updatedAt: Date.now(),
      };

      saveTopic(updatedTopic);

      setTopics(
        loadSavedTopics()
      );

      setActiveView('quiz');

    } catch (err: any) {
      console.error(
        'Quiz generation error:',
        err
      );

      setErrorMessage(
        err?.message ||
          'Failed to build quiz.'
      );

    } finally {
      setIsGeneratingQuiz(false);
    }
  };


  // ============================================================
  // OPEN TUTOR
  // ============================================================

  const handleOpenTutor = (
    snippet?: string
  ) => {
    setTutorContextSnippet(
      snippet
    );

    setIsTutorModalOpen(true);
  };


  // ============================================================
  // DELETE TOPIC
  // ============================================================

  const handleDeleteTopic = (
    id: string
  ) => {
    const updated =
      deleteTopic(id);

    setTopics(updated);

    if (
      activeTopicId === id
    ) {
      if (updated.length > 0) {
        setActiveTopicId(
          updated[0].id
        );
      } else {
        setActiveTopicId('');
        setActiveView('notes');
      }
    }
  };


  // ============================================================
  // SELECT TOPIC FROM LIBRARY
  // ============================================================

  const handleSelectTopicFromLibrary = (
    topicItem: SavedStudyTopic,
    initialTab:
      | 'notes'
      | 'summary'
      | 'quiz' = 'notes'
  ) => {
    setActiveTopicId(
      topicItem.id
    );

    setActiveView(
      initialTab
    );
  };


  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen flex flex-col bg-stone-100/60 text-stone-900">

      {/* ======================================================
          HEADER
      ====================================================== */}

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
        onSwitchTopic={(t) => {
          setActiveTopicId(t.id);
        }}
      />


      {/* ======================================================
          ERROR TOAST
      ====================================================== */}

      {errorMessage && (
        <div className="max-w-4xl mx-auto px-4 mt-4 w-full">
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-3 shadow-xs">

            <div className="flex items-center gap-2">

              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />

              <span>
                {errorMessage}
              </span>

            </div>

            <button
              onClick={() =>
                setErrorMessage(null)
              }
              className="text-rose-600 hover:text-rose-900 font-bold px-2 py-0.5"
            >
              ✕
            </button>

          </div>
        </div>
      )}


      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">

        {/* ====================================================
            NOTES VIEW
        ==================================================== */}

        {activeView === 'notes' &&
          currentTopic &&
          currentTopic.notes && (
            <NotesView
              notes={currentTopic.notes}
              onOpenTutor={
                handleOpenTutor
              }
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


        {/* ====================================================
            EMPTY NOTES
        ==================================================== */}

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
                Start by typing any subject or
                topic to generate comprehensive
                study notes.
              </p>

              <button
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


        {/* ====================================================
            SUMMARY VIEW
        ==================================================== */}

        {activeView === 'summary' &&
          currentTopic?.summary && (
            <SummaryView
              summary={
                currentTopic.summary
              }
              topicTitle={
                currentTopic.topic
              }
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


        {/* ====================================================
            EMPTY SUMMARY
        ==================================================== */}

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
                onClick={
                  handleGenerateSummary
                }
                disabled={
                  isGeneratingSummary
                }
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
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


        {/* ====================================================
            QUIZ VIEW
        ==================================================== */}

        {activeView === 'quiz' &&
          currentTopic?.quiz && (
            <QuizView
              quiz={currentTopic.quiz}
              onRetakeWithDifficulty={(
                diff,
                cnt
              ) =>
                handleGenerateQuiz(
                  diff,
                  cnt
                )
              }
              onOpenTutor={
                handleOpenTutor
              }
              isLoadingNewQuiz={
                isGeneratingQuiz
              }
            />
          )}


        {/* ====================================================
            EMPTY QUIZ
        ==================================================== */}

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
                onClick={() =>
                  handleGenerateQuiz()
                }
                disabled={
                  isGeneratingQuiz
                }
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
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


        {/* ====================================================
            LIBRARY
        ==================================================== */}

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
              setIsNewTopicModalOpen(
                true
              )
            }
          />
        )}

      </main>


      {/* ======================================================
          NEW TOPIC MODAL
      ====================================================== */}

      <NewTopicModal
        isOpen={
          isNewTopicModalOpen
        }
        onClose={() =>
          setIsNewTopicModalOpen(false)
        }
        onSubmit={
          handleGenerateTopic
        }
        isLoading={
          isGeneratingNotes
        }
      />


      {/* ======================================================
          ASK TUTOR MODAL
      ====================================================== */}

      <AskTutorModal
        isOpen={
          isTutorModalOpen
        }
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