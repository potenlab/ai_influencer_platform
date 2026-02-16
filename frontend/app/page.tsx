'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import translations, { type Locale } from './translations';
import { supabase } from './supabaseClient';

// API routes are now same-origin Next.js routes
const API = '';

interface Character {
  id: string;
  name: string;
  content_style: string;
  personality_traits: string[];
  tone_of_voice: string;
  target_audience: string;
  content_themes: string[];
  visual_description: string;
  image_path: string;
}

interface HistoryMedia {
  id: number;
  plan_id: string | null;
  media_type: string;
  file_path: string;
  created_at: string;
  character_id: string;
  character_name: string;
  character_image_path: string;
  // v2 fields
  generation_mode: string | null;
  prompt: string | null;
  video_prompt: string | null;
  first_frame_path: string | null;
  reference_image_path: string | null;
  // legacy plan fields
  plan_title: string | null;
  plan_theme: string | null;
  hook: string | null;
  plan_first_frame_prompt: string | null;
  plan_video_prompt: string | null;
  call_to_action: string | null;
  duration_seconds: number | null;
}

type Step = 'characters' | 'generate' | 'history';
type GenerationMode = 'image' | 'video';
type ImageOption = 'ref_image' | 'text_only';
type VideoOption = 'ref_image' | 'text_only' | 'motion_control';

interface VideoPrepareResult {
  prepare_id: string;
  first_frame_path: string;
  video_prompt: string;
}

interface VideoJob {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  job_type: string;
  // Display metadata (saved at creation time)
  character_name: string;
  character_image_path: string;
  prompt: string;
  first_frame_path?: string;
  result_data?: { media_id?: number; video_path?: string; first_frame_path?: string };
  error_message?: string;
}

export default function Home() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [generatedFirstFrame, setGeneratedFirstFrame] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('characters');

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [concept, setConcept] = useState('');
  const [audience, setAudience] = useState('');
  const [characterImageFile, setCharacterImageFile] = useState<File | null>(null);
  const [charImageMode, setCharImageMode] = useState<'direct' | 'generate'>('direct');

  // Generate step states
  const [prompt, setPrompt] = useState('');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('image');
  const [imageOption, setImageOption] = useState<ImageOption>('ref_image');
  const [videoOption, setVideoOption] = useState<VideoOption>('ref_image');
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [drivingVideoFile, setDrivingVideoFile] = useState<File | null>(null);

  // Video prepare states
  const [videoPrepareResult, setVideoPrepareResult] = useState<VideoPrepareResult | null>(null);
  const [editableVideoPrompt, setEditableVideoPrompt] = useState('');

  // Async video job states
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);

  // History states
  const [historyMedia, setHistoryMedia] = useState<HistoryMedia[]>([]);
  const [historyCharFilter, setHistoryCharFilter] = useState<string>('');
  const [historyMediaTypeFilter, setHistoryMediaTypeFilter] = useState<string>('');
  const [historyDetail, setHistoryDetail] = useState<HistoryMedia | null>(null);

  // Spicy mode (use xai/grok-imagine-image instead of nano-banana-pro)
  const [spicyMode, setSpicyMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('spicyMode') === 'true';
    }
    return false;
  });

  // i18n
  const [locale, setLocale] = useState<Locale>('ko');
  const t = (key: string) => translations[locale][key] || key;

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const charImageInputRef = useRef<HTMLInputElement>(null);

  // Character image preview URL
  const [charImagePreview, setCharImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (characterImageFile) {
      const url = URL.createObjectURL(characterImageFile);
      setCharImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCharImagePreview(null);
    }
  }, [characterImageFile]);

  // Prevent browser from opening dropped files (navigating away)
  useEffect(() => {
    const preventDrop = (e: DragEvent) => { e.preventDefault(); };
    document.addEventListener('dragover', preventDrop);
    document.addEventListener('drop', preventDrop);
    return () => {
      document.removeEventListener('dragover', preventDrop);
      document.removeEventListener('drop', preventDrop);
    };
  }, []);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');
      setIsAdmin(session.user.user_metadata?.role === 'admin');
      setAuthReady(true);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || '';
    return { Authorization: `Bearer ${token}` };
  };

  // Authenticated fetch wrapper
  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const authHeaders = await getAuthHeaders();
    const headers = { ...authHeaders, ...(options.headers || {}) };
    return fetch(url, { ...options, headers });
  };

  // Poll a single job until terminal state
  const pollJob = useCallback(async (jobId: string) => {
    const poll = async () => {
      try {
        const res = await authFetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setVideoJobs((prev) =>
          prev.map((j) =>
            j.job_id === jobId
              ? { ...j, status: data.status, result_data: data.result_data, error_message: data.error_message }
              : j
          )
        );
        if (data.status === 'completed') {
          // Auto-refresh history if user is on history tab
          setCurrentStep((step) => {
            if (step === 'history') {
              loadHistory(historyCharFilter || undefined, historyMediaTypeFilter || undefined);
            }
            return step;
          });
          // Remove completed job from skeleton list after history reloads
          setTimeout(() => {
            setVideoJobs((prev) => prev.filter((j) => j.job_id !== jobId));
          }, 2000);
          return; // stop polling
        }
        if (data.status === 'failed') {
          return; // stop polling
        }
        // Keep polling
        setTimeout(poll, 3000);
      } catch {
        // Retry on network error
        setTimeout(poll, 5000);
      }
    };
    poll();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved === 'ko' || saved === 'en') setLocale(saved);
  }, []);

  useEffect(() => {
    if (authReady) loadCharacters();
  }, [authReady]);

  // Preview reference image
  useEffect(() => {
    if (referenceImageFile) {
      const url = URL.createObjectURL(referenceImageFile);
      setReferenceImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setReferenceImagePreview(null);
    }
  }, [referenceImageFile]);

  const loadCharacters = async () => {
    try {
      const res = await authFetch(`${API}/api/characters`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setCharacters(data);
    } catch {
      console.error('Failed to load characters');
    }
  };

  const loadHistory = async (characterId?: string, mediaType?: string) => {
    try {
      const params = new URLSearchParams();
      if (characterId) params.set('character_id', characterId);
      if (mediaType) params.set('media_type', mediaType);
      const qs = params.toString();
      const url = `${API}/api/media/history${qs ? `?${qs}` : ''}`;
      const res = await authFetch(url);
      const data = await res.json();
      setHistoryMedia(data);
    } catch {
      console.error('Failed to load history');
    }
  };

  const clearError = () => setError('');

  const switchLocale = (l: Locale) => {
    setLocale(l);
    localStorage.setItem('locale', l);
  };

  const createCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    setLoadingMessage(t('loadingCreateCharacter'));

    try {
      let imageUrl: string | undefined;

      if (characterImageFile) {
        // Upload image first
        const formData = new FormData();
        formData.append('file', characterImageFile);
        const uploadRes = await authFetch(`/api/upload/image`, {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || 'Failed to upload image');
        }
        const uploadResult = await uploadRes.json();
        imageUrl = uploadResult.web_path;
      }

      const res = await authFetch(`/api/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          concept,
          audience: audience || 'General audience',
          image_url: imageUrl,
          image_mode: characterImageFile ? charImageMode : undefined,
          spicy: spicyMode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create character');
      }

      const newChar = await res.json();
      setName('');
      setConcept('');
      setAudience('');
      setCharacterImageFile(null);
      if (charImageInputRef.current) charImageInputRef.current.value = '';
      setShowCreateForm(false);
      await loadCharacters();
      setSelectedCharacter(newChar);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const deleteCharacter = async (characterId: string) => {
    if (!window.confirm(t('confirmDeleteCharacter'))) return;

    clearError();
    setLoading(true);
    setLoadingMessage(t('loadingDeleteCharacter'));

    try {
      const res = await authFetch(`${API}/api/characters/${characterId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete character');
      }

      await loadCharacters();
      if (selectedCharacter?.id === characterId) {
        setSelectedCharacter(null);
        setCurrentStep('characters');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const uploadReferenceImage = async (): Promise<string | null> => {
    if (!referenceImageFile) return null;

    const formData = new FormData();
    formData.append('file', referenceImageFile);

    const res = await authFetch(`${API}/api/upload/image`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to upload image');
    }

    const result = await res.json();
    return result.web_path;
  };

  const generateImage = async () => {
    if (!selectedCharacter || !prompt.trim()) return;
    clearError();
    setLoading(true);
    setLoadingMessage(t('loadingGenerateImage'));

    try {
      let refPath: string | null = null;
      if (imageOption === 'ref_image' && referenceImageFile) {
        setLoadingMessage(t('loadingUploadRef'));
        refPath = await uploadReferenceImage();
        setLoadingMessage(t('loadingGenerateImage'));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);

      const res = await authFetch(`${API}/api/generate/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedCharacter.id,
          prompt: prompt.trim(),
          option: imageOption,
          reference_image_path: refPath || undefined,
          spicy: spicyMode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate image');
      }

      const result = await res.json();
      setGeneratedImage(result.file_path);
      setGeneratedVideo(null);
      setGeneratedFirstFrame(null);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError(t('errorTimeout'));
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const prepareVideo = async () => {
    if (!selectedCharacter || !prompt.trim()) return;
    clearError();
    setLoading(true);
    setLoadingMessage(t('loadingPrepareVideo'));

    try {
      let refPath: string | null = null;
      if (videoOption === 'ref_image' && referenceImageFile) {
        setLoadingMessage(t('loadingUploadRef'));
        refPath = await uploadReferenceImage();
        setLoadingMessage(t('loadingPrepareVideo'));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);

      const res = await authFetch(`${API}/api/generate/video/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedCharacter.id,
          concept: prompt.trim(),
          option: videoOption === 'ref_image' ? 'ref_image' : 'text_only',
          reference_image_path: refPath || undefined,
          spicy: spicyMode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to prepare video');
      }

      const result: VideoPrepareResult = await res.json();
      setVideoPrepareResult(result);
      setEditableVideoPrompt(result.video_prompt);
      setGeneratedFirstFrame(result.first_frame_path);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError(t('errorTimeout'));
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const finalizeVideo = async () => {
    if (!selectedCharacter || !videoPrepareResult) return;
    clearError();
    setLoading(true);
    setLoadingMessage(t('loadingFinalizeVideo'));

    try {
      const res = await authFetch(`${API}/api/generate/video/final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedCharacter.id,
          first_frame_path: videoPrepareResult.first_frame_path,
          video_prompt: editableVideoPrompt,
          concept: prompt.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit video job');
      }

      const result = await res.json();
      const newJob: VideoJob = {
        job_id: result.job_id,
        status: 'processing',
        job_type: 'video_final',
        character_name: selectedCharacter.name,
        character_image_path: selectedCharacter.image_path,
        prompt: prompt.trim(),
        first_frame_path: videoPrepareResult.first_frame_path,
      };
      setVideoJobs((prev) => [...prev, newJob]);
      pollJob(result.job_id);
      // Reset form so user can start a new video immediately
      setVideoPrepareResult(null);
      setEditableVideoPrompt('');
      setPrompt('');
      setReferenceImageFile(null);
      setGeneratedFirstFrame(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const generateMotionVideo = async () => {
    if (!selectedCharacter || !drivingVideoFile || !prompt.trim()) {
      setError(t('errorMotionRequired'));
      return;
    }

    clearError();
    setLoading(true);
    setLoadingMessage(t('loadingUploadVideo'));

    try {
      // Step 1: Upload driving video
      const formData = new FormData();
      formData.append('file', drivingVideoFile);

      const uploadRes = await authFetch(`${API}/api/media/upload-video`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || 'Failed to upload video');
      }

      const uploadResult = await uploadRes.json();

      // Step 2: Submit to async queue
      setLoadingMessage(t('loadingMotionVideo'));

      const res = await authFetch(`/api/generate/video/motion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedCharacter.id,
          prompt: prompt.trim(),
          driving_video_url: uploadResult.web_path,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit motion video job');
      }

      const result = await res.json();
      const newJob: VideoJob = {
        job_id: result.job_id,
        status: 'processing',
        job_type: 'video_motion',
        character_name: selectedCharacter.name,
        character_image_path: selectedCharacter.image_path,
        prompt: prompt.trim(),
      };
      setVideoJobs((prev) => [...prev, newJob]);
      pollJob(result.job_id);
      // Reset form so user can start a new video immediately
      setPrompt('');
      setDrivingVideoFile(null);
      if (videoInputRef.current) videoInputRef.current.value = '';
      setGeneratedImage(null);
      setGeneratedFirstFrame(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const downloadMedia = (filePath: string) => {
    const a = document.createElement('a');
    a.href = filePath;
    a.download = '';
    a.target = '_blank';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const goToStep = (step: Step) => {
    clearError();
    if (step === 'history') {
      loadHistory(historyCharFilter || undefined, historyMediaTypeFilter || undefined);
    }
    setCurrentStep(step);
  };

  const selectCharacterAndProceed = (char: Character) => {
    setSelectedCharacter(char);
    setGeneratedImage(null);
    setGeneratedVideo(null);
    setGeneratedFirstFrame(null);
    setVideoPrepareResult(null);
    setEditableVideoPrompt('');
    setPrompt('');
    setReferenceImageFile(null);
    setDrivingVideoFile(null);
    setCurrentStep('generate');
  };

  const resetGenerate = () => {
    setGeneratedImage(null);
    setGeneratedVideo(null);
    setGeneratedFirstFrame(null);
    setVideoPrepareResult(null);
    setEditableVideoPrompt('');
  };

  const pillStyle = (active: boolean) => ({
    background: active ? 'var(--accent)' : 'var(--bg-secondary)',
    color: active ? '#fff' : 'var(--text-secondary)',
    cursor: 'pointer' as const,
  });

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{ background: 'rgba(10,10,15,0.8)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <h1
            className="text-sm sm:text-lg font-bold tracking-tight shrink-0"
            style={{ color: 'var(--accent-light)' }}
          >
            <span className="hidden sm:inline">{t('appTitle')}</span>
            <span className="sm:hidden">{t('appTitleShort')}</span>
          </h1>

          {/* Step indicator — 3 steps */}
          <nav className="flex items-center gap-0.5 sm:gap-1">
            {[
              { key: 'characters' as Step, label: t('stepCharacters'), num: 1 },
              { key: 'generate' as Step, label: t('stepGenerate'), num: 2 },
              { key: 'history' as Step, label: t('stepHistory'), num: 3 },
            ].map((s, i) => {
              const isActive = currentStep === s.key;
              const isAccessible =
                s.key === 'characters' ||
                s.key === 'history' ||
                (s.key === 'generate' && selectedCharacter !== null);

              return (
                <div key={s.key} className="flex items-center">
                  {i > 0 && (
                    <div
                      className="w-4 sm:w-8 h-px mx-0.5 sm:mx-1"
                      style={{ background: isAccessible ? 'var(--accent)' : 'var(--border)' }}
                    />
                  )}
                  <button
                    onClick={() => isAccessible && goToStep(s.key)}
                    disabled={!isAccessible}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all"
                    style={{
                      background: isActive ? 'var(--accent)' : 'transparent',
                      color: isActive
                        ? '#fff'
                        : isAccessible
                          ? 'var(--text-secondary)'
                          : 'var(--text-muted)',
                      cursor: isAccessible ? 'pointer' : 'default',
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)',
                        color: isActive ? '#fff' : 'inherit',
                      }}
                    >
                      {s.num}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Spicy + Locale + Admin + Logout */}
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium shrink-0">
            <button
              onClick={() => { const next = !spicyMode; setSpicyMode(next); localStorage.setItem('spicyMode', String(next)); }}
              className="px-1.5 sm:px-2 py-1 rounded transition-all flex items-center gap-1"
              style={{
                color: spicyMode ? '#ff4500' : 'var(--text-muted)',
                background: spicyMode ? 'rgba(255,69,0,0.15)' : 'transparent',
              }}
              title={spicyMode ? t('spicyTitleOn') : t('spicyTitleOff')}
            >
              <span className="text-base">&#x1F336;&#xFE0F;</span>
              <span className="hidden sm:inline">{spicyMode ? t('spicyOn') : t('spicyOff')}</span>
            </button>
            <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>|</span>
            <button
              onClick={() => switchLocale(locale === 'ko' ? 'en' : 'ko')}
              className="px-1.5 sm:px-2 py-1 rounded transition-all"
              style={{ color: 'var(--text-muted)' }}
            >
              {locale === 'ko' ? 'EN' : 'KO'}
            </button>
            {isAdmin && (
              <>
                <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>|</span>
                <button
                  onClick={() => router.push('/admin')}
                  className="px-1.5 sm:px-2 py-1 rounded transition-all"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="hidden sm:inline">{t('admin')}</span>
                  <span className="sm:hidden text-base">&#9881;</span>
                </button>
              </>
            )}
            <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>|</span>
            <button
              onClick={handleLogout}
              className="px-1.5 sm:px-2 py-1 rounded transition-all"
              style={{ color: '#ff6b6b' }}
            >
              <span className="hidden sm:inline">{t('logout')}</span>
              <span className="sm:hidden text-base">&#x2190;</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Loading overlay */}
        {loading && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ background: 'rgba(10,10,15,0.85)' }}
          >
            <div className="text-center animate-fade-in">
              <div className="spinner mx-auto mb-4" style={{ width: 40, height: 40, borderWidth: 3 }} />
              <p style={{ color: 'var(--text-primary)' }} className="text-lg font-medium">
                {loadingMessage}
              </p>
              <p style={{ color: 'var(--text-muted)' }} className="text-sm mt-2">
                {t('pleaseWait')}
              </p>
            </div>
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-lg flex items-center justify-between animate-fade-in"
            style={{ background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.3)' }}
          >
            <span style={{ color: 'var(--error)' }} className="text-sm">{error}</span>
            <button
              onClick={clearError}
              className="ml-4 text-sm font-medium hover:opacity-80"
              style={{ color: 'var(--error)' }}
            >
              {t('close')}
            </button>
          </div>
        )}

        {/* ===== STEP 1: Characters ===== */}
        {currentStep === 'characters' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t('characters')}
                </h2>
                <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('charactersSubtitle')}
                </p>
              </div>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: showCreateForm ? 'var(--bg-card)' : 'var(--accent)',
                  color: '#fff',
                }}
              >
                {showCreateForm ? t('cancel') : t('newCharacter')}
              </button>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div
                className="mb-8 p-6 rounded-xl animate-fade-in"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  {t('createCharacterTitle')}
                </h3>
                <form onSubmit={createCharacter} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {t('labelName')}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      placeholder={t('placeholderName')}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {t('labelConcept')}
                    </label>
                    <textarea
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      rows={3}
                      placeholder={t('placeholderConcept')}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {t('labelAudience')}
                    </label>
                    <input
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      placeholder={t('placeholderAudience')}
                      required
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {t('uploadCharacterImage')}
                    </span>
                    <div
                      className="relative rounded-lg text-center transition-all"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '2px dashed var(--border)',
                        padding: characterImageFile ? '8px' : '24px 16px',
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--border)'; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.borderColor = 'var(--border)';
                        const file = e.dataTransfer.files?.[0];
                        if (file && /^image\/(png|jpe?g|webp)$/.test(file.type)) {
                          setCharacterImageFile(file);
                        }
                      }}
                    >
                      {characterImageFile && charImagePreview ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={charImagePreview}
                            alt="Preview"
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                          <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                            {characterImageFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setCharacterImageFile(null); if (charImageInputRef.current) charImageInputRef.current.value = ''; }}
                            className="text-xs px-2 py-1 rounded"
                            style={{ color: 'var(--error)' }}
                          >
                            {t('remove')}
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <input
                            ref={charImageInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setCharacterImageFile(file);
                            }}
                          />
                          <div className="text-2xl mb-1" style={{ color: 'var(--text-muted)' }}>+</div>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {t('dropOrClick')}
                          </p>
                        </label>
                      )}
                    </div>
                    {characterImageFile && (
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => setCharImageMode('direct')}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                          style={pillStyle(charImageMode === 'direct')}
                        >
                          {t('imageModeDirect')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCharImageMode('generate')}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                          style={pillStyle(charImageMode === 'generate')}
                        >
                          {t('imageModeGenerate')}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-lg text-sm font-semibold transition-all"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {t('createCharacterBtn')}
                  </button>
                </form>
              </div>
            )}

            {/* Character grid */}
            {characters.length === 0 && !showCreateForm ? (
              <div
                className="text-center py-20 rounded-xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="text-4xl mb-4">&#x1F464;</div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('noCharacters')}
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {t('createFirstCharacter')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map((char) => (
                  <div
                    key={char.id}
                    className="group relative text-left p-0 rounded-xl overflow-hidden transition-all cursor-pointer"
                    style={{
                      background: 'var(--bg-card)',
                      border: selectedCharacter?.id === char.id
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                    }}
                    onClick={() => selectCharacterAndProceed(char)}
                  >
                    {/* Delete button — always visible on mobile, hover on desktop */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCharacter(char.id); }}
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        backdropFilter: 'blur(4px)',
                      }}
                      title={t('deleteCharacter')}
                    >
                      &times;
                    </button>
                    {char.image_path && (
                      <div className="aspect-square overflow-hidden">
                        <img
                          src={`${API}${char.image_path}`}
                          alt={char.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {char.name}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {char.content_style} &middot; {char.tone_of_voice}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {char.personality_traits.slice(0, 3).map((trait, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 2: Generate ===== */}
        {currentStep === 'generate' && selectedCharacter && (
          <div className="animate-fade-in">
            {/* Character summary bar */}
            <div
              className="flex items-center gap-4 mb-8 p-4 rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              {selectedCharacter.image_path && (
                <img
                  src={`${API}${selectedCharacter.image_path}`}
                  alt={selectedCharacter.name}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {selectedCharacter.name}
                </h3>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {selectedCharacter.content_style} &middot; {selectedCharacter.tone_of_voice}
                </p>
              </div>
              <button
                onClick={() => goToStep('characters')}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                {t('changeCharacter')}
              </button>
            </div>

            {/* Mode selector: Image / Video */}
            <div className="mb-6">
              <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                {t('generationMode')}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setGenerationMode('image'); resetGenerate(); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={pillStyle(generationMode === 'image')}
                >
                  {t('generateImage')}
                </button>
                <button
                  onClick={() => { setGenerationMode('video'); resetGenerate(); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={pillStyle(generationMode === 'video')}
                >
                  {t('generateVideo')}
                </button>
              </div>
            </div>

            {/* ── Image Mode ── */}
            {generationMode === 'image' && (
              <div
                className="mb-6 p-5 rounded-xl space-y-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                {/* Option pills */}
                <div>
                  <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                    {t('imageOption')}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setImageOption('ref_image')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={pillStyle(imageOption === 'ref_image')}
                    >
                      {t('useRefImage')}
                    </button>
                    <button
                      onClick={() => setImageOption('text_only')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={pillStyle(imageOption === 'text_only')}
                    >
                      {t('textOnly')}
                    </button>
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {t('promptRequired')}
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                    rows={3}
                    placeholder={t('placeholderImagePrompt')}
                    required
                  />
                </div>

                {/* Reference image upload (only for ref_image option) */}
                {imageOption === 'ref_image' && (
                  <div>
                    <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                      {t('refImageUploadOptional')}
                    </span>
                    <div
                      className="relative rounded-lg text-center transition-all"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '2px dashed var(--border)',
                        padding: referenceImageFile ? '8px' : '24px 16px',
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--border)'; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.borderColor = 'var(--border)';
                        const file = e.dataTransfer.files?.[0];
                        if (file && /^image\/(png|jpe?g|webp)$/.test(file.type)) {
                          setReferenceImageFile(file);
                        }
                      }}
                    >
                      {referenceImageFile && referenceImagePreview ? (
                        <div className="flex items-center gap-3">
                          <img src={referenceImagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                          <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{referenceImageFile.name}</span>
                          <button
                            onClick={() => { setReferenceImageFile(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                            className="text-xs px-2 py-1 rounded"
                            style={{ color: 'var(--error)' }}
                          >
                            {t('remove')}
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) setReferenceImageFile(file); }}
                          />
                          <div className="text-2xl mb-1" style={{ color: 'var(--text-muted)' }}>+</div>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dropOrClick')}</p>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Generate button */}
                <button
                  onClick={generateImage}
                  disabled={loading || !prompt.trim()}
                  className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 glow-pulse"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {t('generateImage')}
                </button>
              </div>
            )}

            {/* ── Video Mode ── */}
            {generationMode === 'video' && (
              <div
                className="mb-6 p-5 rounded-xl space-y-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                {/* Option pills */}
                <div>
                  <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                    {t('videoOption')}
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => { setVideoOption('ref_image'); resetGenerate(); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={pillStyle(videoOption === 'ref_image')}
                    >
                      {t('refImageToVideo')}
                    </button>
                    <button
                      onClick={() => { setVideoOption('text_only'); resetGenerate(); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={pillStyle(videoOption === 'text_only')}
                    >
                      {t('textOnlyToVideo')}
                    </button>
                    <button
                      onClick={() => { setVideoOption('motion_control'); resetGenerate(); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={pillStyle(videoOption === 'motion_control')}
                    >
                      {t('videoToVideo')}
                    </button>
                  </div>
                </div>

                {/* ── Video options 1 & 2: ref_image / text_only ── */}
                {(videoOption === 'ref_image' || videoOption === 'text_only') && (
                  <>
                    {/* Concept textarea */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {t('conceptRequired')}
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                        rows={3}
                        placeholder={t('placeholderVideoConcept')}
                        required
                      />
                    </div>

                    {/* Reference image upload (option 1 only) */}
                    {videoOption === 'ref_image' && (
                      <div>
                        <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                          {t('refImageUploadOptionalShort')}
                        </span>
                        <div
                          className="relative rounded-lg text-center transition-all"
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '2px dashed var(--border)',
                            padding: referenceImageFile ? '8px' : '24px 16px',
                          }}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--border)'; }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.style.borderColor = 'var(--border)';
                            const file = e.dataTransfer.files?.[0];
                            if (file && /^image\/(png|jpe?g|webp)$/.test(file.type)) {
                              setReferenceImageFile(file);
                            }
                          }}
                        >
                          {referenceImageFile && referenceImagePreview ? (
                            <div className="flex items-center gap-3">
                              <img src={referenceImagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                              <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{referenceImageFile.name}</span>
                              <button
                                onClick={() => { setReferenceImageFile(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                                className="text-xs px-2 py-1 rounded"
                                style={{ color: 'var(--error)' }}
                              >
                                {t('remove')}
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer block">
                              <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="sr-only"
                                onChange={(e) => { const file = e.target.files?.[0]; if (file) setReferenceImageFile(file); }}
                              />
                              <div className="text-2xl mb-1" style={{ color: 'var(--text-muted)' }}>+</div>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dropOrClick')}</p>
                            </label>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Prepare button */}
                    {!videoPrepareResult && (
                      <button
                        onClick={prepareVideo}
                        disabled={loading || !prompt.trim()}
                        className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 glow-pulse"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                      >
                        {t('preparePrompt')}
                      </button>
                    )}

                    {/* Prepare result */}
                    {videoPrepareResult && (
                      <div className="space-y-4 animate-fade-in">
                        {/* First frame preview */}
                        {generatedFirstFrame && (
                          <div
                            className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid var(--border)' }}
                          >
                            <div className="px-4 py-2" style={{ background: 'var(--bg-secondary)' }}>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                {t('firstFramePreview')}
                              </span>
                            </div>
                            <img
                              src={`${API}${generatedFirstFrame}`}
                              alt="First frame"
                              className="w-full"
                            />
                          </div>
                        )}

                        {/* Editable video prompt */}
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            {t('videoPromptEditable')}
                          </label>
                          <textarea
                            value={editableVideoPrompt}
                            onChange={(e) => setEditableVideoPrompt(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none transition-all resize-none"
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border)',
                              color: 'var(--accent-light)',
                            }}
                            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                            rows={5}
                          />
                        </div>

                        {/* Duration info */}
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {t('durationInfo')}
                        </p>

                        {/* Finalize button */}
                        <button
                          onClick={finalizeVideo}
                          disabled={loading || !editableVideoPrompt.trim()}
                          className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 glow-pulse"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          {t('generateVideo')}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* ── Video option 3: Motion Control ── */}
                {videoOption === 'motion_control' && (
                  <>
                    {/* Prompt */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {t('promptRequired')}
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                        rows={3}
                        placeholder={t('placeholderMotionPrompt')}
                        required
                      />
                    </div>

                    {/* Video file upload */}
                    <div>
                      <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                        {t('refVideoUpload')}
                      </span>
                      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                        {t('motionDescription')}
                      </p>
                      <div
                        className="relative rounded-lg text-center transition-all"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '2px dashed var(--border)',
                          padding: drivingVideoFile ? '8px' : '24px 16px',
                        }}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--border)'; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.style.borderColor = 'var(--border)';
                          const file = e.dataTransfer.files?.[0];
                          if (file && /^video\/(mp4|mov|webm|quicktime)$/.test(file.type)) {
                            setDrivingVideoFile(file);
                          }
                        }}
                      >
                        {drivingVideoFile ? (
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 rounded-lg flex items-center justify-center text-2xl" style={{ background: 'var(--bg-card)' }}>
                              &#9654;
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <span className="text-sm truncate block" style={{ color: 'var(--text-primary)' }}>{drivingVideoFile.name}</span>
                              <span className="text-xs" style={{ color: 'var(--accent-light)' }}>{(drivingVideoFile.size / 1024 / 1024).toFixed(1)} MB</span>
                            </div>
                            <button
                              onClick={() => { setDrivingVideoFile(null); if (videoInputRef.current) videoInputRef.current.value = ''; }}
                              className="text-xs px-2 py-1 rounded"
                              style={{ color: 'var(--error)' }}
                            >
                              {t('remove')}
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer block">
                            <input
                              ref={videoInputRef}
                              type="file"
                              accept="video/mp4,video/mov,video/webm"
                              className="sr-only"
                              onChange={(e) => { const file = e.target.files?.[0]; if (file) setDrivingVideoFile(file); }}
                            />
                            <div className="text-2xl mb-1" style={{ color: 'var(--text-muted)' }}>+</div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dropOrClickVideo')}</p>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Generate button */}
                    <button
                      onClick={generateMotionVideo}
                      disabled={loading || !prompt.trim() || !drivingVideoFile}
                      className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 glow-pulse"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      {t('generateMotionVideo')}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Active Jobs Status */}
            {videoJobs.length > 0 && (
              <div className="mb-6 space-y-3 animate-fade-in">
                {videoJobs.map((job) => {
                  const isActive = job.status === 'pending' || job.status === 'processing';
                  const isDone = job.status === 'completed';
                  const isFailed = job.status === 'failed';
                  return (
                    <div
                      key={job.job_id}
                      className="flex items-center gap-3 p-4 rounded-xl"
                      style={{
                        background: 'var(--bg-card)',
                        border: `1px solid ${isDone ? 'var(--accent)' : isFailed ? 'rgba(255,107,107,0.5)' : 'var(--border)'}`,
                      }}
                    >
                      {isActive && (
                        <div className="spinner shrink-0" style={{ width: 20, height: 20, borderWidth: 2 }} />
                      )}
                      {isDone && (
                        <span className="text-lg shrink-0" style={{ color: 'var(--accent)' }}>&#10003;</span>
                      )}
                      {isFailed && (
                        <span className="text-lg shrink-0" style={{ color: 'var(--error)' }}>&#10007;</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {t('jobStatusLabel')} — {job.job_type === 'video_final' ? t('generateVideo') : t('generateMotionVideo')}
                        </p>
                        <p className="text-xs mt-0.5" style={{
                          color: isDone ? 'var(--accent)' : isFailed ? 'var(--error)' : 'var(--text-muted)',
                        }}>
                          {isActive ? t('jobProcessing') : isDone ? t('jobCompleted') : job.error_message || t('jobFailed')}
                        </p>
                      </div>
                      {!isActive && (
                        <button
                          onClick={() => setVideoJobs((prev) => prev.filter((j) => j.job_id !== job.job_id))}
                          className="text-xs px-2 py-1 rounded shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {t('close')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Results */}
            {(generatedImage || generatedVideo) && (
              <div className="animate-fade-in">
                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  {t('results')}
                </h3>

                <div className="space-y-4">
                  {/* Image result */}
                  {generatedImage && !generatedVideo && (
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      <div className="px-4 py-2" style={{ background: 'var(--bg-card)' }}>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                          {t('generatedImage')}
                        </span>
                      </div>
                      <img
                        src={`${API}${generatedImage}`}
                        alt="Generated image"
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Video result */}
                  {generatedVideo && (
                    <>
                      {generatedFirstFrame && !videoPrepareResult && (
                        <div
                          className="rounded-xl overflow-hidden"
                          style={{ border: '1px solid var(--border)' }}
                        >
                          <div className="px-4 py-2" style={{ background: 'var(--bg-card)' }}>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                              {t('startFrame')}
                            </span>
                          </div>
                          <img
                            src={`${API}${generatedFirstFrame}`}
                            alt="First frame"
                            className="w-full"
                          />
                        </div>
                      )}
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid var(--accent)' }}
                      >
                        <div className="px-4 py-2" style={{ background: 'var(--bg-card)' }}>
                          <span className="text-xs font-medium" style={{ color: 'var(--accent-light)' }}>
                            {t('generatedVideo')}
                          </span>
                        </div>
                        <video
                          ref={videoRef}
                          controls
                          autoPlay
                          loop
                          className="w-full"
                          src={`${API}${generatedVideo}`}
                        >
                          {t('videoNotPlayable')}
                        </video>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 3: History ===== */}
        {currentStep === 'history' && (
          <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t('history')}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('historySubtitle')}
                </p>
              </div>

              {/* Character filter */}
              <select
                value={historyCharFilter}
                onChange={(e) => {
                  setHistoryCharFilter(e.target.value);
                  loadHistory(e.target.value || undefined, historyMediaTypeFilter || undefined);
                }}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">{t('allCharacters')}</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Media type filter pills */}
            <div className="flex gap-2 mb-6">
              {[
                { value: '', labelKey: 'all' },
                { value: 'image', labelKey: 'image' },
                { value: 'video', labelKey: 'video' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setHistoryMediaTypeFilter(f.value);
                    loadHistory(historyCharFilter || undefined, f.value || undefined);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={pillStyle(historyMediaTypeFilter === f.value)}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>

            {(() => {
              const activeJobs = videoJobs.filter((j) => j.status === 'pending' || j.status === 'processing' || j.status === 'failed');
              const hasContent = activeJobs.length > 0 || historyMedia.length > 0;
              return !hasContent;
            })() ? (
              <div
                className="text-center py-20 rounded-xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="text-4xl mb-4">&#x1F4C2;</div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('noMedia')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Skeleton cards for active/failed jobs */}
                {videoJobs
                  .filter((j) => j.status === 'pending' || j.status === 'processing' || j.status === 'failed')
                  .map((job) => {
                    const isFailed = job.status === 'failed';
                    return (
                      <div
                        key={`job-${job.job_id}`}
                        className="relative rounded-xl overflow-hidden text-left"
                        style={{
                          background: 'var(--bg-card)',
                          border: isFailed ? '2px solid rgba(255,107,107,0.5)' : '1px solid var(--border)',
                        }}
                      >
                        {/* Media area: skeleton pulse + spinner */}
                        <div
                          className="aspect-square overflow-hidden relative"
                          style={{ background: 'var(--bg-secondary)' }}
                        >
                          {!isFailed && (
                            <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            {isFailed ? (
                              <span className="text-3xl" style={{ color: 'var(--error)' }}>&#10007;</span>
                            ) : (
                              <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                            )}
                          </div>
                          {/* First frame preview if available */}
                          {job.first_frame_path && !isFailed && (
                            <img
                              src={`${API}${job.first_frame_path}`}
                              alt="First frame"
                              className="absolute inset-0 w-full h-full object-cover opacity-30"
                            />
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-4">
                          <h3
                            className="font-semibold text-sm truncate"
                            style={{ color: isFailed ? 'var(--error)' : 'var(--text-primary)' }}
                          >
                            {job.prompt || 'Untitled'}
                          </h3>
                          <div className="flex items-center gap-2 mt-2">
                            {job.character_image_path && (
                              <img
                                src={`${API}${job.character_image_path}`}
                                alt={job.character_name}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                            )}
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {job.character_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                            >
                              {job.job_type === 'video_final' ? t('video') : job.job_type === 'video_motion' ? 'Motion' : job.job_type}
                            </span>
                            <span
                              className="text-xs font-medium"
                              style={{ color: isFailed ? 'var(--error)' : 'var(--accent-light)' }}
                            >
                              {isFailed ? (job.error_message || t('jobFailedShort')) : t('jobGenerating')}
                            </span>
                          </div>
                          {isFailed && (
                            <button
                              onClick={() => setVideoJobs((prev) => prev.filter((j) => j.job_id !== job.job_id))}
                              className="mt-2 text-xs px-2 py-1 rounded"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {t('close')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {historyMedia.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setHistoryDetail(item)}
                    className="group relative rounded-xl overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    {/* Download button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadMedia(item.file_path); }}
                      className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        backdropFilter: 'blur(4px)',
                      }}
                      title={t('download')}
                    >
                      &#8595;
                    </button>
                    {/* Media preview */}
                    <div className="aspect-square overflow-hidden bg-black">
                      {item.media_type === 'video' ? (
                        <video
                          className="w-full h-full object-cover pointer-events-none"
                          src={`${API}${item.file_path}`}
                        />
                      ) : (
                        <img
                          src={`${API}${item.file_path}`}
                          alt={item.prompt || item.plan_title || 'Media'}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.prompt || item.plan_title || 'Untitled'}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        {item.character_image_path && (
                          <img
                            src={`${API}${item.character_image_path}`}
                            alt={item.character_name}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {item.character_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                        >
                          {item.media_type === 'video' ? t('video') : t('image')}
                        </span>
                        {item.generation_mode && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                          >
                            {item.generation_mode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                        {new Date(item.created_at).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detail modal */}
            {historyDetail && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(10,10,15,0.85)' }}
                onClick={() => setHistoryDetail(null)}
              >
                <div
                  className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl animate-fade-in mx-2 sm:mx-0"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Media */}
                  <div className="bg-black">
                    {historyDetail.media_type === 'video' ? (
                      <video
                        controls
                        autoPlay
                        className="w-full"
                        src={`${API}${historyDetail.file_path}`}
                      />
                    ) : (
                      <img
                        src={`${API}${historyDetail.file_path}`}
                        alt={historyDetail.prompt || historyDetail.plan_title || 'Media'}
                        className="w-full"
                      />
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-4 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="font-bold text-base sm:text-lg" style={{ color: 'var(--text-primary)' }}>
                        {historyDetail.prompt || historyDetail.plan_title || 'Untitled'}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => downloadMedia(historyDetail.file_path)}
                          className="text-sm px-3 py-1.5 rounded-lg"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          {t('download')}
                        </button>
                        <button
                          onClick={() => setHistoryDetail(null)}
                          className="text-sm px-3 py-1.5 rounded-lg"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                        >
                          {t('close')}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {historyDetail.character_image_path && (
                        <img
                          src={`${API}${historyDetail.character_image_path}`}
                          alt={historyDetail.character_name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {historyDetail.character_name}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                      >
                        {historyDetail.media_type === 'video' ? t('video') : t('image')}
                      </span>
                      {historyDetail.generation_mode && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          {historyDetail.generation_mode}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Show prompt (v2) or plan details (legacy) */}
                      {historyDetail.prompt && (
                        <div>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('labelPrompt')}</span>
                          <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {historyDetail.prompt}
                          </p>
                        </div>
                      )}
                      {historyDetail.video_prompt && (
                        <div>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('labelVideoPrompt')}</span>
                          <p className="text-sm mt-0.5 font-mono leading-relaxed" style={{ color: 'var(--accent-light)' }}>
                            {historyDetail.video_prompt}
                          </p>
                        </div>
                      )}
                      {historyDetail.first_frame_path && (
                        <div>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('labelFirstFrame')}</span>
                          <img
                            src={`${API}${historyDetail.first_frame_path}`}
                            alt="First frame"
                            className="mt-1 w-32 rounded-lg"
                            style={{ border: '1px solid var(--border)' }}
                          />
                        </div>
                      )}

                      {/* Legacy plan fields */}
                      {!historyDetail.prompt && historyDetail.plan_title && (
                        <>
                          {historyDetail.plan_theme && (
                            <div>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('labelTheme')}</span>
                              <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
                                {historyDetail.plan_theme}
                              </p>
                            </div>
                          )}
                          {historyDetail.hook && (
                            <div>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('labelHook')}</span>
                              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                {historyDetail.hook}
                              </p>
                            </div>
                          )}
                          {historyDetail.plan_first_frame_prompt && (
                            <div>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('labelFirstFramePrompt')}</span>
                              <p className="text-sm mt-0.5 font-mono leading-relaxed" style={{ color: 'var(--accent-light)' }}>
                                {historyDetail.plan_first_frame_prompt}
                              </p>
                            </div>
                          )}
                          {historyDetail.plan_video_prompt && (
                            <div>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('labelVideoFlow')}</span>
                              <p className="text-sm mt-0.5 font-mono leading-relaxed" style={{ color: 'var(--accent-light)' }}>
                                {historyDetail.plan_video_prompt}
                              </p>
                            </div>
                          )}
                          {historyDetail.call_to_action && (
                            <div>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('labelCta')}</span>
                              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                {historyDetail.call_to_action}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(historyDetail.created_at).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
