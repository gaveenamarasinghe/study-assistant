import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Trash2,
  Calendar,
  Layers,
  Award,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { SavedStudyTopic } from '../types/study';

interface LibraryViewProps {
  topics: SavedStudyTopic[];
  onSelectTopic: (topic: SavedStudyTopic, initialTab?: 'notes' | 'summary' | 'quiz') => void;
  onDeleteTopic: (id: string) => void;
  onOpenNewTopicModal: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  topics,
  onSelectTopic,
  onDeleteTopic,
  onOpenNewTopicModal,
}) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  const filtered = topics.filter((t) => {
    const matchesSearch =
      t.topic.toLowerCase().includes(search.toLowerCase()) ||
      t.notes?.title.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === 'all' || t.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
              Your Study Library
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Saved topics, study notes, revision summaries, and quizzes
            </p>
          </div>

          <button
            onClick={onOpenNewTopicModal}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Study Topic</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by topic name, keyword..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
            />
          </div>

          <div>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
            >
              <option value="all">All Academic Levels</option>
              <option value="High School">High School</option>
              <option value="Undergraduate">Undergraduate</option>
              <option value="Master's / Professional">Master's / Professional</option>
              <option value="Conceptual Beginner">Beginner</option>
            </select>
          </div>
        </div>
      </div>

      {/* Topics Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200/90 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-stone-800">No study topics found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Try adjusting your search criteria or create a new topic to generate notes, summaries, and quizzes.
          </p>
          <button
            onClick={onOpenNewTopicModal}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate First Topic</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-stone-200/90 hover:border-amber-400/80 hover:shadow-sm transition-all p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span className="font-semibold text-amber-900">{item.level}</span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-stone-400" />
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-amber-950 transition-colors font-display">
                  {item.topic}
                </h2>

                {item.notes?.summaryBrief && (
                  <p className="text-xs text-stone-600 line-clamp-1 max-w-xl">
                    {item.notes.summaryBrief}
                  </p>
                )}

                {/* Available artifacts tags */}
                <div className="flex items-center gap-3 pt-1 text-[11px] text-stone-500">
                  {item.notes && (
                    <span className="flex items-center gap-1 text-stone-700 font-medium">
                      <BookOpen className="w-3 h-3 text-amber-600" /> Notes ({item.notes.sections.length} parts)
                    </span>
                  )}
                  {item.summary && (
                    <span className="flex items-center gap-1 text-stone-700 font-medium">
                      <Layers className="w-3 h-3 text-amber-600" /> Flashcards ({item.summary.flashcards.length})
                    </span>
                  )}
                  {item.quiz && (
                    <span className="flex items-center gap-1 text-stone-700 font-medium">
                      <Award className="w-3 h-3 text-amber-600" /> Quiz ({item.quiz.questions.length} Qs)
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                <button
                  onClick={() => onSelectTopic(item, 'notes')}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-amber-50 hover:border-amber-300 text-stone-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Notes
                </button>
                <button
                  onClick={() => onSelectTopic(item, 'summary')}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-amber-50 hover:border-amber-300 text-stone-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Flashcards
                </button>
                <button
                  onClick={() => onSelectTopic(item, 'quiz')}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  Quiz
                </button>

                <button
                  onClick={() => onDeleteTopic(item.id)}
                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
                  title="Delete topic from library"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
