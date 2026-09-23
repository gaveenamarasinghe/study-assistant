import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  FileText,
  RotateCw,
  CheckCircle,
  HelpCircle,
  Shuffle,
  Volume2,
  Download,
  Share2,
  ArrowLeft,
  ArrowRight,
  ClipboardCopy,
  Table,
  Upload,
  BookOpen,
  Loader2,
  Award,
  Network,
} from 'lucide-react';
import { SummaryData, Flashcard } from '../types/study';
import { speechService } from '../utils/speech';

interface SummaryViewProps {
  summary: SummaryData;
  topicTitle: string;
  onGenerateQuiz: () => void;
  onSummarizeCustomText: (text: string, title?: string) => Promise<void>;
  isCustomSummarizing?: boolean;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  topicTitle,
  onGenerateQuiz,
  onSummarizeCustomText,
  isCustomSummarizing,
}) => {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'tldr' | 'concept_map' | 'cheatsheet' | 'custom_notes'>('flashcards');

  // Flashcard states
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Record<string, boolean>>({});
  const [cards, setCards] = useState<Flashcard[]>(summary.flashcards || []);
  const [customText, setCustomText] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCards(summary.flashcards || []);
    setCurrentCardIndex(0);
    setIsFlipped(false);
  }, [summary]);

  // Keyboard navigation for flashcards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'flashcards') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === 'ArrowRight') {
        handleNextCard();
      } else if (e.code === 'ArrowLeft') {
        handlePrevCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, currentCardIndex, cards.length]);

  const currentCard = cards[currentCardIndex];

  const handleNextCard = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrevCard = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentCardIndex(0);
    setIsFlipped(false);
  };

  const toggleMastered = (id: string) => {
    setMasteredIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReadSummary = () => {
    const textToRead = `${summary.title}. Executive summary: ${summary.executiveSummary}. Key points: ` + summary.keyBullets.join('. ');
    speechService.speak(textToRead);
  };

  const handleCopyBullets = () => {
    const text = summary.keyBullets.map((b) => `• ${b}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportFlashcards = () => {
    // Export in Anki / TSV format
    const tsv = cards.map((c) => `"${c.front.replace(/"/g, '""')}"\t"${c.back.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(summary.title || 'study').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-flashcards.tsv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    await onSummarizeCustomText(customText, customTopic.trim() || undefined);
    setActiveTab('flashcards');
  };

  const masteredCount = Object.values(masteredIds).filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header & Sub-Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Smart Study Summary & Active Recall</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
              {summary.title || topicTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReadSummary}
              className="px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Listen to summary read aloud"
            >
              <Volume2 className="w-3.5 h-3.5 text-stone-600" />
              <span>Listen</span>
            </button>
            <button
              onClick={onGenerateQuiz}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Take Quiz</span>
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveTab('flashcards')}
            className={`px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'flashcards'
                ? 'bg-amber-100/90 text-amber-950 font-semibold'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Active Recall Flashcards ({cards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tldr')}
            className={`px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'tldr'
                ? 'bg-amber-100/90 text-amber-950 font-semibold'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Executive TL;DR</span>
          </button>

          <button
            onClick={() => setActiveTab('concept_map')}
            className={`px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'concept_map'
                ? 'bg-amber-100/90 text-amber-950 font-semibold'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Concept Map</span>
          </button>

          <button
            onClick={() => setActiveTab('cheatsheet')}
            className={`px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'cheatsheet'
                ? 'bg-amber-100/90 text-amber-950 font-semibold'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Revision Cheat-Sheet</span>
          </button>

          <button
            onClick={() => setActiveTab('custom_notes')}
            className={`px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'custom_notes'
                ? 'bg-amber-100/90 text-amber-950 font-semibold'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Summarize Raw Text</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Interactive Flashcards */}
      {activeTab === 'flashcards' && (
        <div className="space-y-4">
          {cards.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-stone-200">
              <p className="text-stone-500 text-sm">No flashcards generated yet.</p>
            </div>
          ) : (
            <>
              {/* Card Meta & Controls Bar */}
              <div className="flex items-center justify-between text-xs text-stone-500 px-2">
                <div className="flex items-center gap-3">
                  <span>
                    Card <strong className="text-stone-900 font-mono">{currentCardIndex + 1}</strong> of{' '}
                    <strong className="text-stone-900 font-mono">{cards.length}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 font-medium">
                    {masteredCount} Mastered
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShuffle}
                    className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Shuffle cards"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Shuffle</span>
                  </button>
                  <button
                    onClick={handleExportFlashcards}
                    className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Export cards for Anki / Quizlet"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Anki (.tsv)</span>
                  </button>
                </div>
              </div>

              {/* 3D Flip Flashcard */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="group relative h-72 sm:h-80 w-full cursor-pointer select-none perspective-1000"
              >
                <div
                  className={`w-full h-full rounded-2xl transition-all duration-500 transform-style-3d border shadow-sm ${
                    isFlipped ? 'rotate-y-180 bg-stone-900 text-stone-100 border-stone-800' : 'bg-white text-stone-900 border-stone-200/90'
                  }`}
                  style={{
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* FRONT FACE */}
                  <div
                    className="absolute inset-0 p-8 flex flex-col justify-between backface-hidden"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="flex items-center justify-between text-xs text-stone-400">
                      <span className="font-semibold text-amber-800 uppercase tracking-wider text-[10px]">
                        {currentCard.category || 'Core Concept'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-stone-400 group-hover:text-amber-800 transition-colors">
                        <RotateCw className="w-3 h-3" /> Click or Space to flip
                      </span>
                    </div>

                    <div className="text-center my-auto px-4">
                      <p className="text-lg sm:text-xl font-semibold text-stone-900 leading-snug font-display">
                        {currentCard.front}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-400 pt-2 border-t border-stone-100">
                      <span>Front Side</span>
                      <span className="text-[11px]">Prompt / Inquiry</span>
                    </div>
                  </div>

                  {/* BACK FACE */}
                  <div
                    className="absolute inset-0 p-8 flex flex-col justify-between text-stone-100 rotate-y-180 backface-hidden"
                    style={{
                      transform: 'rotateY(180deg)',
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs text-stone-400">
                      <span className="font-semibold text-amber-400 uppercase tracking-wider text-[10px]">
                        Answer & Mechanism
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-stone-400">
                        <RotateCw className="w-3 h-3" /> Click to flip back
                      </span>
                    </div>

                    <div className="text-center my-auto px-4">
                      <p className="text-base sm:text-lg font-medium text-stone-100 leading-relaxed">
                        {currentCard.back}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-400 pt-2 border-t border-stone-800">
                      <span>Back Side</span>
                      <span className="text-[11px] text-amber-300">Explanation / Answer</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flashcard Bottom Controls */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={handlePrevCard}
                  className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                {/* Mark as Mastered button */}
                <button
                  onClick={() => toggleMastered(currentCard.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                    masteredIds[currentCard.id]
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-stone-100 text-stone-700 hover:bg-emerald-50 hover:text-emerald-800 border border-stone-200'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{masteredIds[currentCard.id] ? 'Mastered ✓' : 'Mark as Mastered'}</span>
                </button>

                <button
                  onClick={handleNextCard}
                  className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden mt-4">
                <div
                  className="bg-amber-600 h-full transition-all duration-300"
                  style={{ width: `${((currentCardIndex + 1) / cards.length) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Executive TL;DR & Bullet Breakdown */}
      {activeTab === 'tldr' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <h2 className="text-base font-bold text-stone-900 font-display flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-700" />
              <span>Executive Synthesis</span>
            </h2>
            <p className="text-stone-800 text-sm leading-relaxed p-4 rounded-xl bg-amber-50/60 border border-amber-100">
              {summary.executiveSummary}
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 font-display">
                High-Impact Takeaways
              </h3>
              <button
                onClick={handleCopyBullets}
                className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied!' : 'Copy Takeaways'}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {summary.keyBullets.map((bullet, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/70 text-xs text-stone-800 flex items-start gap-2.5 leading-relaxed"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Concept Map Tree */}
      {activeTab === 'concept_map' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-3">
            <h2 className="text-base font-bold text-stone-900 font-display flex items-center gap-2">
              <Network className="w-4 h-4 text-amber-700" />
              <span>Relational Concept Map</span>
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Cognitive associations and causal mechanisms linking key principles
            </p>
          </div>

          {summary.conceptMap && summary.conceptMap.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {summary.conceptMap.map((node, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2 relative"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                      {node.concept}
                    </span>
                    <span className="text-[11px] text-amber-700 font-semibold px-1.5 py-0.5 rounded bg-amber-50">
                      — {node.relationship} →
                    </span>
                  </div>
                  <div className="text-xs text-stone-700 font-medium pl-1">
                    Connects to:{' '}
                    <strong className="text-stone-900">{node.connectedTo}</strong>
                  </div>
                  {node.note && (
                    <p className="text-[11px] text-stone-500 italic pl-1 border-l-2 border-amber-400">
                      {node.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-stone-500 text-xs">
              Concept map nodes will be populated for this topic.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Revision Cheat-Sheet */}
      {activeTab === 'cheatsheet' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8 space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h2 className="text-base font-bold text-stone-900 font-display flex items-center gap-2">
              <Table className="w-4 h-4 text-amber-700" />
              <span>Rapid Revision Cheat-Sheet</span>
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              High-yield pairings and vital definitions for last-minute review
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-600 font-semibold">
                  <th className="py-2.5 px-3">Metric / Concept</th>
                  <th className="py-2.5 px-3">Rule / Value / Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {summary.cheatSheet.map((item, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-stone-900 whitespace-nowrap">
                      {item.key}
                    </td>
                    <td className="py-2.5 px-3 text-stone-700">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Summarize Custom User Notes */}
      {activeTab === 'custom_notes' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-stone-900 font-display flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-700" />
              <span>Summarize Your Own Lecture Notes or Text</span>
            </h2>
            <p className="text-xs text-stone-500">
              Paste textbook passages, syllabus notes, or lecture transcripts to generate flashcards and cheat-sheets.
            </p>
          </div>

          <form onSubmit={handleCustomSubmit} className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                Topic Title <span className="text-[11px] font-normal text-stone-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. Chapter 4: Photosynthesis & Light Reactions"
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                Source Text / Lecture Notes
              </label>
              <textarea
                rows={6}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste any article, lecture notes, textbook snippet or transcript here..."
                className="w-full text-xs p-3.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 leading-relaxed"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isCustomSummarizing || !customText.trim()}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isCustomSummarizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing & Summarizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Summary & Flashcards</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
