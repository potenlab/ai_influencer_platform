'use client';

import { useState, useRef } from 'react';
import type { Character, HistoryMedia } from '@/app/types';

export interface FileLibraryProps {
  open: boolean;
  onClose: () => void;
  title: string;
  apiBase?: string;

  onUpload?: (file: File) => void;
  uploadLabel?: string;
  autoCloseOnUpload?: boolean;
  autoCloseOnSelect?: boolean;

  images: HistoryMedia[];
  onSelect: (imagePath: string) => void;
  selectedImagePath: string | null;
  nullMeansCharacterSelected?: boolean;

  character?: Character | null;
  showCharacterIdPhoto?: boolean;

  characterTabLabel?: string;
  uploadedTabLabel?: string;
  noCharacterImagesMsg?: string;
  noUploadedImagesMsg?: string;
}

export default function FileLibrary({
  open,
  onClose,
  title,
  apiBase = '',
  onUpload,
  uploadLabel = 'Upload New',
  autoCloseOnUpload = true,
  autoCloseOnSelect = true,
  images,
  onSelect,
  selectedImagePath,
  nullMeansCharacterSelected = false,
  character,
  showCharacterIdPhoto = true,
  characterTabLabel = 'Character',
  uploadedTabLabel = 'Uploaded',
  noCharacterImagesMsg = 'No character images',
  noUploadedImagesMsg = 'No uploaded images',
}: FileLibraryProps) {
  const [activeTab, setActiveTab] = useState<'character' | 'uploaded'>('character');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  // Derive uploaded (reference) images — unique by reference_image_path
  const uploadedImages: { id: number; path: string; prompt: string | null }[] = [];
  const seenPaths = new Set<string>();
  for (const img of images) {
    if (img.reference_image_path && !seenPaths.has(img.reference_image_path)) {
      seenPaths.add(img.reference_image_path);
      uploadedImages.push({ id: img.id, path: img.reference_image_path, prompt: img.prompt });
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
      if (autoCloseOnUpload) onClose();
    }
  };

  const handleSelect = (imagePath: string) => {
    onSelect(imagePath);
    if (autoCloseOnSelect) onClose();
  };

  const isSelected = (imagePath: string) => {
    if (selectedImagePath === imagePath) return true;
    if (nullMeansCharacterSelected && !selectedImagePath && character?.image_path === imagePath) return true;
    return false;
  };

  /* ── Character tab ── */
  const renderCharacterTab = () => {
    const hasCharId = showCharacterIdPhoto && character?.image_path;
    const hasImages = images.length > 0;

    if (!hasCharId && !hasImages) {
      return (
        <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
          {noCharacterImagesMsg}
        </p>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-2">
        {/* Character ID photo tile */}
        {hasCharId && (
          <div
            onClick={() => handleSelect(character!.image_path)}
            className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all relative"
            style={{
              border: isSelected(character!.image_path)
                ? '2px solid var(--accent)'
                : '2px solid transparent',
            }}
          >
            <img
              src={`${apiBase}${character!.image_path}`}
              alt={character!.name}
              className="w-full h-full object-cover"
            />
            <span
              className="absolute bottom-0 left-0 right-0 text-center text-[10px] py-0.5"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-muted)' }}
            >
              ID
            </span>
          </div>
        )}

        {/* Image tiles */}
        {images.map((img) => {
          const path = img.file_path;
          if (!path) return null;
          return (
            <div
              key={img.id}
              onClick={() => handleSelect(path)}
              className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all"
              style={{
                border: isSelected(path)
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
              }}
            >
              <img
                src={`${apiBase}${path}`}
                alt={img.prompt || 'Image'}
                className="w-full h-full object-cover"
              />
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Uploaded tab ── */
  const renderUploadedTab = () => (
    <>
      {/* Upload button */}
      {onUpload && (
        <label
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl cursor-pointer text-sm font-medium transition-all mb-3"
          style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)', color: 'var(--text-secondary)' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={handleFileChange}
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {uploadLabel}
        </label>
      )}

      {uploadedImages.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {uploadedImages.map((img) => (
            <div
              key={`ref-${img.id}`}
              onClick={() => handleSelect(img.path)}
              className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all"
              style={{
                border: isSelected(img.path)
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
              }}
            >
              <img
                src={`${apiBase}${img.path}`}
                alt={img.prompt || 'Image'}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
          {noUploadedImagesMsg}
        </p>
      )}
    </>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-20 lg:bg-transparent"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="z-30 flex flex-col fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl lg:top-0 lg:left-[440px] lg:bottom-0 lg:right-auto lg:w-[360px] lg:max-h-none lg:rounded-t-none lg:rounded-r-2xl"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            &times;
          </button>
        </div>

        {/* Tab bar — full width, matching reference UI */}
        <div
          className="flex mx-4 mb-3 rounded-xl p-1 shrink-0"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setActiveTab('character')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeTab === 'character'
                ? 'linear-gradient(135deg, var(--accent), #a855f7)'
                : 'transparent',
              color: activeTab === 'character' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {characterTabLabel}
          </button>
          <button
            onClick={() => setActiveTab('uploaded')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeTab === 'uploaded'
                ? 'linear-gradient(135deg, var(--accent), #a855f7)'
                : 'transparent',
              color: activeTab === 'uploaded' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {uploadedTabLabel}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {activeTab === 'character' ? renderCharacterTab() : renderUploadedTab()}
        </div>
      </div>
    </>
  );
}
