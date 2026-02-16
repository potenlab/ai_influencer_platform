# AI Influencer Studio - Web Application

React + Next.js + Flask 기반 AI 인플루언서 캐릭터 & 비디오 생성 시스템

## 🎯 주요 기능

- **캐릭터 생성**: AI가 성격 특성과 이미지를 자동 생성
- **콘텐츠 기획**: 플랫폼별 맞춤 콘텐츠 전략 자동 생성
- **미디어 생성**: 이미지 및 비디오 자동 생성
- **로컬 데이터베이스**: SQLite로 모든 데이터 로컬 저장

## 🛠️ 기술 스택

### Backend
- **Flask** - REST API 서버
- **SQLite** - 로컬 데이터베이스
- **fal.ai** - 이미지/비디오 생성 (Nano Banana Pro, Grok Imagine Video)
- **OpenRouter** - LLM (Claude 3.5 Sonnet)

### Frontend
- **Next.js 15** - React 프레임워크
- **TypeScript** - 타입 안정성
- **Tailwind CSS** - 스타일링

## 📦 설치

### 1. 의존성 설치

```bash
# Python 백엔드
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors openai pydantic python-dotenv requests pillow fal-client

# Node.js 프론트엔드
cd frontend
npm install
```

### 2. 환경 변수 설정

`.env` 파일이 이미 설정되어 있습니다:
```
FAL_KEY=your_fal_key
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
DATA_DIR=/Users/2303-pc02/potenlab/ai_influencer/data
```

## 🚀 실행

### 옵션 1: 자동 실행 (권장)

```bash
./start.sh
```

### 옵션 2: 수동 실행

**터미널 1 - 백엔드**
```bash
source venv/bin/activate
cd backend
python app.py
```

**터미널 2 - 프론트엔드**
```bash
cd frontend
npm run dev
```

### 접속

- **웹 UI**: http://localhost:3000
- **API**: http://localhost:8000

## 📖 사용 방법

### 1. 캐릭터 생성

1. "1. 캐릭터 생성" 탭 클릭
2. 정보 입력:
   - **이름**: 예) Sarah the Chef
   - **컨셉**: 예) 빠르고 건강한 아시아 퓨전 레시피 공유
   - **타겟**: 예) 25-40세 요리 초보자
3. "캐릭터 생성" 버튼 클릭 (약 30초 소요)

**AI가 자동 생성:**
- 성격 특성 5-7개
- 어조/스타일
- 콘텐츠 테마 3-5개
- 캐릭터 이미지 (AI 생성)

### 2. 캐릭터 선택

1. "2. 캐릭터 선택" 탭 클릭
2. 카드 형식으로 표시된 캐릭터 클릭
3. "콘텐츠 기획하기" 버튼 클릭

### 3. 콘텐츠 기획

1. "3. 콘텐츠 기획" 탭에서:
   - **테마**: 예) 5분 저녁 요리
   - **플랫폼**: Instagram / TikTok / YouTube
2. "콘텐츠 기획 생성" 클릭 (약 10초)

**AI가 자동 생성:**
- 콘텐츠 제목
- 훅(Opening hook)
- 3-5개 씬 (각 씬별 설명 + visual prompt)
- CTA (Call to Action)

### 4. 미디어 생성

1. "4. 미디어 생성" 탭에서:
   - **이미지 생성**: 빠름 (씬당 ~10초)
   - **비디오 생성**: 느림 (씬당 ~2-3분)

생성된 파일은 `data/media/` 폴더에 저장됩니다.

## 🎬 테스트 결과 (검증 완료)

### ✅ 실제 테스트 케이스

**캐릭터**: Fitness Coach Mike
- 컨셉: 사무직 직장인을 위한 HIIT 트레이너
- 생성 시간: ~30초
- 결과: 1.4MB PNG 이미지 + 성격 특성 7개

**콘텐츠 플랜**: "5-Min HIIT Desk Warrior Challenge"
- 플랫폼: Instagram
- 씬 수: 4개
- 생성 시간: ~10초

**비디오 생성**: 4개 씬
- Scene 1: 1.3MB (책상 푸시업)
- Scene 2: 2.0MB (의자 스쿼트)
- Scene 3: 2.3MB (무릎 올리기)
- Scene 4: 1.2MB (결과 화면)
- 총 생성 시간: ~2분

## 📁 파일 구조

```
ai_influencer/
├── backend/
│   ├── app.py                 # Flask REST API
│   ├── database.py            # SQLite 데이터베이스
│   ├── services.py            # 비즈니스 로직
│   ├── fal_api.py            # fal.ai 이미지/비디오
│   ├── openrouter_client.py  # LLM 클라이언트
│   └── config.py             # 설정 관리
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # 메인 UI 컴포넌트
│   │   ├── layout.tsx        # 레이아웃
│   │   └── globals.css       # Tailwind 스타일
│   ├── next.config.ts        # Next.js 설정 (API 프록시)
│   ├── tailwind.config.ts    # Tailwind 설정
│   └── package.json          # npm 의존성
│
├── data/
│   ├── influencer.db         # SQLite DB 파일
│   ├── media/
│   │   ├── images/           # 생성된 이미지
│   │   └── videos/           # 생성된 비디오
│
├── .env                      # API 키 설정
├── start.sh                  # 실행 스크립트
└── README_WEB.md            # 이 문서
```

## 🔌 API 엔드포인트

### 캐릭터
- `GET /api/characters` - 모든 캐릭터 조회
- `POST /api/characters` - 새 캐릭터 생성
- `GET /api/characters/:id` - 특정 캐릭터 조회

### 콘텐츠 플랜
- `GET /api/content-plans` - 모든 플랜 조회
- `GET /api/content-plans?character_id=xxx` - 캐릭터별 플랜 조회
- `POST /api/content-plans` - 새 플랜 생성
- `GET /api/content-plans/:id` - 특정 플랜 조회

### 미디어
- `POST /api/media/generate` - 미디어 생성
- `GET /api/media/:plan_id` - 플랜의 미디어 조회
- `GET /media/images/:filename` - 이미지 파일 서빙
- `GET /media/videos/:filename` - 비디오 파일 서빙

### 시스템
- `GET /api/health` - 헬스 체크

## 💡 팁

### 더 좋은 캐릭터 이미지를 위해
구체적으로 작성하세요:
- ✅ "30대 운동 트레이너, 운동복 착용, 밝은 미소, 에너지 넘치는"
- ❌ "운동하는 사람"

### 더 좋은 콘텐츠 플랜을 위해
맥락을 포함하세요:
- ✅ "좁은 아파트에서 장비 없이 할 수 있는 초보자용 HIIT"
- ❌ "운동 비디오"

### 플랫폼별 최적화
- **Instagram**: 시각적, 짧고 펀치감 있게
- **TikTok**: 트렌드, 엔터테인먼트 위주
- **YouTube**: 교육적, 상세한 내용

## 💰 비용 예상

- 캐릭터 생성: ~$0.02-0.05 (LLM + 이미지)
- 콘텐츠 기획: ~$0.01-0.02 (LLM만)
- 이미지 생성: ~$0.01-0.02/씬
- 비디오 생성: ~$0.10-0.30/씬

**팁**: 비디오 생성 전에 먼저 이미지로 테스트하세요!

## 🐛 문제 해결

### 포트 충돌
Mac에서 포트 5000은 AirPlay가 사용합니다.
현재 백엔드는 포트 8000을 사용하도록 설정되어 있습니다.

### 데이터베이스 초기화
```bash
rm data/influencer.db
# 백엔드 재시작 시 자동으로 새로 생성됨
```

### npm 오류
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## 🎓 프로젝트 특징

1. **완전 로컬**: 모든 데이터는 SQLite에 로컬 저장
2. **실시간 생성**: API 호출 후 즉시 결과 반환
3. **타입 안정성**: TypeScript로 프론트엔드 타입 보장
4. **반응형 UI**: Tailwind CSS로 모바일 대응
5. **RESTful API**: 표준 REST API 설계

## 📈 향후 개선 사항

- [ ] 비동기 미디어 생성 (작업 큐)
- [ ] 진행률 표시 (WebSocket)
- [ ] 미디어 미리보기
- [ ] 캐릭터 편집 기능
- [ ] 배치 생성
- [ ] PDF 내보내기
- [ ] 소셜 미디어 직접 포스팅

## 📄 라이선스

Private - Internal use only

---

**만든이**: Claude AI
**버전**: 1.0.0
**마지막 업데이트**: 2026-02-15
