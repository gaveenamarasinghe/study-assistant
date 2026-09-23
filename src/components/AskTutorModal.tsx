import React, { useState } from 'react';
import { X, Sparkles, Send, BookOpen, Lightbulb, GraduationCap, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AskTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: string;
  contextSnippet?: string;
}

export const AskTutorModal: React.FC<AskTutorModalProps> = ({
  isOpen,
  onClose,
  topic,
  contextSnippet,
}) => {
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<'explain' | 'eli5' | 'exam_prep'>('explain');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<
    Array<{ question: string; answer: string; mode: string }>
  >([]);

  if (!isOpen) return null;

  const handleAsk = async (customPrompt?: string, selectedMode?: 'explain' | 'eli5' | 'exam_prep') => {
    const q = customPrompt || question;
    const m = selectedMode || mode;
    if (!q.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/ask-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          contextSnippet,
          question: q,
          mode: m,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer from tutor');
      }

      const data = await res.json();
      setConversation((prev) => [...prev, { question: q, answer: data.answer, mode: m }]);
      setQuestion('');
    } catch (err: any) {
      setConversation((prev) => [
        ...prev,
        {
          question: q,
          answer: `⚠️ Sorry, couldn't reach the tutor: ${err.message || 'Please check your connection and try again.'}`,
          mode: m,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-900 font-display">Personal AI Tutor</h3>
              <p className="text-xs text-stone-500">Ask clarifying questions about <span className="font-medium text-stone-800">{topic}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Context Callout */}
        {contextSnippet && (
          <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-100 text-xs text-amber-900 flex items-start gap-2">
            <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700" />
            <div className="line-clamp-2">
              <span className="font-semibold text-amber-950">Referenced Context: </span>
              {contextSnippet}
            </div>
          </div>
        )}

        {/* Conversation Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversation.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 text-stone-500 flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-amber-600" />
              </div>
              <div className="max-w-md mx-auto">
                <p className="text-sm font-medium text-stone-800">What would you like clarified?</p>
                <p className="text-xs text-stone-500 mt-1">
                  Choose a quick inquiry below or type your own question about this topic.
                </p>
              </div>

              {/* Quick Prompt Starters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left pt-2">
                <button
                  onClick={() => handleAsk(`Can you explain the core mechanism of ${topic} like I am 10 years old?`, 'eli5')}
                  className="p-3 border border-stone-200 rounded-xl hover:border-amber-400 hover:bg-amber-50/40 text-xs transition-all text-stone-700 group cursor-pointer"
                >
                  <div className="font-medium text-stone-900 group-hover:text-amber-900 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    ELI5 Analogy
                  </div>
                  <span className="text-[11px] text-stone-500">Simple real-world explanation for beginners</span>
                </button>

                <button
                  onClick={() => handleAsk(`What is the most common exam question asked about ${topic} and how to answer it?`, 'exam_prep')}
                  className="p-3 border border-stone-200 rounded-xl hover:border-amber-400 hover:bg-amber-50/40 text-xs transition-all text-stone-700 group cursor-pointer"
                >
                  <div className="font-medium text-stone-900 group-hover:text-amber-900 flex items-center gap-1.5 mb-1">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                    Exam Question Breakdown
                  </div>
                  <span className="text-[11px] text-stone-500">How examiners test this specific concept</span>
                </button>

                <button
                  onClick={() => handleAsk(`What are the real-world applications or current breakthroughs in ${topic}?`, 'explain')}
                  className="p-3 border border-stone-200 rounded-xl hover:border-amber-400 hover:bg-amber-50/40 text-xs transition-all text-stone-700 group cursor-pointer"
                >
                  <div className="font-medium text-stone-900 group-hover:text-amber-900 flex items-center gap-1.5 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    Real-World Impact
                  </div>
                  <span className="text-[11px] text-stone-500">Practical and industry use-cases</span>
                </button>
              </div>
            </div>
          ) : (
            conversation.map((item, idx) => (
              <div key={idx} className="space-y-2">
                {/* User Bubble */}
                <div className="flex justify-end">
                  <div className="bg-stone-900 text-stone-100 text-xs rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[85%] shadow-xs">
                    {item.question}
                  </div>
                </div>
                {/* Tutor Answer */}
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 mt-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-stone-100 border border-stone-200/80 rounded-2xl rounded-tl-xs p-3.5 max-w-[90%] text-xs shadow-xs">
                    <MarkdownRenderer content={item.answer} />
                  </div>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-stone-500 italic p-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span>Tutor is formulating a pedagogical response...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-stone-200 bg-stone-50 space-y-2">
          {/* Explanation Mode Segment */}
          <div className="flex items-center gap-1 text-[11px] text-stone-600">
            <span className="text-stone-400 mr-1">Perspective:</span>
            <button
              onClick={() => setMode('explain')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                mode === 'explain' ? 'bg-amber-100 font-semibold text-amber-950' : 'hover:bg-stone-200'
              }`}
            >
              Academic
            </button>
            <button
              onClick={() => setMode('eli5')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                mode === 'eli5' ? 'bg-amber-100 font-semibold text-amber-950' : 'hover:bg-stone-200'
              }`}
            >
              ELI5 (Simple)
            </button>
            <button
              onClick={() => setMode('exam_prep')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                mode === 'exam_prep' ? 'bg-amber-100 font-semibold text-amber-950' : 'hover:bg-stone-200'
              }`}
            >
              Exam Strategy
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask anything about ${topic}...`}
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Ask</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
