import React from 'react';
import {
  GraduationCap,
  BookOpen,
  Layers,
  Award,
  Library,
  Plus,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { SavedStudyTopic } from '../types/study';

interface HeaderProps {
  currentTopic: SavedStudyTopic | null;
  savedTopics: SavedStudyTopic[];
  activeView: 'notes' | 'summary' | 'quiz' | 'library';
  onSelectView: (view: 'notes' | 'summary' | 'quiz' | 'library') => void;
  onOpenNewTopic: () => void;
  onOpenTutor: () => void;
  onSwitchTopic: (topic: SavedStudyTopic) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTopic,
  savedTopics,
  activeView,
  onSelectView,
  onOpenNewTopic,
  onOpenTutor,
  onSwitchTopic,
}) => {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-stone-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-stone-900 font-display">
                AI Study Assistant
              </span>
            </div>
            {currentTopic && (
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                <span className="text-amber-800 font-medium truncate max-w-[140px] sm:max-w-[200px]">
                  {currentTopic.topic}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-stone-400">{currentTopic.level}</span>
              </div>
            )}
          </div>
        </div>

        {/* Central Navigation Tabs */}
        <nav className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
          <button
            onClick={() => onSelectView('notes')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeView === 'notes'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Study</span> Notes
          </button>

          <button
            onClick={() => onSelectView('summary')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeView === 'summary'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-700" />
            <span>Summary & Cards</span>
          </button>

          <button
            onClick={() => onSelectView('quiz')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeView === 'quiz'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-700" />
            <span>Practice Quiz</span>
          </button>

          <button
            onClick={() => onSelectView('library')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeView === 'library'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Library className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Library</span>
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Ask Tutor shortcut */}
          <button
            onClick={onOpenTutor}
            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            title="Ask AI Tutor"
          >
            <HelpCircle className="w-4 h-4 text-amber-700" />
          </button>

          {/* New Topic CTA */}
          <button
            onClick={onOpenNewTopic}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Topic</span>
          </button>
        </div>
      </div>
    </header>
  );
};
