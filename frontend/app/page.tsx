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
  is_portfolio: boolean;
  // legacy plan fields
  plan_title: string | null;
  plan_theme: string | null;
  hook: string | null;
  plan_first_frame_prompt: string | null;
  plan_video_prompt: string | null;
  call_to_action: string | null;
  duration_seconds: number | null;
}

type GenerationMode = 'image' | 'video';
type ImageOption = 'ref_image' | 'text_only' | 'shots';
type VideoOption = 'select_image' | 'motion_control';

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
  const [, setUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [generatedFirstFrame, setGeneratedFirstFrame] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mobile tab state (replaces step navigation)
  const [mobileTab, setMobileTab] = useState<'config' | 'history'>('config');

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [name, setName] = useState('');
  const [concept, setConcept] = useState('');
  const [audience, setAudience] = useState('');
  const [characterImageFile, setCharacterImageFile] = useState<File | null>(null);
  const [charImageMode, setCharImageMode] = useState<'direct' | 'generate'>('direct');

  // Generate step states
  const [prompt, setPrompt] = useState('');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('image');
  const [imageOption, setImageOption] = useState<ImageOption>('ref_image');
  const [videoOption, setVideoOption] = useState<VideoOption>('select_image');
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [showRefImagePicker, setShowRefImagePicker] = useState(false);
  const [selectedReferenceImageUrl, setSelectedReferenceImageUrl] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<HistoryMedia[]>([]);
  const [drivingVideoFile, setDrivingVideoFile] = useState<File | null>(null);
  const [selectedMotionImage, setSelectedMotionImage] = useState<string | null>(null);

  // Portfolio / first frame selection states
  const [portfolioImages, setPortfolioImages] = useState<HistoryMedia[]>([]);
  const [selectedFirstFrame, setSelectedFirstFrame] = useState<string | null>(null);
  const [firstFrameUploadFile, setFirstFrameUploadFile] = useState<File | null>(null);
  const [firstFrameUploadPreview, setFirstFrameUploadPreview] = useState<string | null>(null);
  const [showFirstFramePicker, setShowFirstFramePicker] = useState(false);
  const [showMotionImagePicker, setShowMotionImagePicker] = useState(false);
  const [showShotsImagePicker, setShowShotsImagePicker] = useState(false);

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

  // Spicy mode toggles (per-feature)
  const [spicyCharacter, setSpicyCharacter] = useState(false);
  const [spicyImage, setSpicyImage] = useState(false);
  const [spicyVideo, setSpicyVideo] = useState(false);
  const [spicyShots, setSpicyShots] = useState(false);
  const [selectedShotsImage, setSelectedShotsImage] = useState<string | null>(null);

  // i18n
  const [locale, setLocale] = useState<Locale>('ko');
  const t = (key: string) => translations[locale][key] || key;

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const charImageInputRef = useRef<HTMLInputElement>(null);
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

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

  const safeErrorJson = async (res: Response): Promise<string> => {
    try {
      const text = await res.text();
      const json = JSON.parse(text);
      return json.error || json.message || `Error ${res.status}`;
    } catch {
      if (res.status === 413) return t('errorTooLarge');
      return `Error ${res.status}: ${res.statusText}`;
    }
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
          // Always reload history since it's always visible
          authFetch(`/api/media/history`)
            .then(r => r.json())
            .then(d => setHistoryMedia(d))
            .catch(() => {});
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  // Auto-load history on mount
  useEffect(() => {
    if (authReady) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Preview first frame upload
  useEffect(() => {
    if (firstFrameUploadFile) {
      const url = URL.createObjectURL(firstFrameUploadFile);
      setFirstFrameUploadPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFirstFrameUploadPreview(null);
    }
  }, [firstFrameUploadFile]);

  // Auto-scroll right panel on new results
  useEffect(() => {
    if ((generatedImage || generatedVideo) && rightPanelRef.current) {
      rightPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [generatedImage, generatedVideo]);

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

  const loadPortfolioImages = async (characterId: string) => {
    try {
      const params = new URLSearchParams({
        character_id: characterId,
        media_type: 'image',
        is_portfolio: 'true',
      });
      const res = await authFetch(`${API}/api/media/history?${params.toString()}`);
      const data = await res.json();
      setPortfolioImages(data);
    } catch {
      console.error('Failed to load portfolio images');
    }
  };

  const loadReferenceImages = async (characterId: string) => {
    try {
      const params = new URLSearchParams({
        character_id: characterId,
        has_reference_image: 'true',
      });
      const res = await authFetch(`${API}/api/media/history?${params.toString()}`);
      const data: HistoryMedia[] = await res.json();
      // Deduplicate by reference_image_path
      const seen = new Set<string>();
      const unique = data.filter((item) => {
        if (!item.reference_image_path || seen.has(item.reference_image_path)) return false;
        seen.add(item.reference_image_path);
        return true;
      });
      setReferenceImages(unique);
    } catch {
      console.error('Failed to load reference images');
    }
  };

  const togglePortfolio = async (mediaId: number, currentValue: boolean) => {
    try {
      const res = await authFetch(`${API}/api/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_portfolio: !currentValue }),
      });
      if (!res.ok) return;
      // Update local history state
      setHistoryMedia((prev) =>
        prev.map((item) =>
          item.id === mediaId ? { ...item, is_portfolio: !currentValue } : item
        )
      );
    } catch {
      console.error('Failed to toggle portfolio');
    }
  };

  const deleteMedia = async (mediaId: number) => {
    if (!confirm(t('confirmDeleteMedia'))) return;
    try {
      const res = await authFetch(`${API}/api/media/${mediaId}`, { method: 'DELETE' });
      if (!res.ok) return;
      setHistoryMedia((prev) => prev.filter((item) => item.id !== mediaId));
    } catch {
      console.error('Failed to delete media');
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
          throw new Error(await safeErrorJson(uploadRes));
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
          spicy: spicyCharacter,
        }),
      });

      if (!res.ok) {
        throw new Error(await safeErrorJson(res));
      }

      const newChar = await res.json();
      setName('');
      setConcept('');
      setAudience('');
      setCharacterImageFile(null);
      if (charImageInputRef.current) charImageInputRef.current.value = '';
      setShowCreateForm(false);
      setShowCharacterPicker(false);
      await loadCharacters();
      setSelectedCharacter(newChar);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const deleteCharacter = async (characterId: string) => {
    if (!window.confirm(t('confirmDeleteCharacter'))) return;

    clearError();
    setLoading(true);

    try {
      const res = await authFetch(`${API}/api/characters/${characterId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(await safeErrorJson(res));
      }

      await loadCharacters();
      if (selectedCharacter?.id === characterId) {
        setSelectedCharacter(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
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
      throw new Error(await safeErrorJson(res));
    }

    const result = await res.json();
    return result.web_path;
  };

  const generateImage = async () => {
    if (!selectedCharacter || !prompt.trim()) return;
    clearError();
    setLoading(true);

    const tempJobId = `img-${Date.now()}`;
    setVideoJobs((prev) => [...prev, {
      job_id: tempJobId,
      status: 'processing' as const,
      job_type: 'image',
      character_name: selectedCharacter.name,
      character_image_path: selectedCharacter.image_path,
      prompt: prompt.trim(),
    }]);
    setMobileTab('history');

    try {
      let refPath: string | null = null;
      if (imageOption === 'ref_image') {
        if (referenceImageFile) {
          refPath = await uploadReferenceImage();
        } else if (selectedReferenceImageUrl) {
          refPath = selectedReferenceImageUrl;
        }
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
          spicy: imageOption === 'text_only' ? spicyImage : false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(await safeErrorJson(res));
      }

      const result = await res.json();
      setGeneratedImage(result.file_path);
      setGeneratedVideo(null);
      setGeneratedFirstFrame(null);
      // Reload history and mark job completed
      authFetch(`/api/media/history`).then(r => r.json()).then(d => setHistoryMedia(d)).catch(() => {});
      setVideoJobs((prev) => prev.map(j =>
        j.job_id === tempJobId ? { ...j, status: 'completed' as const } : j
      ));
      setTimeout(() => {
        setVideoJobs((prev) => prev.filter(j => j.job_id !== tempJobId));
      }, 2000);
    } catch (err: unknown) {
      if ((err instanceof Error ? err.name : '') === 'AbortError') {
        setVideoJobs((prev) => prev.map(j =>
          j.job_id === tempJobId ? { ...j, status: 'failed' as const, error_message: t('errorTimeout') } : j
        ));
      } else {
        setVideoJobs((prev) => prev.map(j =>
          j.job_id === tempJobId ? { ...j, status: 'failed' as const, error_message: (err instanceof Error ? err.message : String(err)) } : j
        ));
      }
    } finally {
      setLoading(false);
    }
  };

  const generateShots = async () => {
    const sourceImage = selectedShotsImage;
    if (!selectedCharacter || !sourceImage) return;
    clearError();
    setLoading(true);

    try {
      // Step 1: Create 5 jobs via /api/generate/shots
      const res = await authFetch(`${API}/api/generate/shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedCharacter.id,
          source_image_path: sourceImage,
          spicy: spicyShots,
        }),
      });

      if (!res.ok) {
        throw new Error(await safeErrorJson(res));
      }

      const result = await res.json();
      const shotJobs: VideoJob[] = result.jobs.map((j: { id: string; prompt: string }) => ({
        job_id: j.id,
        status: 'pending' as const,
        job_type: 'shots',
        character_name: selectedCharacter.name,
        character_image_path: selectedCharacter.image_path,
        prompt: j.prompt,
      }));

      setVideoJobs((prev) => [...prev, ...shotJobs]);
      setMobileTab('history');

      // Step 2: Fire-and-forget each shot run
      for (const j of result.jobs) {
        authFetch(`${API}/api/generate/shots/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: j.id }),
        }).catch(() => {}); // fire-and-forget

        pollJob(j.id);
      }

      // Reset form
      setSelectedShotsImage(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const prepareVideo = async () => {
    if (!selectedCharacter || !prompt.trim()) return;
    clearError();
    setLoading(true);

    try {
      // Determine first_frame_path: uploaded file or selected portfolio image
      let firstFramePath = selectedFirstFrame;

      if (firstFrameUploadFile) {
        const formData = new FormData();
        formData.append('file', firstFrameUploadFile);
        const uploadRes = await authFetch(`${API}/api/upload/image`, {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          throw new Error(await safeErrorJson(uploadRes));
        }
        const uploadResult = await uploadRes.json();
        firstFramePath = uploadResult.web_path;
      }

      if (!firstFramePath) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);

      const res = await authFetch(`${API}/api/generate/video/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedCharacter.id,
          concept: prompt.trim(),
          first_frame_path: firstFramePath,
          spicy: spicyVideo,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(await safeErrorJson(res));
      }

      const result: VideoPrepareResult = await res.json();
      setVideoPrepareResult(result);
      setEditableVideoPrompt(result.video_prompt);
      setGeneratedFirstFrame(result.first_frame_path);
    } catch (err: unknown) {
      if ((err instanceof Error ? err.name : '') === 'AbortError') {
        setError(t('errorTimeout'));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const finalizeVideo = async () => {
    if (!selectedCharacter || !videoPrepareResult) return;
    clearError();
    setLoading(true);

    try {
      const res = await authFetch(`${API}/api/generate/video/final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedCharacter.id,
          first_frame_path: videoPrepareResult.first_frame_path,
          video_prompt: editableVideoPrompt,
          concept: prompt.trim(),
          spicy: spicyVideo,
        }),
      });

      if (!res.ok) {
        throw new Error(await safeErrorJson(res));
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
      setMobileTab('history');
      pollJob(result.job_id);
      // Reset form so user can start a new video immediately
      setVideoPrepareResult(null);
      setEditableVideoPrompt('');
      setPrompt('');
      setReferenceImageFile(null);
      setGeneratedFirstFrame(null);
      setSelectedFirstFrame(null);
      setFirstFrameUploadFile(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const generateMotionVideo = async () => {
    if (!selectedCharacter || !drivingVideoFile || !prompt.trim()) {
      setError(t('errorMotionRequired'));
      return;
    }

    clearError();
    setLoading(true);

    const tempJobId = `motion-${Date.now()}`;
    setVideoJobs((prev) => [...prev, {
      job_id: tempJobId,
      status: 'processing' as const,
      job_type: 'video_motion',
      character_name: selectedCharacter.name,
      character_image_path: selectedCharacter.image_path,
      prompt: prompt.trim(),
    }]);
    setMobileTab('history');
    // Reset form immediately so user can start another
    setPrompt('');
    setDrivingVideoFile(null);
    setSelectedMotionImage(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
    setGeneratedImage(null);
    setGeneratedFirstFrame(null);

    try {
      // Step 1: Upload driving video
      const formData = new FormData();
      formData.append('file', drivingVideoFile);

      const uploadRes = await authFetch(`${API}/api/media/upload-video`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error(await safeErrorJson(uploadRes));
      }

      const uploadResult = await uploadRes.json();

      // Step 2: Submit to async queue
      const res = await authFetch(`/api/generate/video/motion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedCharacter.id,
          prompt: prompt.trim(),
          driving_video_url: uploadResult.web_path,
          image_path: selectedMotionImage || undefined,
          spicy: spicyVideo,
        }),
      });

      if (!res.ok) {
        throw new Error(await safeErrorJson(res));
      }

      const result = await res.json();
      // Replace temp job with real job_id for polling
      setVideoJobs((prev) => prev.map(j =>
        j.job_id === tempJobId ? { ...j, job_id: result.job_id } : j
      ));
      pollJob(result.job_id);
    } catch (err: unknown) {
      setVideoJobs((prev) => prev.map(j =>
        j.job_id === tempJobId ? { ...j, status: 'failed' as const, error_message: (err instanceof Error ? err.message : String(err)) } : j
      ));
    } finally {
      setLoading(false);
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
    setSelectedFirstFrame(null);
    setFirstFrameUploadFile(null);
    setSelectedReferenceImageUrl(null);
    setShowRefImagePicker(false);
    setShowFirstFramePicker(false);
    setShowMotionImagePicker(false);
    setShowShotsImagePicker(false);
    loadPortfolioImages(char.id);
    loadReferenceImages(char.id);
  };

  const resetGenerate = () => {
    setGeneratedImage(null);
    setGeneratedVideo(null);
    setGeneratedFirstFrame(null);
    setVideoPrepareResult(null);
    setEditableVideoPrompt('');
    setSelectedFirstFrame(null);
    setFirstFrameUploadFile(null);
    setSelectedMotionImage(null);
    setSelectedReferenceImageUrl(null);
    setShowFirstFramePicker(false);
    setShowMotionImagePicker(false);
    setShowShotsImagePicker(false);
  };

  const pillStyle = (active: boolean) => ({
    background: active ? 'var(--accent)' : 'var(--bg-secondary)',
    color: active ? '#fff' : 'var(--text-secondary)',
    cursor: 'pointer' as const,
  });

  const optionCardStyle = (active: boolean) => ({
    background: active
      ? 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)'
      : 'var(--bg-card)',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: active ? '1px solid transparent' : '1px solid var(--border)',
    boxShadow: active
      ? '0 0 20px rgba(108, 92, 231, 0.3), 0 0 60px rgba(108, 92, 231, 0.1)'
      : 'none',
    cursor: 'pointer' as const,
  });

  if (!authReady) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="shrink-0 backdrop-blur-xl border-b"
        style={{ background: 'rgba(10,10,15,0.8)', borderColor: 'var(--border)' }}
      >
        <div className="px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <h1
            className="text-sm sm:text-lg font-bold tracking-tight shrink-0"
            style={{ color: 'var(--accent-light)' }}
          >
            <span className="hidden sm:inline">{t('appTitle')}</span>
            <span className="sm:hidden">{t('appTitleShort')}</span>
          </h1>

          {/* Locale + Admin + Logout */}
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium shrink-0">
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

      {/* Mobile tab bar (visible only on < lg) */}
      <div
        className="shrink-0 flex lg:hidden border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
      >
        <button
          onClick={() => setMobileTab('config')}
          className="flex-1 py-2.5 text-sm font-medium transition-all text-center"
          style={{
            color: mobileTab === 'config' ? 'var(--accent-light)' : 'var(--text-muted)',
            borderBottom: mobileTab === 'config' ? '2px solid var(--accent)' : '2px solid transparent',
          }}
        >
          {t('tabConfig')}
        </button>
        <button
          onClick={() => { setMobileTab('history'); loadHistory(historyCharFilter || undefined, historyMediaTypeFilter || undefined); }}
          className="flex-1 py-2.5 text-sm font-medium transition-all text-center"
          style={{
            color: mobileTab === 'history' ? 'var(--accent-light)' : 'var(--text-muted)',
            borderBottom: mobileTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
          }}
        >
          {t('history')}
        </button>
      </div>

      {/* Two-panel container */}
      <div className="flex flex-1 overflow-hidden">
        {/* ===== LEFT PANEL — Configuration ===== */}
        <div
          className={`${mobileTab === 'config' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-[440px] lg:shrink-0 lg:border-r relative`}
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* A. Selected Character Card (click to open picker) */}
            <div
              onClick={() => { setShowCharacterPicker(true); if (characters.length === 0) setShowCreateForm(true); }}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:opacity-90"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              {selectedCharacter ? (
                <>
                  {selectedCharacter.image_path ? (
                    <img
                      src={`${API}${selectedCharacter.image_path}`}
                      alt={selectedCharacter.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium shrink-0"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                    >
                      {selectedCharacter.name[0]}
                    </div>
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
                    onClick={(e) => { e.stopPropagation(); deleteCharacter(selectedCharacter.id); }}
                    className="text-xs px-2 py-1 rounded shrink-0"
                    style={{ color: 'var(--error)' }}
                  >
                    {t('deleteCharacter')}
                  </button>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </>
              ) : (
                <>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '2px dashed var(--border)' }}
                  >
                    +
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {characters.length === 0 ? t('createFirstCharacter') : t('selectCharacter')}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </>
              )}
            </div>

            {/* D. Generation Controls (visible when character selected) */}
            {selectedCharacter && (
              <>
                {/* Divider */}
                <div className="border-t" style={{ borderColor: 'var(--border)' }} />

                {/* ── Image Mode ── */}
                {generationMode === 'image' && (
                  <div
                    className="p-4 rounded-xl space-y-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    {/* Option cards */}
                    <div>
                      <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                        {t('imageOption')}
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => { setImageOption('ref_image'); if (selectedCharacter) loadReferenceImages(selectedCharacter.id); }}
                          className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl text-xs font-medium transition-all"
                          style={optionCardStyle(imageOption === 'ref_image')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          {t('useRefImage')}
                        </button>
                        <button
                          onClick={() => setImageOption('text_only')}
                          className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl text-xs font-medium transition-all"
                          style={optionCardStyle(imageOption === 'text_only')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="6" y1="5" x2="18" y2="5" />
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="8" y1="19" x2="16" y2="19" />
                          </svg>
                          {t('textOnly')}
                        </button>
                        <button
                          onClick={() => { setImageOption('shots'); if (selectedCharacter) loadPortfolioImages(selectedCharacter.id); }}
                          className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl text-xs font-medium transition-all"
                          style={optionCardStyle(imageOption === 'shots')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="8" height="8" rx="1" />
                            <rect x="13" y="3" width="8" height="8" rx="1" />
                            <rect x="3" y="13" width="8" height="8" rx="1" />
                            <rect x="13" y="13" width="8" height="8" rx="1" />
                          </svg>
                          {t('shots')}
                        </button>
                      </div>
                    </div>

                    {/* Prompt (not for shots) */}
                    {imageOption !== 'shots' && (
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
                    )}

                    {/* Reference image bar (only for ref_image option) */}
                    {imageOption === 'ref_image' && (
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                        }}
                        onClick={() => {
                          if (!referenceImageFile && !selectedReferenceImageUrl) {
                            setShowRefImagePicker(true);
                          }
                        }}
                      >
                        {/* Thumbnail or placeholder */}
                        {referenceImagePreview || selectedReferenceImageUrl ? (
                          <img
                            src={referenceImagePreview || `${API}${selectedReferenceImageUrl}`}
                            alt="Ref"
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                          </div>
                        )}

                        {/* Label */}
                        <span className="flex-1 text-xs truncate" style={{ color: referenceImagePreview || selectedReferenceImageUrl ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {referenceImagePreview || selectedReferenceImageUrl
                            ? t('referenceImageSelected')
                            : t('tapToSelectRefImage')}
                        </span>

                        {/* Badge or remove button */}
                        {referenceImagePreview || selectedReferenceImageUrl ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReferenceImageFile(null);
                              setSelectedReferenceImageUrl(null);
                              if (imageInputRef.current) imageInputRef.current.value = '';
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded-full shrink-0"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
                          >
                            &times;
                          </button>
                        ) : (
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
                          >
                            {t('optional')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Spicy toggle (text_only only) */}
                    {imageOption === 'text_only' && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <button
                          type="button"
                          onClick={() => setSpicyImage(!spicyImage)}
                          className="w-9 h-5 rounded-full transition-all relative"
                          style={{ background: spicyImage ? '#ff4500' : 'var(--border)' }}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                            style={{ left: spicyImage ? '18px' : '2px' }}
                          />
                        </button>
                        <span className="text-xs" style={{ color: spicyImage ? '#ff4500' : 'var(--text-muted)' }}>
                          &#x1F336;&#xFE0F; {spicyImage ? t('spicyOn') : t('spicyOff')}
                        </span>
                      </label>
                    )}

                    {/* Generate button (not for shots) */}
                    {imageOption !== 'shots' && (
                    <button
                      onClick={generateImage}
                      disabled={loading || !prompt.trim()}
                      className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 glow-pulse flex items-center justify-center gap-2"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      {loading && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />}
                      {t('generateImage')}
                    </button>
                    )}

                    {/* ── Shots Mode ── */}
                    {imageOption === 'shots' && (
                      <>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {t('shotsDescription')}
                        </p>

                        {/* Source image selection bar */}
                        <div
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                          }}
                          onClick={() => setShowShotsImagePicker(true)}
                        >
                          {/* Thumbnail or placeholder */}
                          {selectedShotsImage ? (
                            <img
                              src={`${API}${selectedShotsImage}`}
                              alt="Source"
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            </div>
                          )}

                          {/* Label */}
                          <span className="flex-1 text-xs truncate" style={{ color: selectedShotsImage ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {selectedShotsImage ? t('sourceImageSelected') : t('tapToSelectSourceImage')}
                          </span>

                          {/* Remove or chevron */}
                          {selectedShotsImage ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShotsImage(null);
                              }}
                              className="w-6 h-6 flex items-center justify-center rounded-full shrink-0"
                              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
                            >
                              &times;
                            </button>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          )}
                        </div>

                        {/* Spicy toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <button
                            type="button"
                            onClick={() => setSpicyShots(!spicyShots)}
                            className="w-9 h-5 rounded-full transition-all relative"
                            style={{ background: spicyShots ? '#ff4500' : 'var(--border)' }}
                          >
                            <span
                              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                              style={{ left: spicyShots ? '18px' : '2px' }}
                            />
                          </button>
                          <span className="text-xs" style={{ color: spicyShots ? '#ff4500' : 'var(--text-muted)' }}>
                            &#x1F336;&#xFE0F; {spicyShots ? t('spicyOn') : t('spicyOff')}
                          </span>
                        </label>

                        {/* Generate Shots button */}
                        <button
                          onClick={generateShots}
                          disabled={loading || !selectedShotsImage}
                          className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 glow-pulse flex items-center justify-center gap-2"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          {loading && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />}
                          {t('generateShots')}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* ── Video Mode ── */}
                {generationMode === 'video' && (
                  <div
                    className="p-4 rounded-xl space-y-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    {/* Option cards */}
                    <div>
                      <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                        {t('videoOption')}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setVideoOption('select_image'); resetGenerate(); if (selectedCharacter) loadPortfolioImages(selectedCharacter.id); }}
                          className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl text-xs font-medium transition-all"
                          style={optionCardStyle(videoOption === 'select_image')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                            <line x1="7" y1="2" x2="7" y2="22" />
                            <line x1="17" y1="2" x2="17" y2="22" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <line x1="2" y1="7" x2="7" y2="7" />
                            <line x1="2" y1="17" x2="7" y2="17" />
                            <line x1="17" y1="7" x2="22" y2="7" />
                            <line x1="17" y1="17" x2="22" y2="17" />
                          </svg>
                          {t('refImageToVideo')}
                        </button>
                        <button
                          onClick={() => { setVideoOption('motion_control'); resetGenerate(); if (selectedCharacter) loadPortfolioImages(selectedCharacter.id); }}
                          className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl text-xs font-medium transition-all"
                          style={optionCardStyle(videoOption === 'motion_control')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                          {t('videoToVideo')}
                        </button>
                      </div>
                    </div>

                    {/* ── Video option: select_image ── */}
                    {videoOption === 'select_image' && (
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

                        {/* First frame selection bar */}
                        <div
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                          }}
                          onClick={() => setShowFirstFramePicker(true)}
                        >
                          {/* Thumbnail or placeholder */}
                          {selectedFirstFrame || firstFrameUploadPreview ? (
                            <img
                              src={firstFrameUploadPreview || `${API}${selectedFirstFrame}`}
                              alt="First frame"
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            </div>
                          )}

                          {/* Label */}
                          <span className="flex-1 text-xs truncate" style={{ color: selectedFirstFrame || firstFrameUploadPreview ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {selectedFirstFrame || firstFrameUploadPreview
                              ? t('firstFrameSelected')
                              : t('tapToSelectFirstFrame')}
                          </span>

                          {/* Remove or chevron */}
                          {selectedFirstFrame || firstFrameUploadPreview ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFirstFrame(null);
                                setFirstFrameUploadFile(null);
                                if (firstFrameInputRef.current) firstFrameInputRef.current.value = '';
                              }}
                              className="w-6 h-6 flex items-center justify-center rounded-full shrink-0"
                              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
                            >
                              &times;
                            </button>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          )}
                        </div>

                        {/* Spicy toggle for video */}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <button
                            type="button"
                            onClick={() => setSpicyVideo(!spicyVideo)}
                            className="w-9 h-5 rounded-full transition-all relative"
                            style={{ background: spicyVideo ? '#ff4500' : 'var(--border)' }}
                          >
                            <span
                              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                              style={{ left: spicyVideo ? '18px' : '2px' }}
                            />
                          </button>
                          <span className="text-xs" style={{ color: spicyVideo ? '#ff4500' : 'var(--text-muted)' }}>
                            &#x1F336;&#xFE0F; {spicyVideo ? t('spicyOn') : t('spicyOff')}
                          </span>
                        </label>

                        {/* Prepare button */}
                        {!videoPrepareResult && (
                          <button
                            onClick={prepareVideo}
                            disabled={loading || !prompt.trim() || (!selectedFirstFrame && !firstFrameUploadFile)}
                            className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 glow-pulse flex items-center justify-center gap-2"
                            style={{ background: 'var(--accent)', color: '#fff' }}
                          >
                            {loading && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />}
                            {t('generateVideoPromptBtn')}
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
                              className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 glow-pulse flex items-center justify-center gap-2"
                              style={{ background: 'var(--accent)', color: '#fff' }}
                            >
                              {loading && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />}
                              {t('generateVideo')}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* ── Video option: Motion Control ── */}
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

                        {/* Motion control image selection bar */}
                        <div
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                          }}
                          onClick={() => setShowMotionImagePicker(true)}
                        >
                          {/* Thumbnail or placeholder */}
                          {selectedMotionImage || selectedCharacter?.image_path ? (
                            <img
                              src={`${API}${selectedMotionImage || selectedCharacter?.image_path}`}
                              alt="Motion image"
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            </div>
                          )}

                          {/* Label */}
                          <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                            {t('motionImageSelected')}
                          </span>

                          {/* Chevron */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>

                        {/* Video file upload */}
                        <div>
                          <span className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                            {t('refVideoUpload')}
                          </span>
                          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                            {t('motionDescription')}
                          </p>
                          <div
                            className="relative rounded-lg text-center transition-all"
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '2px dashed var(--border)',
                              padding: drivingVideoFile ? '8px' : '12px 16px',
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
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: 'var(--bg-card)' }}>
                                  &#9654;
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <span className="text-xs truncate block" style={{ color: 'var(--text-primary)' }}>{drivingVideoFile.name}</span>
                                  <span className="text-[10px]" style={{ color: 'var(--accent-light)' }}>{(drivingVideoFile.size / 1024 / 1024).toFixed(1)} MB</span>
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
                              <label className="cursor-pointer flex items-center justify-center gap-2">
                                <input
                                  ref={videoInputRef}
                                  type="file"
                                  accept="video/mp4,video/mov,video/webm"
                                  className="sr-only"
                                  onChange={(e) => { const file = e.target.files?.[0]; if (file) setDrivingVideoFile(file); }}
                                />
                                <span className="text-lg" style={{ color: 'var(--text-muted)' }}>+</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dropOrClickVideo')}</span>
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Generate button */}
                        <button
                          onClick={generateMotionVideo}
                          disabled={loading || !prompt.trim() || !drivingVideoFile}
                          className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 glow-pulse flex items-center justify-center gap-2"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          {loading && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />}
                          {t('generateMotionVideo')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          </div>

          {/* Character Picker Popup */}
          {showCharacterPicker && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-20 lg:bg-transparent"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={() => { setShowCharacterPicker(false); setShowCreateForm(false); }}
              />

              {/* Popup panel — desktop: fixed next to left panel, mobile: bottom sheet */}
              <div
                className="z-30 flex flex-col fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl lg:top-0 lg:left-[440px] lg:bottom-0 lg:right-auto lg:w-[360px] lg:max-h-none lg:rounded-t-none lg:rounded-r-2xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                  {showCreateForm && characters.length > 0 ? (
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="flex items-center gap-1 text-sm font-medium"
                      style={{ color: 'var(--accent-light)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      {t('back')}
                    </button>
                  ) : (
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {showCreateForm ? t('createCharacterTitle') : t('characters')}
                    </h3>
                  )}
                  <button
                    onClick={() => { setShowCharacterPicker(false); setShowCreateForm(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    &times;
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4">
                  {showCreateForm ? (
                    /* Create form view */
                    <form onSubmit={createCharacter} className="space-y-3">
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
                            background: 'var(--bg-card)',
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
                            background: 'var(--bg-card)',
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
                            background: 'var(--bg-card)',
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
                            background: 'var(--bg-card)',
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
                      {/* Spicy toggle */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <button
                          type="button"
                          onClick={() => setSpicyCharacter(!spicyCharacter)}
                          className="w-9 h-5 rounded-full transition-all relative"
                          style={{ background: spicyCharacter ? '#ff4500' : 'var(--border)' }}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                            style={{ left: spicyCharacter ? '18px' : '2px' }}
                          />
                        </button>
                        <span className="text-xs" style={{ color: spicyCharacter ? '#ff4500' : 'var(--text-muted)' }}>
                          &#x1F336;&#xFE0F; {spicyCharacter ? t('spicyOn') : t('spicyOff')}
                        </span>
                      </label>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                      >
                        {loading && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />}
                        {t('createCharacterBtn')}
                      </button>
                    </form>
                  ) : (
                    /* Grid view — 2-column grid of character cards + Create */
                    <div className="grid grid-cols-2 gap-3">
                      {characters.map((char) => (
                        <button
                          key={char.id}
                          onClick={() => {
                            selectCharacterAndProceed(char);
                            setShowCharacterPicker(false);
                            setShowCreateForm(false);
                          }}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                          style={{
                            background: selectedCharacter?.id === char.id ? 'var(--accent)' : 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            color: selectedCharacter?.id === char.id ? '#fff' : 'var(--text-primary)',
                          }}
                        >
                          {char.image_path ? (
                            <img
                              src={`${API}${char.image_path}`}
                              alt={char.name}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-medium"
                              style={{
                                background: selectedCharacter?.id === char.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                                color: selectedCharacter?.id === char.id ? '#fff' : 'var(--text-muted)',
                              }}
                            >
                              {char.name[0]}
                            </div>
                          )}
                          <span className="text-xs font-medium truncate w-full text-center">
                            {char.name}
                          </span>
                        </button>
                      ))}
                      {/* Create Character card */}
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all"
                        style={{
                          background: 'var(--bg-card)',
                          border: '2px dashed var(--border)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ background: 'var(--bg-secondary)' }}>
                          +
                        </div>
                        <span className="text-xs font-medium">
                          {t('newCharacter')}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Reference Image Picker side panel */}
          {showRefImagePicker && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-20 lg:bg-transparent"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={() => setShowRefImagePicker(false)}
              />

              {/* Panel */}
              <div
                className="z-30 flex flex-col fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl lg:top-0 lg:left-[440px] lg:bottom-0 lg:right-auto lg:w-[360px] lg:max-h-none lg:rounded-t-none lg:rounded-r-2xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('selectRefImage')}
                  </h3>
                  <button
                    onClick={() => setShowRefImagePicker(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    &times;
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Upload new button */}
                  <label
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl cursor-pointer text-sm font-medium transition-all"
                    style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)', color: 'var(--text-secondary)' }}
                  >
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setReferenceImageFile(file);
                          setSelectedReferenceImageUrl(null);
                          setShowRefImagePicker(false);
                        }
                      }}
                    />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {t('uploadNewImage')}
                  </label>

                  {/* Previously used reference images */}
                  <div>
                    <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                      {t('previousRefImages')}
                    </span>
                    {referenceImages.length === 0 ? (
                      <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                        {t('noRefImages')}
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {referenceImages.map((img) => (
                          <div
                            key={img.id}
                            onClick={() => {
                              setSelectedReferenceImageUrl(img.reference_image_path);
                              setReferenceImageFile(null);
                              if (imageInputRef.current) imageInputRef.current.value = '';
                              setShowRefImagePicker(false);
                            }}
                            className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all"
                            style={{
                              border: selectedReferenceImageUrl === img.reference_image_path
                                ? '2px solid var(--accent)'
                                : '2px solid transparent',
                            }}
                          >
                            <img
                              src={`${API}${img.reference_image_path}`}
                              alt="Reference"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* First Frame Picker side panel */}
          {showFirstFramePicker && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-20 lg:bg-transparent"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={() => setShowFirstFramePicker(false)}
              />

              {/* Panel */}
              <div
                className="z-30 flex flex-col fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl lg:top-0 lg:left-[440px] lg:bottom-0 lg:right-auto lg:w-[360px] lg:max-h-none lg:rounded-t-none lg:rounded-r-2xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('selectFirstFrame')}
                  </h3>
                  <button
                    onClick={() => setShowFirstFramePicker(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    &times;
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Upload new button */}
                  <label
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl cursor-pointer text-sm font-medium transition-all"
                    style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)', color: 'var(--text-secondary)' }}
                  >
                    <input
                      ref={firstFrameInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFirstFrameUploadFile(file);
                          setSelectedFirstFrame(null);
                          setShowFirstFramePicker(false);
                        }
                      }}
                    />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {t('uploadNewImage')}
                  </label>

                  {/* Portfolio images grid */}
                  <div>
                    <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                      {t('portfolioImages')}
                    </span>
                    {!selectedCharacter?.image_path && portfolioImages.length === 0 ? (
                      <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                        {t('noPortfolioImagesShort')}
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {/* Character ID photo */}
                        {selectedCharacter?.image_path && (
                          <div
                            onClick={() => {
                              setSelectedFirstFrame(selectedCharacter.image_path);
                              setFirstFrameUploadFile(null);
                              if (firstFrameInputRef.current) firstFrameInputRef.current.value = '';
                              setShowFirstFramePicker(false);
                            }}
                            className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all relative"
                            style={{
                              border: selectedFirstFrame === selectedCharacter.image_path
                                ? '2px solid var(--accent)'
                                : '2px solid transparent',
                            }}
                          >
                            <img
                              src={`${API}${selectedCharacter.image_path}`}
                              alt={selectedCharacter.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] py-0.5" style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-muted)' }}>ID</span>
                          </div>
                        )}
                        {portfolioImages.map((img) => (
                          <div
                            key={img.id}
                            onClick={() => {
                              setSelectedFirstFrame(img.file_path);
                              setFirstFrameUploadFile(null);
                              if (firstFrameInputRef.current) firstFrameInputRef.current.value = '';
                              setShowFirstFramePicker(false);
                            }}
                            className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all"
                            style={{
                              border: selectedFirstFrame === img.file_path
                                ? '2px solid var(--accent)'
                                : '2px solid transparent',
                            }}
                          >
                            <img
                              src={`${API}${img.file_path}`}
                              alt={img.prompt || 'Portfolio'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Motion Image Picker side panel */}
          {showMotionImagePicker && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-20 lg:bg-transparent"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={() => setShowMotionImagePicker(false)}
              />

              {/* Panel */}
              <div
                className="z-30 flex flex-col fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl lg:top-0 lg:left-[440px] lg:bottom-0 lg:right-auto lg:w-[360px] lg:max-h-none lg:rounded-t-none lg:rounded-r-2xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('selectMotionImage')}
                  </h3>
                  <button
                    onClick={() => setShowMotionImagePicker(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    &times;
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                      {t('portfolioImages')}
                    </span>
                    {!selectedCharacter?.image_path && portfolioImages.length === 0 ? (
                      <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                        {t('noPortfolioImagesShort')}
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {/* Character ID photo */}
                        {selectedCharacter?.image_path && (
                          <div
                            onClick={() => {
                              setSelectedMotionImage(selectedCharacter.image_path);
                              setShowMotionImagePicker(false);
                            }}
                            className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all relative"
                            style={{
                              border: (selectedMotionImage === selectedCharacter.image_path || (!selectedMotionImage))
                                ? '2px solid var(--accent)'
                                : '2px solid transparent',
                            }}
                          >
                            <img
                              src={`${API}${selectedCharacter.image_path}`}
                              alt={selectedCharacter.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] py-0.5" style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-muted)' }}>ID</span>
                          </div>
                        )}
                        {portfolioImages.map((img) => (
                          <div
                            key={img.id}
                            onClick={() => {
                              setSelectedMotionImage(img.file_path);
                              setShowMotionImagePicker(false);
                            }}
                            className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all"
                            style={{
                              border: selectedMotionImage === img.file_path
                                ? '2px solid var(--accent)'
                                : '2px solid transparent',
                            }}
                          >
                            <img
                              src={`${API}${img.file_path}`}
                              alt={img.prompt || 'Portfolio'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Shots Image Picker side panel */}
          {showShotsImagePicker && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-20 lg:bg-transparent"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={() => setShowShotsImagePicker(false)}
              />

              {/* Panel */}
              <div
                className="z-30 flex flex-col fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl lg:top-0 lg:left-[440px] lg:bottom-0 lg:right-auto lg:w-[360px] lg:max-h-none lg:rounded-t-none lg:rounded-r-2xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('selectSourceImage')}
                  </h3>
                  <button
                    onClick={() => setShowShotsImagePicker(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    &times;
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                      {t('portfolioImages')}
                    </span>
                    {!selectedCharacter?.image_path && portfolioImages.length === 0 ? (
                      <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                        {t('noPortfolioImagesShort')}
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {/* Character ID photo */}
                        {selectedCharacter?.image_path && (
                          <div
                            onClick={() => {
                              setSelectedShotsImage(selectedCharacter.image_path);
                              setShowShotsImagePicker(false);
                            }}
                            className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all relative"
                            style={{
                              border: selectedShotsImage === selectedCharacter.image_path
                                ? '2px solid var(--accent)'
                                : '2px solid transparent',
                            }}
                          >
                            <img
                              src={`${API}${selectedCharacter.image_path}`}
                              alt={selectedCharacter.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] py-0.5" style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-muted)' }}>ID</span>
                          </div>
                        )}
                        {portfolioImages.map((img) => (
                          <div
                            key={img.id}
                            onClick={() => {
                              setSelectedShotsImage(img.file_path);
                              setShowShotsImagePicker(false);
                            }}
                            className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all"
                            style={{
                              border: selectedShotsImage === img.file_path
                                ? '2px solid var(--accent)'
                                : '2px solid transparent',
                            }}
                          >
                            <img
                              src={`${API}${img.file_path}`}
                              alt={img.prompt || 'Portfolio'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Bottom tab bar — Image/Video mode selector */}
          {selectedCharacter && (
            <div
              className="shrink-0 flex items-center justify-center gap-2 px-4 py-3 border-t"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
            >
              {/* Video tab */}
              <button
                onClick={() => { setGenerationMode('video'); resetGenerate(); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                style={generationMode === 'video'
                  ? { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
                  : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
                {generationMode === 'video' && <span>{t('generateVideo')}</span>}
              </button>

              {/* Image tab */}
              <button
                onClick={() => { setGenerationMode('image'); resetGenerate(); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                style={generationMode === 'image'
                  ? { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
                  : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                {generationMode === 'image' && <span>{t('generateImage')}</span>}
              </button>
            </div>
          )}
        </div>

        {/* ===== RIGHT PANEL — Results & History ===== */}
        <div
          ref={rightPanelRef}
          className={`${mobileTab === 'history' ? 'block' : 'hidden'} lg:block flex-1 overflow-y-auto`}
          style={{ background: 'var(--bg-primary)' }}
        >
          <div className="p-4 sm:p-6 space-y-6">
            {/* Error toast */}
            {error && (
              <div
                className="px-4 py-3 rounded-lg flex items-center justify-between animate-fade-in"
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

            {/* Generation Results */}
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

            {/* ── History Section ── */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t('history')}
                </h2>

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
              <div className="flex gap-2 mb-4">
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

              {/* Media grid */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
                                {job.job_type === 'image' ? t('image') : job.job_type === 'video_final' ? t('video') : job.job_type === 'video_motion' ? 'Motion' : job.job_type}
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
                      {/* Action buttons (top-right) */}
                      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadMedia(item.file_path); }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
                          style={{
                            background: 'rgba(0,0,0,0.6)',
                            color: '#fff',
                            backdropFilter: 'blur(4px)',
                          }}
                          title={t('download')}
                        >
                          &#8595;
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMedia(item.id); }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
                          style={{
                            background: 'rgba(0,0,0,0.6)',
                            color: 'var(--error)',
                            backdropFilter: 'blur(4px)',
                          }}
                          title={t('deleteMedia')}
                        >
                          &#10005;
                        </button>
                      </div>
                      {/* Portfolio toggle (images only) */}
                      {item.media_type === 'image' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePortfolio(item.id, item.is_portfolio); }}
                          className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-base transition-all"
                          style={{
                            background: item.is_portfolio ? 'rgba(255,200,0,0.25)' : 'rgba(0,0,0,0.6)',
                            color: item.is_portfolio ? '#ffc800' : 'rgba(255,255,255,0.4)',
                            backdropFilter: 'blur(4px)',
                            textShadow: item.is_portfolio ? '0 0 6px rgba(255,200,0,0.5)' : 'none',
                          }}
                          title={item.is_portfolio ? t('removeFromPortfolio') : t('addToPortfolio')}
                        >
                          &#9733;
                        </button>
                      )}
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
            </div>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {historyDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,10,15,0.85)' }}
          onClick={() => setHistoryDetail(null)}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] rounded-xl animate-fade-in mx-2 sm:mx-0 overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setHistoryDetail(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              ✕
            </button>

            <div className="flex flex-col sm:flex-row max-h-[90vh]">
              {/* Media (left side on desktop) */}
              <div className="sm:w-[58%] shrink-0 bg-black flex items-center justify-center max-h-[50vh] sm:max-h-[85vh] overflow-hidden">
                {historyDetail.media_type === 'video' ? (
                  <video
                    controls
                    autoPlay
                    className="max-w-full max-h-[50vh] sm:max-h-[85vh] object-contain"
                    src={`${API}${historyDetail.file_path}`}
                  />
                ) : (
                  <img
                    src={`${API}${historyDetail.file_path}`}
                    alt={historyDetail.prompt || historyDetail.plan_title || 'Media'}
                    className="max-w-full max-h-[50vh] sm:max-h-[85vh] object-contain"
                  />
                )}
              </div>

              {/* Details (right side on desktop) */}
              <div className="sm:w-[42%] overflow-y-auto max-h-[40vh] sm:max-h-[85vh] p-4 sm:p-6 space-y-4">
                <div className="flex flex-col gap-2">
                  <h3 className="font-bold text-base sm:text-lg pr-8 sm:pr-0" style={{ color: 'var(--text-primary)' }}>
                    {historyDetail.prompt || historyDetail.plan_title || 'Untitled'}
                  </h3>
                  <div className="flex items-center gap-2">
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

                <div className="flex items-center gap-3 flex-wrap">
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
        </div>
      )}
    </div>
  );
}
