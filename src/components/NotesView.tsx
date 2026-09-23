import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  Highlighter,
  HelpCircle,
  Download,
  Printer,
  Sparkles,
  Award,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ListOrdered,
  BookOpen,
  ArrowRight,
  BrainCircuit,
} from 'lucide-react';
import { StudyNotes } from '../types/study';
import { MarkdownRenderer } from './MarkdownRenderer';
import { speechService } from '../utils/speech';

interface NotesViewProps {
  notes: StudyNotes;
  onOpenTutor: (contextSnippet?: string) => void;
  onGenerateSummary: () => void;
  onGenerateQuiz: () => void;
  isGeneratingSummary?: boolean;
  isGeneratingQuiz?: boolean;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onOpenTutor,
  onGenerateSummary,
  onGenerateQuiz,
  isGeneratingSummary,
  isGeneratingQuiz,
}) => {
  const [highlightTerms, setHighlightTerms] = useState(false);
  const [speechState, setSpeechState] = useState({ isSpeaking: false, isPaused: false });
  const [revealedQuestions, setRevealedQuestions] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const unsubscribe = speechService.subscribe(setSpeechState);
    return () => {
      unsubscribe();
      speechService.stop();
    };
  }, []);

  const handleToggleSpeech = () => {
    if (speechState.isSpeaking && !speechState.isPaused) {
      speechService.pause();
    } else if (speechState.isPaused) {
      speechService.resume();
    } else {
      // Build full speech text from notes
      const fullText = `Study notes on ${notes.title}. ${notes.summaryBrief}. ` +
        notes.sections.map((s) => `${s.heading}. ${s.content}. Key takeaway: ${s.keyTakeaway}`).join(' ');
      speechService.speak(fullText);
    }
  };

  const handleStopSpeech = () => {
    speechService.stop();
  };

  const handleExportMarkdown = () => {
    let md = `# ${notes.title}\n\n`;
    md += `**Topic:** ${notes.topic} | **Level:** ${notes.level}\n\n`;
    md += `## Executive Synopsis\n${notes.summaryBrief}\n\n`;

    if (notes.prerequisites && notes.prerequisites.length > 0) {
      md += `### Prerequisites\n` + notes.prerequisites.map((p) => `- ${p}`).join('\n') + '\n\n';
    }

    notes.sections.forEach((s) => {
      md += `## ${s.heading}\n`;
      if (s.subheading) md += `*${s.subheading}*\n\n`;
      md += `${s.content}\n\n`;
      md += `> **Key Takeaway:** ${s.keyTakeaway}\n\n`;
    });

    if (notes.keyTerms && notes.keyTerms.length > 0) {
      md += `## Key Terms & Vocabulary\n\n`;
      notes.keyTerms.forEach((t) => {
        md += `- **${t.term}**: ${t.definition}${t.exampleOrFormula ? ` (e.g. \`${t.exampleOrFormula}\`)` : ''}\n`;
      });
      md += '\n';
    }

    if (notes.misconceptions && notes.misconceptions.length > 0) {
      md += `## Common Pitfalls & Misconceptions\n\n`;
      notes.misconceptions.forEach((m) => {
        md += `- ❌ **Myth:** ${m.myth}\n  ✅ **Reality:** ${m.reality}\n`;
      });
      md += '\n';
    }

    if (notes.examTips && notes.examTips.length > 0) {
      md += `## Exam & Interview Strategy Tips\n\n`;
      notes.examTips.forEach((t) => {
        md += `- ${t}\n`;
      });
      md += '\n';
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${notes.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-notes.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleRevealQuestion = (idx: number) => {
    setRevealedQuestions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Controls Toolbar */}
      <div className="no-print bg-white rounded-xl border border-stone-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 sticky top-16 z-30 backdrop-blur-md bg-white/95">
        {/* Left Side: Study Enhancements */}
        <div className="flex items-center gap-2">
          {/* Audio Reader */}
          <div className="flex items-center border border-stone-200 rounded-lg p-0.5 bg-stone-50">
            <button
              onClick={handleToggleSpeech}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                speechState.isSpeaking && !speechState.isPaused
                  ? 'bg-amber-600 text-white'
                  : 'text-stone-700 hover:bg-stone-200/70'
              }`}
              title={speechState.isSpeaking ? 'Pause reading aloud' : 'Listen to notes read aloud'}
            >
              {speechState.isSpeaking && !speechState.isPaused ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Audio</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-amber-700" />
                  <span>Listen</span>
                </>
              )}
            </button>
            {speechState.isSpeaking && (
              <button
                onClick={handleStopSpeech}
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-md hover:bg-stone-200 cursor-pointer"
                title="Stop audio"
              >
                <VolumeX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Highlight Terms Toggle */}
          <button
            onClick={() => setHighlightTerms(!highlightTerms)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              highlightTerms
                ? 'bg-amber-100 border-amber-300 text-amber-950 font-semibold'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-600" />
            <span>Highlight Core Terms</span>
          </button>

          {/* Ask Tutor */}
          <button
            onClick={() => onOpenTutor()}
            className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
            <span>Ask Tutor</span>
          </button>
        </div>

        {/* Right Side: Quick Conversions & Exports */}
        <div className="flex items-center gap-2">
          {/* Summarize button */}
          <button
            onClick={onGenerateSummary}
            disabled={isGeneratingSummary}
            className="px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Summarize into flashcards and cheat-sheets"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{isGeneratingSummary ? 'Summarizing...' : 'Summarize Notes'}</span>
          </button>

          {/* Quiz CTA */}
          <button
            onClick={onGenerateQuiz}
            disabled={isGeneratingQuiz}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            title="Take a practice quiz on these notes"
          >
            <Award className="w-3.5 h-3.5" />
            <span>{isGeneratingQuiz ? 'Creating Quiz...' : 'Generate Quiz'}</span>
          </button>

          <div className="h-4 w-px bg-stone-200" />

          {/* Export markdown */}
          <button
            onClick={handleExportMarkdown}
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            title="Export as Markdown (.md)"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Document Container */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-10 space-y-8">
        {/* Document Header */}
        <div className="border-b border-stone-100 pb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 font-medium">
            <span className="text-amber-800 font-semibold">{notes.topic}</span>
            <span aria-hidden="true">·</span>
            <span>{notes.level}</span>
            {notes.estimatedReadTime && (
              <>
                <span aria-hidden="true">·</span>
                <span>{notes.estimatedReadTime}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>Verified Curriculum Standard</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-display text-balance">
            {notes.title}
          </h1>

          {/* Executive Synopsis */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/60 text-stone-800 text-sm leading-relaxed mt-4">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs mb-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
              <span>Executive Synopsis</span>
            </div>
            <p>{notes.summaryBrief}</p>
          </div>

          {/* Prerequisites */}
          {notes.prerequisites && notes.prerequisites.length > 0 && (
            <div className="pt-2 text-xs text-stone-600 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-stone-700">Foundational Prerequisites:</span>
              {notes.prerequisites.map((req, idx) => (
                <span key={idx} className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200/60">
                  {req}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Section Quick Index Jump (TOC) */}
        {notes.sections && notes.sections.length > 1 && (
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 text-xs space-y-2">
            <div className="font-semibold text-stone-800 flex items-center gap-1.5">
              <ListOrdered className="w-3.5 h-3.5 text-stone-500" />
              <span>Study Module Index</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {notes.sections.map((section, idx) => (
                <a
                  key={idx}
                  href={`#section-${idx}`}
                  className="text-stone-600 hover:text-amber-800 hover:underline flex items-center gap-1.5 truncate"
                >
                  <span className="text-amber-700 font-mono text-[11px] font-medium">{idx + 1}.</span>
                  <span className="truncate">{section.heading.replace(/^\d+[\.\s]*/, '')}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Note Sections */}
        <div className="space-y-10">
          {notes.sections.map((section, index) => (
            <section
              key={index}
              id={`section-${index}`}
              className="scroll-mt-24 space-y-4 pt-4 border-t first:border-t-0 border-stone-100"
            >
              {/* Section Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-bold text-stone-900 font-display">
                    {section.heading}
                  </h2>
                  {section.subheading && (
                    <p className="text-xs text-stone-500 font-medium">
                      {section.subheading}
                    </p>
                  )}
                </div>

                {/* Clarify with Tutor quick button */}
                <button
                  onClick={() => onOpenTutor(`${section.heading}: ${section.content.slice(0, 200)}...`)}
                  className="no-print text-[11px] text-stone-500 hover:text-amber-800 hover:bg-amber-50 px-2 py-1 rounded-md border border-stone-200/60 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  title="Ask AI tutor about this specific section"
                >
                  <HelpCircle className="w-3 h-3 text-amber-600" />
                  <span>Clarify</span>
                </button>
              </div>

              {/* Section Content */}
              <div className="bg-stone-50/40 p-4 sm:p-5 rounded-xl border border-stone-100">
                <MarkdownRenderer content={section.content} highlightTerms={highlightTerms} />
              </div>

              {/* Key Takeaway Callout */}
              {section.keyTakeaway && (
                <div className="p-3 bg-amber-50/70 border-l-3 border-amber-600 rounded-r-lg text-xs text-stone-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-950">Core Takeaway: </span>
                    {section.keyTakeaway}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Key Terms & Glossary */}
        {notes.keyTerms && notes.keyTerms.length > 0 && (
          <div className="pt-6 border-t border-stone-200 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-700" />
              <h3 className="text-base font-bold text-stone-900 font-display">
                Key Terminology & Essential Formulas
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {notes.keyTerms.map((term, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-amber-50/30 transition-colors space-y-1.5"
                >
                  <div className="font-bold text-xs text-amber-950 flex items-center justify-between">
                    <span>{term.term}</span>
                    {term.exampleOrFormula && (
                      <span className="text-[10px] font-mono-code bg-white px-1.5 py-0.5 rounded border border-stone-200 text-stone-600">
                        {term.exampleOrFormula}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{term.definition}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Misconceptions & Pitfalls (Myth vs Reality) */}
        {notes.misconceptions && notes.misconceptions.length > 0 && (
          <div className="pt-6 border-t border-stone-200 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-base font-bold text-stone-900 font-display">
                Common Exam Pitfalls & Misconceptions
              </h3>
            </div>

            <div className="space-y-2.5">
              {notes.misconceptions.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-stone-200 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <div className="text-xs space-y-1 bg-rose-50/60 p-2.5 rounded-lg border border-rose-100">
                    <span className="font-semibold text-rose-900 block flex items-center gap-1">
                      <span>✕ Common Myth</span>
                    </span>
                    <p className="text-stone-700">{item.myth}</p>
                  </div>
                  <div className="text-xs space-y-1 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-100">
                    <span className="font-semibold text-emerald-900 block flex items-center gap-1">
                      <span>✓ Scientific Reality</span>
                    </span>
                    <p className="text-stone-700">{item.reality}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exam Strategy Tips */}
        {notes.examTips && notes.examTips.length > 0 && (
          <div className="pt-6 border-t border-stone-200 space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              <h3 className="text-base font-bold text-stone-900 font-display">
                High-Yield Exam Strategy & Scoring Tips
              </h3>
            </div>
            <ul className="space-y-2">
              {notes.examTips.map((tip, idx) => (
                <li key={idx} className="text-xs text-stone-700 flex items-start gap-2 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                  <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Self-Test Active Recall Prompts */}
        {notes.selfTestQuestions && notes.selfTestQuestions.length > 0 && (
          <div className="pt-6 border-t border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-stone-900 font-display">
                  Active Recall Self-Checks
                </h3>
              </div>
              <span className="text-[11px] text-stone-500">Test yourself before proceeding</span>
            </div>

            <div className="space-y-2">
              {notes.selfTestQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex items-center justify-between gap-3"
                >
                  <span className="text-stone-800 font-medium">{q}</span>
                  <button
                    onClick={() => onOpenTutor(`How should I think about this review question: "${q}"?`)}
                    className="text-[11px] text-amber-800 hover:underline shrink-0 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>Check with Tutor</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Call to Actions: Summarize & Quiz */}
        <div className="no-print pt-8 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-stone-50/70 p-5 rounded-2xl border">
          <div>
            <h4 className="text-sm font-bold text-stone-900 font-display">Ready to test your retention?</h4>
            <p className="text-xs text-stone-500">
              Summarize these notes into interactive flashcards or launch a practice quiz.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onGenerateSummary}
              disabled={isGeneratingSummary}
              className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{isGeneratingSummary ? 'Summarizing...' : 'Summarize Notes'}</span>
            </button>

            <button
              onClick={onGenerateQuiz}
              disabled={isGeneratingQuiz}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Award className="w-3.5 h-3.5" />
              <span>{isGeneratingQuiz ? 'Building Quiz...' : 'Take Practice Quiz'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
