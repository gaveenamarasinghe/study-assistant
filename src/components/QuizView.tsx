import React, { useState, useEffect } from 'react';
import {
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Zap,
  BookOpen,
  ChevronRight,
  Send,
  Loader2,
  FileCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizData, QuizQuestion, QuestionEvaluation } from '../types/study';
import { MarkdownRenderer } from './MarkdownRenderer';

interface QuizViewProps {
  quiz: QuizData;
  onRetakeWithDifficulty: (difficulty: string, count: number) => void;
  onOpenTutor: (snippet: string) => void;
  isLoadingNewQuiz?: boolean;
}

export const QuizView: React.FC<QuizViewProps> = ({
  quiz,
  onRetakeWithDifficulty,
  onOpenTutor,
  isLoadingNewQuiz,
}) => {
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState((quiz.recommendedTimeMinutes || 5) * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Short answer evaluation state
  const [evaluations, setEvaluations] = useState<Record<string, QuestionEvaluation>>({});
  const [evaluatingIds, setEvaluatingIds] = useState<Record<string, boolean>>({});

  // Reset quiz state when quiz changes
  useEffect(() => {
    setCurrentIdx(0);
    setAnswers({});
    setShowHint({});
    setIsSubmitted(false);
    setEvaluations({});
    setTimeLeft((quiz.recommendedTimeMinutes || 5) * 60);
    setIsTimerRunning(false);
  }, [quiz]);

  // Exam mode timer
  useEffect(() => {
    if (mode === 'exam' && isTimerRunning && !isSubmitted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [mode, isTimerRunning, isSubmitted, timeLeft]);

  const questions = quiz.questions || [];
  const currentQ = questions[currentIdx];

  const handleSelectOption = (questionId: string, option: string) => {
    if (isSubmitted && mode === 'exam') return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleEvaluateShortAnswer = async (q: QuizQuestion) => {
    const userAnswer = answers[q.id];
    if (!userAnswer || !userAnswer.trim()) return;

    setEvaluatingIds((prev) => ({ ...prev, [q.id]: true }));
    try {
      const res = await fetch('/api/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.question,
          expectedAnswer: q.correctAnswer,
          userAnswer: userAnswer.trim(),
          conceptTested: q.conceptTested,
        }),
      });

      if (!res.ok) throw new Error('Evaluation failed');
      const data: QuestionEvaluation = await res.json();
      setEvaluations((prev) => ({ ...prev, [q.id]: data }));
    } catch (err) {
      console.error('Failed to grade answer:', err);
    } finally {
      setEvaluatingIds((prev) => ({ ...prev, [q.id]: false }));
    }
  };

  const handleSubmitExam = () => {
    setIsSubmitted(true);
    setIsTimerRunning(false);

    // Calculate score
    let correctCount = 0;
    questions.forEach((q) => {
      if (answers[q.id] && answers[q.id].trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
        correctCount++;
      }
    });

    const percent = Math.round((correctCount / questions.length) * 100);
    if (percent >= 70) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore in environments without canvas
      }
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q) => {
      if (q.type === 'short_answer') {
        if (evaluations[q.id]?.isCorrect) correct++;
      } else {
        if (answers[q.id] && answers[q.id].trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
          correct++;
        }
      }
    });
    return {
      correct,
      total: questions.length,
      percentage: Math.round((correct / questions.length) * 100),
    };
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const scoreResult = calculateScore();

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Quiz Top Card */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 mb-1">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>Assessment & Retrieval Practice · {quiz.difficulty}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
              {quiz.title}
            </h1>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
            <button
              onClick={() => {
                setMode('practice');
                setIsTimerRunning(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                mode === 'practice' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Practice Mode
            </button>
            <button
              onClick={() => {
                setMode('exam');
                setIsTimerRunning(true);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                mode === 'exam' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Timed Exam Mode
            </button>
          </div>
        </div>

        {/* Progress & Status Bar */}
        <div className="flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span>
              Question <strong className="text-stone-900">{currentIdx + 1}</strong> of{' '}
              <strong className="text-stone-900">{questions.length}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>{Object.keys(answers).length} Answered</span>
          </div>

          {mode === 'exam' && (
            <div className={`flex items-center gap-1.5 font-mono font-semibold ${timeLeft < 60 ? 'text-rose-600 animate-pulse' : 'text-stone-700'}`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(timeLeft)} remaining</span>
            </div>
          )}
        </div>

        {/* Numbered Question Navigator Dots */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {questions.map((q, idx) => {
            const hasAnswered = !!answers[q.id];
            const isCurrent = idx === currentIdx;
            const isCorrect = answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

            let dotStyle = 'bg-stone-100 text-stone-600 border-stone-200';
            if (isSubmitted || mode === 'practice') {
              if (hasAnswered) {
                dotStyle = isCorrect
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold'
                  : 'bg-rose-100 text-rose-900 border-rose-300 font-semibold';
              }
            } else if (hasAnswered) {
              dotStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-medium';
            }

            if (isCurrent) {
              dotStyle += ' ring-2 ring-amber-600 ring-offset-1';
            }

            return (
              <button
                key={idx}
                onClick={() => setCurrentIdx(idx)}
                className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center border transition-all cursor-pointer ${dotStyle}`}
                title={`Question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Card or Scoreboard */}
      {isSubmitted && mode === 'exam' ? (
        /* Exam Scoreboard */
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in duration-300">
          <div className="text-center space-y-2 py-4 border-b border-stone-100">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2">
              <Award className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 font-display">Exam Completed</h2>
            <div className="text-4xl font-extrabold text-amber-950 font-display">
              {scoreResult.percentage}%
            </div>
            <p className="text-xs text-stone-500">
              You scored <strong className="text-stone-800">{scoreResult.correct}</strong> out of{' '}
              <strong className="text-stone-800">{scoreResult.total}</strong> questions accurately.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setIsSubmitted(false);
                setAnswers({});
                setCurrentIdx(0);
                setTimeLeft((quiz.recommendedTimeMinutes || 5) * 60);
              }}
              className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake This Exam</span>
            </button>

            <button
              onClick={() => onRetakeWithDifficulty('Hard', questions.length)}
              disabled={isLoadingNewQuiz}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isLoadingNewQuiz ? 'Building...' : 'Challenge Harder Level'}</span>
            </button>
          </div>

          {/* Question Breakdown List */}
          <div className="space-y-4 pt-4 border-t border-stone-100">
            <h3 className="text-sm font-bold text-stone-900 font-display">Question Breakdown</h3>
            {questions.map((q, qIdx) => {
              const userAns = answers[q.id];
              const isCorrect = userAns?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-stone-900">
                      {qIdx + 1}. {q.question}
                    </span>
                    <span className="shrink-0 flex items-center gap-1 font-semibold">
                      {isCorrect ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="text-rose-700 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Incorrect
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-stone-400">Your answer: </span>
                      <strong className={isCorrect ? 'text-emerald-900' : 'text-rose-900'}>
                        {userAns || '(Not answered)'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-400">Correct answer: </span>
                      <strong className="text-emerald-900">{q.correctAnswer}</strong>
                    </div>
                  </div>

                  <div className="bg-white/80 p-2.5 rounded-lg border border-stone-200/60 text-stone-700 leading-relaxed mt-2 text-[11px]">
                    <span className="font-semibold text-stone-900 block mb-0.5">Explanation:</span>
                    {q.explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Active Single Question View */
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Question Meta */}
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="font-semibold uppercase tracking-wider text-amber-800 text-[10px]">
              {currentQ.conceptTested || 'Conceptual Knowledge'}
            </span>
            {currentQ.hint && (
              <button
                onClick={() => setShowHint((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))}
                className="text-stone-500 hover:text-amber-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>{showHint[currentQ.id] ? 'Hide Hint' : 'Show Hint'}</span>
              </button>
            )}
          </div>

          {/* Hint callout if toggled */}
          {showHint[currentQ.id] && currentQ.hint && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-900 italic">
              <span className="font-semibold not-italic text-amber-950">Hint: </span>
              {currentQ.hint}
            </div>
          )}

          {/* Question Text */}
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 font-display leading-snug">
            {currentQ.question}
          </h2>

          {/* Options for MCQ / True-False */}
          {currentQ.options && currentQ.options.length > 0 && (
            <div className="space-y-2.5 pt-1">
              {currentQ.options.map((option, optIdx) => {
                const isSelected = answers[currentQ.id] === option;
                const isCorrect = option.trim().toLowerCase() === currentQ.correctAnswer.trim().toLowerCase();
                const hasAnswered = !!answers[currentQ.id];

                let optionStyles = 'border-stone-200 bg-white hover:bg-stone-50 text-stone-800';

                // Practice mode shows feedback immediately on selection
                if (mode === 'practice' && hasAnswered) {
                  if (isSelected && isCorrect) {
                    optionStyles = 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold ring-1 ring-emerald-500';
                  } else if (isSelected && !isCorrect) {
                    optionStyles = 'border-rose-400 bg-rose-50/70 text-rose-950 ring-1 ring-rose-400';
                  } else if (isCorrect) {
                    optionStyles = 'border-emerald-400 bg-emerald-50/40 text-emerald-900';
                  }
                } else if (isSelected) {
                  optionStyles = 'border-amber-600 bg-amber-50 text-amber-950 font-semibold ring-1 ring-amber-600';
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => handleSelectOption(currentQ.id, option)}
                    className={`w-full p-4 rounded-xl border text-xs sm:text-sm text-left flex items-start gap-3 transition-all cursor-pointer ${optionStyles}`}
                  >
                    <span className="w-5 h-5 rounded-full border border-stone-300 flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold text-stone-600">
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span className="flex-1 leading-relaxed">{option}</span>
                    {mode === 'practice' && hasAnswered && isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {mode === 'practice' && hasAnswered && isSelected && !isCorrect && (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Short Answer Input */}
          {currentQ.type === 'short_answer' && (
            <div className="space-y-3 pt-1">
              <textarea
                rows={3}
                value={answers[currentQ.id] || ''}
                onChange={(e) => handleSelectOption(currentQ.id, e.target.value)}
                placeholder="Type your explanation or answer in your own words..."
                className="w-full text-xs sm:text-sm p-3.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              />

              <div className="flex justify-end">
                <button
                  onClick={() => handleEvaluateShortAnswer(currentQ)}
                  disabled={evaluatingIds[currentQ.id] || !answers[currentQ.id]?.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {evaluatingIds[currentQ.id] ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Grading Answer...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Evaluate My Answer</span>
                    </>
                  )}
                </button>
              </div>

              {/* Evaluation Feedback */}
              {evaluations[currentQ.id] && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    evaluations[currentQ.id].isCorrect
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {evaluations[currentQ.id].isCorrect ? '✓ Strong Understanding' : '⚠️ Partial Understanding'}
                    </span>
                    <span className="font-mono font-semibold">
                      Score: {evaluations[currentQ.id].score}/100
                    </span>
                  </div>
                  <p className="text-stone-700 leading-relaxed">{evaluations[currentQ.id].feedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Explanation in Practice Mode */}
          {mode === 'practice' && answers[currentQ.id] && (
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900">Pedagogical Explanation:</span>
                <button
                  onClick={() => onOpenTutor(`Regarding question: "${currentQ.question}" — can you explain why "${currentQ.correctAnswer}" is correct?`)}
                  className="text-[11px] text-amber-800 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>Ask Tutor to Elaborate</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="leading-relaxed">{currentQ.explanation}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <button
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {currentIdx < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Next Question</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSubmitExam}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Complete Assessment</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
