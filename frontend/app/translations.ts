export type Locale = 'ko' | 'en';

const translations: Record<Locale, Record<string, string>> = {
  ko: {
    // Loading messages
    loadingCreateCharacter: 'AI가 캐릭터를 생성하고 있습니다...',
    loadingGenerateImage: '이미지를 생성하고 있습니다...',
    loadingUploadRef: '참고 이미지 업로드 중...',
    loadingPrepareVideo: '비디오 프롬프트 생성 중...',
    loadingFinalizeVideo: '비디오 생성 중... (2~3분 소요)',
    loadingUploadVideo: '비디오 업로드 중...',
    loadingMotionVideo: 'Kling Motion Control 비디오 생성 중... (2~5분 소요)',
    errorTimeout: '요청 시간 초과 (10분). 서버 상태를 확인해주세요.',
    errorMotionRequired: '캐릭터, 프롬프트, 참고 비디오를 모두 입력해주세요.',
    pleaseWait: '잠시만 기다려주세요',
    close: '닫기',

    // Step 1: Characters
    characters: '캐릭터',
    charactersSubtitle: 'AI 인플루언서 캐릭터를 선택하거나 새로 만드세요',
    cancel: '취소',
    newCharacter: '+ 새 캐릭터',
    createCharacterTitle: '새 캐릭터 만들기',
    labelName: '이름',
    labelConcept: '컨셉 (AI 이미지 생성 프롬프트로 사용됩니다)',
    labelAudience: '타겟 오디언스',
    createCharacterBtn: '캐릭터 생성',
    noCharacters: '아직 캐릭터가 없습니다',
    createFirstCharacter: '첫 캐릭터 만들기',
    uploadCharacterImage: '캐릭터 이미지 업로드 (선택 — 비워두면 AI가 자동 생성)',
    selectCharacterImage: '이미지 파일 선택',
    dropOrClick: '이미지를 드래그하거나 클릭하여 선택',
    dropOrClickVideo: '비디오를 드래그하거나 클릭하여 선택',
    imageModeDirect: '업로드 이미지 그대로 사용',
    imageModeGenerate: '업로드 이미지 + AI 생성',
    deleteCharacter: '삭제',
    confirmDeleteCharacter: '이 캐릭터를 삭제하시겠습니까? 관련된 모든 미디어와 콘텐츠 플랜도 함께 삭제됩니다.',
    loadingDeleteCharacter: '캐릭터 삭제 중...',
    placeholderName: '예: 미나 (Mina)',
    placeholderConcept: '예: 건강한 한식 레시피를 공유하는 밝고 친근한 요리 인플루언서',
    placeholderAudience: '예: 20~30대 요리 초보자',

    // Step 2: Generate
    changeCharacter: '변경',
    generationMode: '생성 모드',
    generateImage: '이미지 생성',
    generateVideo: '비디오 생성',
    imageOption: '이미지 옵션',
    useRefImage: '참고 이미지 사용',
    textOnly: '텍스트만',
    promptRequired: '프롬프트 (필수)',
    placeholderImagePrompt: '예: 밝은 카페에서 라떼를 들고 웃는 모습, 자연광',
    refImageUploadOptional: '참고 이미지 업로드 (선택 — 비워두면 증명사진만 사용)',
    selectImageFile: '이미지 파일 선택',
    remove: '제거',

    // Video options
    videoOption: '비디오 옵션',
    refImageToVideo: '참고 이미지 → 비디오',
    textOnlyToVideo: '텍스트만 → 비디오',
    videoToVideo: '비디오 → 비디오 (Motion Control)',
    conceptRequired: '컨셉 (필수)',
    placeholderVideoConcept: '예: 도쿄 시부야 거리를 걸으며 카메라를 보고 웃는 모습',
    refImageUploadOptionalShort: '참고 이미지 업로드 (선택)',
    preparePrompt: '프롬프트 생성 (첫 프레임 + LLM)',
    firstFramePreview: '첫 프레임 미리보기',
    videoPromptEditable: '비디오 프롬프트 (편집 가능)',

    // Portfolio & first frame selection
    selectFirstFrame: '첫 프레임 이미지 선택',
    uploadNewImage: '새 이미지 업로드',
    noPortfolioImages: '포트폴리오 이미지가 없습니다. 먼저 이미지를 생성하세요.',
    changeProfileImage: '프로필 이미지 변경',
    changeProfileImageDesc: '포트폴리오(별표) 이미지 중에서 선택하세요.',
    addToPortfolio: '포트폴리오에 추가',
    removeFromPortfolio: '포트폴리오에서 제거',
    deleteMedia: '삭제',
    confirmDeleteMedia: '이 미디어를 삭제하시겠습니까?',
    selectMotionImage: '캐릭터 이미지 선택',
    errorTooLarge: '파일이 너무 큽니다. 더 작은 파일을 사용해주세요.',
    generateVideoPromptBtn: '비디오 프롬프트 생성',

    // Motion control
    placeholderMotionPrompt: '예: 캐릭터가 춤추는 모습',
    refVideoUpload: '참고 비디오 업로드 (필수, mp4/mov/webm, 최대 100MB)',
    motionDescription: '캐릭터 증명사진 + 참고 비디오의 모션을 결합하여 비디오를 생성합니다',
    selectVideoFile: '비디오 파일 선택',
    mbSelected: 'MB 선택됨',
    generateMotionVideo: '비디오 생성 (Motion Control)',

    // Job status
    jobQueued: '큐에 등록됨',
    jobProcessing: '생성 중...',
    jobCompleted: '완료',
    jobFailed: '실패',
    jobStatusLabel: '비디오 생성 작업',

    // Results
    results: '결과',
    generatedImage: '생성된 이미지',
    startFrame: '시작 프레임',
    generatedVideo: '생성된 비디오',
    videoNotPlayable: '비디오를 재생할 수 없습니다.',

    // Step 3: History
    history: '히스토리',
    historySubtitle: '생성된 미디어를 확인하세요',
    allCharacters: '전체 캐릭터',
    all: '전체',
    image: '이미지',
    video: '영상',
    download: '다운로드',
    noMedia: '생성된 미디어가 없습니다',
    jobGenerating: '생성 중...',
    jobFailedShort: '생성 실패',

    // Header / Nav
    appTitle: 'AI 인플루언서 스튜디오',
    appTitleShort: 'AI 스튜디오',
    stepCharacters: '캐릭터',
    stepGenerate: '생성',
    stepHistory: '히스토리',
    logout: '로그아웃',
    admin: '관리자',

    // Spicy mode
    spicyOn: 'Spicy',
    spicyOff: 'Mild',
    spicyTitleOn: 'Spicy ON (Grok Image)',
    spicyTitleOff: 'Spicy OFF (Nano Banana Pro)',
    spicyRefImageWarning: '* Spicy 모드에서는 참고 이미지를 텍스트로 변환하여 생성하므로, 참고 이미지와 결과가 많이 다를 수 있습니다.',

    // Duration info
    durationInfo: '* 영상 길이(5~15초)는 AI가 프롬프트를 분석하여 자동 결정합니다.',

    // Shots
    shots: 'Shots',
    generateShots: 'Shots 생성 (5장)',
    loadingGenerateShots: 'Shots 프롬프트 생성 중...',
    shotsDescription: '소스 이미지를 기반으로 같은 장소에서 다양한 앵글/포즈의 사진 5장을 생성합니다',
    selectSourceImage: '소스 이미지 선택',
    shotsJobLabel: 'Shots 생성',

    // History detail labels
    labelPrompt: '프롬프트',
    labelVideoPrompt: '비디오 프롬프트',
    labelFirstFrame: '첫 프레임',
    labelTheme: '테마',
    labelHook: '훅',
    labelFirstFramePrompt: '첫 프레임 프롬프트',
    labelVideoFlow: '비디오 플로우',
    labelCta: 'CTA',
  },

  en: {
    // Loading messages
    loadingCreateCharacter: 'AI is creating the character...',
    loadingGenerateImage: 'Generating image...',
    loadingUploadRef: 'Uploading reference image...',
    loadingPrepareVideo: 'Generating video prompt...',
    loadingFinalizeVideo: 'Generating video... (2-3 min)',
    loadingUploadVideo: 'Uploading video...',
    loadingMotionVideo: 'Kling Motion Control video generation... (2-5 min)',
    errorTimeout: 'Request timeout (10 min). Please check server status.',
    errorMotionRequired: 'Please provide character, prompt, and reference video.',
    pleaseWait: 'Please wait a moment',
    close: 'Close',

    // Step 1: Characters
    characters: 'Characters',
    charactersSubtitle: 'Select an AI influencer character or create a new one',
    cancel: 'Cancel',
    newCharacter: '+ New Character',
    createCharacterTitle: 'Create New Character',
    labelName: 'Name',
    labelConcept: 'Concept (used as AI image generation prompt)',
    labelAudience: 'Target Audience',
    createCharacterBtn: 'Create Character',
    noCharacters: 'No characters yet',
    createFirstCharacter: 'Create First Character',
    uploadCharacterImage: 'Upload Character Image (optional — AI generates if empty)',
    selectCharacterImage: 'Select Image File',
    dropOrClick: 'Drag an image or click to select',
    dropOrClickVideo: 'Drag a video or click to select',
    imageModeDirect: 'Use uploaded image as-is',
    imageModeGenerate: 'Generate with uploaded image + AI',
    deleteCharacter: 'Delete',
    confirmDeleteCharacter: 'Delete this character? All related media and content plans will also be deleted.',
    loadingDeleteCharacter: 'Deleting character...',
    placeholderName: 'e.g. Mina',
    placeholderConcept: 'e.g. A bright and friendly cooking influencer sharing healthy Korean recipes',
    placeholderAudience: 'e.g. Beginner cooks in their 20s-30s',

    // Step 2: Generate
    changeCharacter: 'Change',
    generationMode: 'Generation Mode',
    generateImage: 'Generate Image',
    generateVideo: 'Generate Video',
    imageOption: 'Image Option',
    useRefImage: 'Use Reference Image',
    textOnly: 'Text Only',
    promptRequired: 'Prompt (required)',
    placeholderImagePrompt: 'e.g. Smiling while holding a latte in a bright café, natural light',
    refImageUploadOptional: 'Upload Reference Image (optional — uses ID photo if empty)',
    selectImageFile: 'Select Image File',
    remove: 'Remove',

    // Video options
    videoOption: 'Video Option',
    refImageToVideo: 'Reference Image → Video',
    textOnlyToVideo: 'Text Only → Video',
    videoToVideo: 'Video → Video (Motion Control)',
    conceptRequired: 'Concept (required)',
    placeholderVideoConcept: 'e.g. Walking through Shibuya streets in Tokyo, smiling at the camera',
    refImageUploadOptionalShort: 'Upload Reference Image (optional)',
    preparePrompt: 'Generate Prompt (First Frame + LLM)',
    firstFramePreview: 'First Frame Preview',
    videoPromptEditable: 'Video Prompt (editable)',

    // Portfolio & first frame selection
    selectFirstFrame: 'Select First Frame',
    uploadNewImage: 'Upload New',
    noPortfolioImages: 'No portfolio images. Generate images first.',
    changeProfileImage: 'Change Profile Image',
    changeProfileImageDesc: 'Select from your portfolio (starred) images.',
    addToPortfolio: 'Add to Portfolio',
    removeFromPortfolio: 'Remove from Portfolio',
    deleteMedia: 'Delete',
    confirmDeleteMedia: 'Delete this media?',
    selectMotionImage: 'Select Character Image',
    errorTooLarge: 'File is too large. Please use a smaller file.',
    generateVideoPromptBtn: 'Generate Video Prompt',

    // Motion control
    placeholderMotionPrompt: 'e.g. Character dancing',
    refVideoUpload: 'Upload Reference Video (required, mp4/mov/webm, max 100MB)',
    motionDescription: 'Combines character ID photo + reference video motion to generate video',
    selectVideoFile: 'Select Video File',
    mbSelected: 'MB selected',
    generateMotionVideo: 'Generate Video (Motion Control)',

    // Job status
    jobQueued: 'Queued',
    jobProcessing: 'Generating...',
    jobCompleted: 'Completed',
    jobFailed: 'Failed',
    jobStatusLabel: 'Video Generation Job',

    // Results
    results: 'Results',
    generatedImage: 'Generated Image',
    startFrame: 'Start Frame',
    generatedVideo: 'Generated Video',
    videoNotPlayable: 'Cannot play video.',

    // Step 3: History
    history: 'History',
    historySubtitle: 'View your generated media',
    allCharacters: 'All Characters',
    all: 'All',
    image: 'Image',
    video: 'Video',
    download: 'Download',
    noMedia: 'No generated media',
    jobGenerating: 'Generating...',
    jobFailedShort: 'Generation failed',

    // Header / Nav
    appTitle: 'AI Influencer Studio',
    appTitleShort: 'AI Studio',
    stepCharacters: 'Characters',
    stepGenerate: 'Generate',
    stepHistory: 'History',
    logout: 'Logout',
    admin: 'Admin',

    // Spicy mode
    spicyOn: 'Spicy',
    spicyOff: 'Mild',
    spicyTitleOn: 'Spicy ON (Grok Image)',
    spicyTitleOff: 'Spicy OFF (Nano Banana Pro)',
    spicyRefImageWarning: '* In Spicy mode, the reference image is converted to text, so the result may differ significantly from the reference.',

    // Duration info
    durationInfo: '* Duration (5-15s) is automatically determined by AI based on the prompt.',

    // Shots
    shots: 'Shots',
    generateShots: 'Generate 5 Shots',
    loadingGenerateShots: 'Generating shots prompts...',
    shotsDescription: 'Generate 5 photos with different angles/poses from the same source image',
    selectSourceImage: 'Select Source Image',
    shotsJobLabel: 'Shots Generation',

    // History detail labels
    labelPrompt: 'PROMPT',
    labelVideoPrompt: 'VIDEO PROMPT',
    labelFirstFrame: 'FIRST FRAME',
    labelTheme: 'THEME',
    labelHook: 'HOOK',
    labelFirstFramePrompt: 'FIRST FRAME PROMPT',
    labelVideoFlow: 'VIDEO FLOW',
    labelCta: 'CTA',
  },
};

export default translations;
