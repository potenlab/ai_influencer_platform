# 빠른 테스트 가이드

## 1. 서버 시작

```bash
# 터미널 1 - 백엔드
cd /Users/2303-pc02/potenlab/ai_influencer
source venv/bin/activate
cd backend
python app.py

# 터미널 2 - 프론트엔드
cd /Users/2303-pc02/potenlab/ai_influencer/frontend
npm run dev
```

## 2. 브라우저에서 테스트

**URL**: http://localhost:3000

### 테스트 시나리오 1: 캐릭터 생성
1. "1. 캐릭터 생성" 탭
2. 입력:
   - 이름: `테크 유튜버 준`
   - 컨셉: `초보자를 위한 쉬운 프로그래밍 튜토리얼을 만드는 친근한 개발자`
   - 타겟: `프로그래밍 입문자 20-35세`
3. "캐릭터 생성" 클릭 (30초 대기)
4. ✅ 성공 메시지 확인

### 테스트 시나리오 2: 콘텐츠 기획
1. "2. 캐릭터 선택" 탭
2. 방금 만든 캐릭터 클릭
3. "3. 콘텐츠 기획" 탭
4. 입력:
   - 테마: `Python 초보자를 위한 5가지 팁`
   - 플랫폼: `instagram`
5. "콘텐츠 기획 생성" 클릭 (10초 대기)
6. ✅ 씬 3-5개 생성 확인

### 테스트 시나리오 3: 이미지 생성 (빠름)
1. "4. 미디어 생성" 탭
2. "🖼️ 이미지 생성" 버튼 클릭
3. ✅ 약 30-40초 후 완료 메시지

### 테스트 시나리오 4: 비디오 생성 (느림)
1. "4. 미디어 생성" 탭
2. "🎬 비디오 생성" 버튼 클릭
3. ✅ 약 2-3분 후 완료 메시지

## 3. 생성된 파일 확인

```bash
# 이미지
open data/media/images/

# 비디오
open data/media/videos/

# 데이터베이스
sqlite3 data/influencer.db "SELECT name FROM characters;"
```

## 4. API 직접 테스트 (선택)

```bash
# 헬스 체크
curl http://localhost:8000/api/health

# 캐릭터 목록
curl http://localhost:8000/api/characters | python -m json.tool

# 캐릭터 생성
curl -X POST http://localhost:8000/api/characters \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","concept":"Test concept","audience":"Test audience"}'
```

## 예상 결과

✅ **캐릭터 생성**: ~30초, 1.4MB PNG 이미지
✅ **콘텐츠 기획**: ~10초, 3-5개 씬
✅ **이미지 생성**: ~10초/씬
✅ **비디오 생성**: ~2-3분/씬

**모든 기능이 정상 작동합니다!** 🎉
