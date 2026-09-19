import React, { useState, useEffect } from 'react';
import { Template } from '../types';
import { ICON_MAP, CATEGORIES, CATEGORY_COLORS } from '../constants';
import { X, Save, Trash2, Plus, LayoutGrid, Quote, Terminal, FileJson, Sparkles, User, Shield, MessageSquare } from 'lucide-react';
import { nanoid } from 'nanoid';

interface LibraryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  onUpdateTemplate: (index: number, template: Template) => void;
  onAddTemplate: (template: Template) => void;
  onDeleteTemplate: (index: number) => void;
}

const AVAILABLE_ICONS = ['User', 'MessageSquare', 'Sparkles', 'Shield', 'Terminal', 'FileJson', 'Quote'];

const LibraryManager: React.FC<LibraryManagerProps> = ({ 
  isOpen, 
  onClose, 
  templates, 
  onUpdateTemplate, 
  onAddTemplate,
  onDeleteTemplate 
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<Template | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(null);
      setEditedTemplate(null);
    }
  }, [isOpen]);

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setEditedTemplate({ ...templates[index] });
  };

  const handleCreateNew = () => {
    const newTemplate: Template = {
      type: 'instruction',
      title: 'New Preset',
      description: 'Describe functionality...',
      defaultContent: '',
      icon: 'Sparkles',
      category: 'Logic'
    };
    onAddTemplate(newTemplate);
    // Select the newly created item (it will be at the end)
    setTimeout(() => handleSelect(templates.length), 0);
  };

  const handleSave = () => {
    if (selectedIndex !== null && editedTemplate) {
      onUpdateTemplate(selectedIndex, editedTemplate);
      // Optional: Visual feedback or close edit mode? keeping it open allows rapid tweaks.
    }
  };

  const handleDelete = () => {
    if (selectedIndex !== null) {
      onDeleteTemplate(selectedIndex);
      setSelectedIndex(null);
      setEditedTemplate(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div className="relative w-full max-w-5xl h-[90vh] bg-stone-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-serif font-medium text-stone-900">Library Manager</h2>
            <p className="text-sm text-stone-500">Curate your prompt architecture presets.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - 2 Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT: List View */}
          <div className="w-full lg:w-1/3 border-r border-stone-200 bg-stone-50 flex flex-col">
             <div className="p-4 border-b border-stone-200 bg-stone-50/50 backdrop-blur sticky top-0 z-10">
                <button 
                  onClick={handleCreateNew}
                  className="w-full py-2.5 px-4 bg-stone-900 hover:bg-black text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Plus size={16} /> Create New Preset
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {templates.map((t, idx) => {
                  const Icon = ICON_MAP[t.icon];
                  const isSelected = selectedIndex === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(idx)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group relative ${
                        isSelected 
                          ? 'bg-white border-stone-800 shadow-md ring-1 ring-stone-900/5' 
                          : 'bg-white border-stone-200 hover:border-stone-400 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                         <div className={`p-2 rounded-lg ${isSelected ? 'bg-stone-100 text-stone-900' : 'bg-stone-50 text-stone-500 group-hover:text-stone-700'}`}>
                            <Icon size={18} />
                         </div>
                         <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-semibold truncate ${isSelected ? 'text-stone-900' : 'text-stone-700'}`}>
                                {t.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider ${CATEGORY_COLORS[t.category]}`}>
                                    {t.category}
                                </span>
                            </div>
                         </div>
                      </div>
                    </button>
                  );
                })}
             </div>
          </div>

          {/* RIGHT: Editor View */}
          <div className="hidden lg:flex flex-1 bg-white flex-col">
            {selectedIndex !== null && editedTemplate ? (
               <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                     <div className="max-w-2xl mx-auto space-y-8">
                        
                        {/* Title & Icon Grid */}
                        <div className="grid grid-cols-[auto_1fr] gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-stone-500">Icon</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {AVAILABLE_ICONS.map(iconName => {
                                        const I = ICON_MAP[iconName];
                                        return (
                                            <button 
                                                key={iconName}
                                                onClick={() => setEditedTemplate({...editedTemplate, icon: iconName})}
                                                className={`p-2 rounded border flex items-center justify-center transition-all ${
                                                    editedTemplate.icon === iconName 
                                                    ? 'bg-stone-900 text-white border-stone-900' 
                                                    : 'bg-white border-stone-200 hover:bg-stone-50'
                                                }`}
                                            >
                                                <I size={18} />
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-stone-500">Preset Title</label>
                                    <input 
                                        value={editedTemplate.title}
                                        onChange={(e) => setEditedTemplate({...editedTemplate, title: e.target.value})}
                                        className="w-full text-2xl font-serif text-stone-900 border-b border-stone-200 pb-2 focus:border-stone-900 focus:outline-none bg-transparent placeholder:text-stone-300"
                                        placeholder="E.g. Senior Developer"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-stone-500">Category</label>
                                        <select 
                                            value={editedTemplate.category}
                                            onChange={(e) => setEditedTemplate({...editedTemplate, category: e.target.value})}
                                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-stone-400 outline-none"
                                        >
                                            {CATEGORIES.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                     </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-500">Short Description</label>
                            <input 
                                value={editedTemplate.description}
                                onChange={(e) => setEditedTemplate({...editedTemplate, description: e.target.value})}
                                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-400 focus:outline-none"
                                placeholder="Briefly describe what this block does..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-500">Default Prompt Content</label>
                            <div className="relative">
                                <textarea 
                                    value={editedTemplate.defaultContent}
                                    onChange={(e) => setEditedTemplate({...editedTemplate, defaultContent: e.target.value})}
                                    className="w-full h-64 p-4 bg-stone-50 border border-stone-200 rounded-lg font-mono text-sm leading-relaxed focus:border-stone-400 focus:outline-none resize-none"
                                    placeholder="Enter the default text for this block..."
                                />
                                <div className="absolute top-2 right-2 p-1 bg-stone-200 rounded text-[10px] font-mono text-stone-600 pointer-events-none">
                                    MARKDOWN
                                </div>
                            </div>
                        </div>

                     </div>
                  </div>

                  {/* Editor Footer */}
                  <div className="p-4 border-t border-stone-200 bg-white flex justify-between items-center">
                     <button 
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                     >
                        <Trash2 size={16} /> Delete
                     </button>
                     <button 
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-stone-900 text-white hover:bg-black rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow-md"
                     >
                        <Save size={16} /> Save Changes
                     </button>
                  </div>
               </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
                    <LayoutGrid size={48} className="mb-4 opacity-20" />
                    <p className="font-serif text-xl text-stone-300">Select a preset to edit</p>
                </div>
            )}
          </div>
          
          {/* Mobile Placeholder for Right Panel */}
          <div className={`lg:hidden fixed inset-0 z-20 bg-white transform transition-transform duration-300 ${selectedIndex !== null ? 'translate-x-0' : 'translate-x-full'}`}>
              {/* Similar content to Right Panel but adapted for Mobile - omitting for brevity as requested to focus on core functionality, but in real app would replicate form here */}
               <div className="h-full flex flex-col">
                  <div className="p-4 border-b flex items-center gap-2">
                      <button onClick={() => setSelectedIndex(null)} className="p-2"><X size={20}/></button>
                      <span className="font-serif">Edit Preset</span>
                  </div>
                   {/* Reusing editor UI would go here */}
                   <div className="p-8 text-center text-stone-400">Mobile editing simplified for this demo. Switch to desktop for full suite.</div>
               </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LibraryManager;