import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { NotesView } from './components/NotesView';
import { SummaryView } from './components/SummaryView';
import { QuizView } from './components/QuizView';
import { LibraryView } from './components/LibraryView';
import { NewTopicModal } from './components/NewTopicModal';
import { AskTutorModal } from './components/AskTutorModal';
import { loadSavedTopics, saveTopic, deleteTopic } from './utils/storage';
import { SavedStudyTopic, StudyNotes, SummaryData, QuizData } from './types/study';
import { Loader2, AlertCircle, Sparkles, BookOpen, Layers, Award } from 'lucide-react';

export default function App() {
  const [topics, setTopics] = useState<SavedStudyTopic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string>('');
  const [activeView, setActiveView] = useState<'notes' | 'summary' | 'quiz' | 'library'>('notes');

  // Loading states
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // Modals
  const [isNewTopicModalOpen, setIsNewTopicModalOpen] = useState(false);
  const [isTutorModalOpen, setIsTutorModalOpen] = useState(false);
  const [tutorContextSnippet, setTutorContextSnippet] = useState<string | undefined>(undefined);

  // Error toast
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    const loaded = loadSavedTopics();
    setTopics(loaded);
    if (loaded.length > 0) {
      setActiveTopicId(loaded[0].id);
    }
  }, []);

  const currentTopic = topics.find((t) => t.id === activeTopicId) || topics[0] || null;

  // 1. Generate Notes for Topic
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
      const res = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level, depth, focusArea }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate study notes');
      }

      const notesData = await res.json();
      const topicId = 'topic-' + Date.now();
      const newNotes: StudyNotes = {
        ...notesData,
        id: 'notes-' + Date.now(),
        createdAt: Date.now(),
      };

      const newTopicItem: SavedStudyTopic = {
        id: topicId,
        topic: notesData.topic || topic,
        level: notesData.level || level,
        notes: newNotes,
        updatedAt: Date.now(),
      };

      saveTopic(newTopicItem);
      const updatedTopics = loadSavedTopics();
      setTopics(updatedTopics);
      setActiveTopicId(topicId);
      setActiveView('notes');
      setIsNewTopicModalOpen(false);

      // Auto-trigger smart summary generation in background for convenience
      generateSummaryForTopic(newTopicItem, newNotes);
    } catch (err: any) {
      console.error('Generation error:', err);
      setErrorMessage(err.message || 'Something went wrong while generating notes.');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Helper to trigger summary
  const generateSummaryForTopic = async (topicItem: SavedStudyTopic, notesObj: StudyNotes) => {
    setIsGeneratingSummary(true);
    try {
      const notesText =
        `${notesObj.title}\n\n${notesObj.summaryBrief}\n\n` +
        notesObj.sections.map((s) => `${s.heading}\n${s.content}`).join('\n\n');

      const res = await fetch('/api/summarize-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicItem.topic,
          notesText,
        }),
      });

      if (!res.ok) throw new Error('Failed to summarize notes');
      const summaryPayload = await res.json();
      const newSummary: SummaryData = {
        ...summaryPayload,
        generatedFromTopic: topicItem.topic,
        createdAt: Date.now(),
      };

      const updatedTopic: SavedStudyTopic = {
        ...topicItem,
        summary: newSummary,
        updatedAt: Date.now(),
      };
      saveTopic(updatedTopic);
      setTopics(loadSavedTopics());
    } catch (err) {
      console.error('Summary generation error:', err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 2. Generate Summary Manual Trigger
  const handleGenerateSummary = async () => {
    if (!currentTopic || !currentTopic.notes) return;
    setIsGeneratingSummary(true);
    setErrorMessage(null);
    try {
      await generateSummaryForTopic(currentTopic, currentTopic.notes);
      setActiveView('summary');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to summarize notes.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 3. Summarize Raw Custom Text
  const handleSummarizeCustomText = async (rawText: string, customTitle?: string) => {
    setIsGeneratingSummary(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/summarize-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: customTitle || 'Custom Material',
          notesText: rawText,
        }),
      });

      if (!res.ok) throw new Error('Failed to summarize text');
      const summaryPayload = await res.json();
      const newSummary: SummaryData = {
        ...summaryPayload,
        generatedFromTopic: customTitle || 'Custom Lecture Notes',
        createdAt: Date.now(),
      };

      if (currentTopic) {
        const updated = { ...currentTopic, summary: newSummary, updatedAt: Date.now() };
        saveTopic(updated);
        setTopics(loadSavedTopics());
      } else {
        const newTopic: SavedStudyTopic = {
          id: 'custom-' + Date.now(),
          topic: customTitle || 'Custom Notes',
          level: 'Custom',
          summary: newSummary,
          updatedAt: Date.now(),
        };
        saveTopic(newTopic);
        setTopics(loadSavedTopics());
        setActiveTopicId(newTopic.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to summarize raw text.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 4. Generate Quiz
  const handleGenerateQuiz = async (customDifficulty?: string, customCount?: number) => {
    if (!currentTopic) return;
    setIsGeneratingQuiz(true);
    setErrorMessage(null);
    try {
      const notesContext = currentTopic.notes
        ? currentTopic.notes.sections.map((s) => `${s.heading}: ${s.content}`).join('\n\n')
        : '';

      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: currentTopic.topic,
          notesText: notesContext,
          difficulty: customDifficulty || 'Medium',
          questionCount: customCount || 6,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate quiz');
      const quizPayload = await res.json();
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
      setTopics(loadSavedTopics());
      setActiveView('quiz');
    } catch (err: any) {
      console.error('Quiz generation error:', err);
      setErrorMessage(err.message || 'Failed to build quiz.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Open Tutor with context
  const handleOpenTutor = (snippet?: string) => {
    setTutorContextSnippet(snippet);
    setIsTutorModalOpen(true);
  };

  // Delete Topic
  const handleDeleteTopic = (id: string) => {
    const updated = deleteTopic(id);
    setTopics(updated);
    if (activeTopicId === id && updated.length > 0) {
      setActiveTopicId(updated[0].id);
    }
  };

  // Select Topic from Library
  const handleSelectTopicFromLibrary = (
    topicItem: SavedStudyTopic,
    initialTab: 'notes' | 'summary' | 'quiz' = 'notes'
  ) => {
    setActiveTopicId(topicItem.id);
    setActiveView(initialTab);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100/60 text-stone-900">
      {/* Top Header */}
      <Header
        currentTopic={currentTopic}
        savedTopics={topics}
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenNewTopic={() => setIsNewTopicModalOpen(true)}
        onOpenTutor={() => handleOpenTutor()}
        onSwitchTopic={(t) => {
          setActiveTopicId(t.id);
        }}
      />

      {/* Error Toast if any */}
      {errorMessage && (
        <div className="max-w-4xl mx-auto px-4 mt-4 w-full">
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-900 font-bold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {activeView === 'notes' && currentTopic && currentTopic.notes && (
          <NotesView
            notes={currentTopic.notes}
            onOpenTutor={handleOpenTutor}
            onGenerateSummary={handleGenerateSummary}
            onGenerateQuiz={() => handleGenerateQuiz()}
            isGeneratingSummary={isGeneratingSummary}
            isGeneratingQuiz={isGeneratingQuiz}
          />
        )}

        {activeView === 'notes' && (!currentTopic || !currentTopic.notes) && (
          <div className="max-w-md mx-auto my-16 text-center bg-white p-8 rounded-2xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-stone-900 font-display">No Study Notes Yet</h2>
            <p className="text-xs text-stone-500">
              Start by typing any subject or topic to generate comprehensive study notes.
            </p>
            <button
              onClick={() => setIsNewTopicModalOpen(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Notes for a Topic</span>
            </button>
          </div>
        )}

        {activeView === 'summary' && currentTopic?.summary && (
          <SummaryView
            summary={currentTopic.summary}
            topicTitle={currentTopic.topic}
            onGenerateQuiz={() => handleGenerateQuiz()}
            onSummarizeCustomText={handleSummarizeCustomText}
            isCustomSummarizing={isGeneratingSummary}
          />
        )}

        {activeView === 'summary' && (!currentTopic?.summary) && (
          <div className="max-w-md mx-auto my-16 text-center bg-white p-8 rounded-2xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-stone-900 font-display">No Summary Available</h2>
            <p className="text-xs text-stone-500">
              Summarize your active study notes into active recall flashcards, concept maps, and cheat-sheets.
            </p>
            <button
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isGeneratingSummary ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Summarizing Notes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Summarize Current Notes</span>
                </>
              )}
            </button>
          </div>
        )}

        {activeView === 'quiz' && currentTopic?.quiz && (
          <QuizView
            quiz={currentTopic.quiz}
            onRetakeWithDifficulty={(diff, cnt) => handleGenerateQuiz(diff, cnt)}
            onOpenTutor={handleOpenTutor}
            isLoadingNewQuiz={isGeneratingQuiz}
          />
        )}

        {activeView === 'quiz' && (!currentTopic?.quiz) && (
          <div className="max-w-md mx-auto my-16 text-center bg-white p-8 rounded-2xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-stone-900 font-display">No Quiz Generated Yet</h2>
            <p className="text-xs text-stone-500">
              Generate an interactive assessment with multiple choice questions, true/false, and conceptual checks.
            </p>
            <button
              onClick={() => handleGenerateQuiz()}
              disabled={isGeneratingQuiz}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isGeneratingQuiz ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Quiz...</span>
                </>
              ) : (
                <>
                  <Award className="w-3.5 h-3.5" />
                  <span>Generate Practice Quiz</span>
                </>
              )}
            </button>
          </div>
        )}

        {activeView === 'library' && (
          <LibraryView
            topics={topics}
            onSelectTopic={handleSelectTopicFromLibrary}
            onDeleteTopic={handleDeleteTopic}
            onOpenNewTopicModal={() => setIsNewTopicModalOpen(true)}
          />
        )}
      </main>

      {/* New Topic Modal */}
      <NewTopicModal
        isOpen={isNewTopicModalOpen}
        onClose={() => setIsNewTopicModalOpen(false)}
        onSubmit={handleGenerateTopic}
        isLoading={isGeneratingNotes}
      />

      {/* Ask Tutor Modal */}
      <AskTutorModal
        isOpen={isTutorModalOpen}
        onClose={() => setIsTutorModalOpen(false)}
        topic={currentTopic?.topic || 'General Science & Humanities'}
        contextSnippet={tutorContextSnippet}
      />
    </div>
  );
}
