import React, { useState } from 'react';
import { X, Sparkles, BookOpen, Layers, Target, Compass, Loader2 } from 'lucide-react';

interface NewTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: {
    topic: string;
    level: string;
    depth: string;
    focusArea: string;
  }) => void;
  isLoading: boolean;
}

const PRESET_TOPICS = [
  { topic: 'Quantum Entanglement & Bell\'s Inequality', category: 'Physics', level: 'Undergraduate' },
  { topic: 'Photosynthesis: Light Reactions & Calvin Cycle', category: 'Biology', level: 'High School' },
  { topic: 'Game Theory: Nash Equilibrium & Prisoner\'s Dilemma', category: 'Economics', level: 'Undergraduate' },
  { topic: 'Neural Networks: Backpropagation & Gradient Descent', category: 'Computer Science', level: 'Master\'s / Professional' },
  { topic: 'The Causes and Consequences of World War I', category: 'History', level: 'High School' },
  { topic: 'Organic Chemistry: SN1 vs SN2 Reaction Mechanisms', category: 'Chemistry', level: 'Undergraduate' },
  { topic: 'Supply & Demand Elasticity in Microeconomics', category: 'Business', level: 'Undergraduate' },
  { topic: 'Central Limit Theorem & Hypothesis Testing', category: 'Statistics', level: 'Undergraduate' },
];

export const NewTopicModal: React.FC<NewTopicModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Undergraduate');
  const [depth, setDepth] = useState('Comprehensive');
  const [focusArea, setFocusArea] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onSubmit({
      topic: topic.trim(),
      level,
      depth,
      focusArea: focusArea.trim(),
    });
  };

  const handleSelectPreset = (preset: typeof PRESET_TOPICS[0]) => {
    setTopic(preset.topic);
    setLevel(preset.level);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900 font-display">Explore New Study Topic</h3>
              <p className="text-xs text-stone-500">Generate structured study notes, summaries, and test quizzes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Topic Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-800 flex items-center justify-between">
              <span>Topic or Subject to Study</span>
              <span className="text-[11px] font-normal text-stone-400">e.g. Concept, theorem, period, or mechanism</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Cellular Respiration, Quantum Computing, French Revolution..."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all font-medium text-stone-900"
              autoFocus
              required
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
              <Compass className="w-3 h-3 text-stone-400" />
              Quick Suggestions
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {PRESET_TOPICS.map((preset, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleSelectPreset(preset)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900 text-stone-700 transition-colors text-left cursor-pointer"
                >
                  <span className="font-medium">{preset.topic}</span>
                  <span className="text-stone-400 ml-1.5 text-[10px]">· {preset.category}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Configurations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Academic Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                Target Academic Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              >
                <option value="Conceptual Beginner">Beginner / Curious Explorer</option>
                <option value="High School">High School (AP / IB / GCSE)</option>
                <option value="Undergraduate">Undergraduate (College Level)</option>
                <option value="Master's / Professional">Master's / Research / Professional</option>
              </select>
            </div>

            {/* Depth / Scope */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-stone-400" />
                Study Depth
              </label>
              <select
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              >
                <option value="Comprehensive">Comprehensive (Full Detailed Guide)</option>
                <option value="Exam Cram">High-Yield Exam Cram (Crucial Facts & Traps)</option>
                <option value="Concise Synopsis">Concise Overview (Fast 5-min read)</option>
              </select>
            </div>
          </div>

          {/* Optional Focus Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-stone-400" />
              Special Focus Area <span className="text-[11px] font-normal text-stone-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              placeholder="e.g. Focus on mathematical derivations, clinical cases, or key historical dates"
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !topic.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Study Notes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Study Notes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
