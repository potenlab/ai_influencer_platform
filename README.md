# AI Influencer Character & Video Generation System

A desktop Python application that creates AI influencer characters and generates social media content (images/videos) using AI services.

## Features

- **Character Creation**: AI-generated personalities with unique visual appearances
- **Content Planning**: AI-powered content strategy tailored to each character
- **Media Generation**: Create images and videos for social media posts
- **Local Storage**: All data stored locally in JSON format

## Tech Stack

- **Python 3.12**
- **PySimpleGUI 5.x** - Desktop GUI
- **fal.ai** - Image/video generation (Nano Banana Pro, Grok Imagine Video)
- **OpenRouter** - LLM for personality and content planning
- **Pydantic** - Data validation

## Installation

1. Clone the repository:
```bash
cd /Users/2303-pc02/potenlab/ai_influencer
```

2. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install --upgrade --extra-index-url https://PySimpleGUI.net/install PySimpleGUI
pip install openai pydantic python-dotenv requests pillow fal-client
```

Or install from requirements.txt:
```bash
pip install -r requirements.txt --extra-index-url https://PySimpleGUI.net/install
```

4. Configure `.env` file with your API keys (already configured)

## Usage

Run the application:
```bash
source venv/bin/activate
python gui_main.py
```

### Workflow

1. **Create Character**
   - Click "Create New Character"
   - Enter character name, concept, and target audience
   - AI generates personality traits and character image

2. **Select Character**
   - Click "Select Character"
   - Choose from your character gallery
   - View character details

3. **Plan Content**
   - Click "Plan Content"
   - Enter content theme and platform
   - AI generates structured content plan with scenes

4. **Generate Media**
   - Click "Generate Media"
   - Choose images or videos
   - Generate all scenes at once

## File Structure

```
ai_influencer/
├── .env                    # API keys configuration
├── .gitignore
├── requirements.txt
├── config.py              # Configuration management
├── models.py              # Pydantic data models
├── storage.py             # JSON storage operations
├── fal_client.py          # fal.ai API wrapper
├── openrouter_client.py   # OpenRouter LLM client
├── services.py            # Business logic
├── gui_main.py            # Main GUI application
└── data/                  # Generated at runtime
    ├── characters/        # Character JSON files
    ├── content_plans/     # Content plan JSON files
    └── media/
        ├── images/        # Generated images
        └── videos/        # Generated videos
```

## API Services

- **fal.ai**: Image and video generation
  - Model: `fal-ai/nano-banana-pro` (images)
  - Model: `xai/grok-imagine-video/text-to-video` (videos)

- **OpenRouter**: LLM for content generation
  - Model: `anthropic/claude-3.5-sonnet`

## Known Limitations (MVP)

- Synchronous video generation (UI may freeze during generation)
- No character editing (must delete and recreate)
- No media preview in app (open files externally)
- Basic error handling
- No caching system

## Future Enhancements

- Async video generation with progress tracking
- Character editing functionality
- In-app media preview
- Batch operations
- Export content plans to PDF/Markdown
- Social media posting integration

## Testing

Manual test steps:

1. Create a character (e.g., "Sarah the Chef")
2. Verify image saved in `data/media/images/`
3. Verify JSON saved in `data/characters/`
4. Select the character
5. Create content plan for a theme
6. Generate images or videos
7. Verify media files in appropriate directories

## License

Private project - For internal use only
