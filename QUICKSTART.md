# Quick Start Guide

## First Time Setup

1. **Activate virtual environment**:
```bash
source venv/bin/activate
```

2. **Verify setup** (optional but recommended):
```bash
python test_setup.py
```

## Running the Application

```bash
source venv/bin/activate
python gui_main.py
```

## Example Workflow

### 1. Create Your First Character

**Example: Food Blogger**
- **Name**: Sarah Chen
- **Concept**: Passionate home cook who shares quick, healthy Asian-fusion recipes for busy professionals
- **Target Audience**: Young professionals aged 25-35

Click "Generate Character" and wait ~30 seconds for AI to:
- Generate personality traits
- Create character image
- Save everything locally

### 2. Select Your Character

- Click "Select Character"
- Choose "Sarah Chen" from the list
- Review the personality traits generated

### 3. Plan Content

**Example Content Plan**:
- **Theme**: "5-minute weeknight dinners"
- **Platform**: instagram

Click "Generate Plan" and the AI will create:
- Content title
- Opening hook
- 3-5 scene breakdown
- Call-to-action

### 4. Generate Media

Choose either:
- **Images**: Fast generation (~10 seconds per scene)
- **Videos**: Slower generation (~2-3 minutes per scene)

Click "Generate All Scenes" and wait for progress bar to complete.

## Finding Your Generated Content

All content is saved in the `data/` directory:

```bash
# View generated characters
ls data/characters/

# View character images
open data/media/images/

# View content plans
ls data/content_plans/

# View generated videos
open data/media/videos/
```

## Tips

### For Better Character Images
Be specific in the concept:
- ✓ "Professional fitness trainer in her 30s, athletic build, warm smile, wearing activewear"
- ✗ "Fitness person"

### For Better Content Plans
Include context in the theme:
- ✓ "Beginner-friendly HIIT workouts for small apartments with no equipment"
- ✗ "Workout videos"

### Platform-Specific Tips

**Instagram**:
- Keep themes visual and aesthetic
- Focus on short, punchy content

**TikTok**:
- Emphasize trends and challenges
- Focus on entertainment value

**YouTube**:
- Allow for more detailed/educational content
- Can be longer and more in-depth

## Troubleshooting

### GUI Won't Start
```bash
# Reinstall PySimpleGUI
pip uninstall PySimpleGUI
pip install --upgrade --extra-index-url https://PySimpleGUI.net/install PySimpleGUI
```

### API Errors
- Check your `.env` file has valid API keys
- Verify you have internet connection
- Check API rate limits

### Missing Directories
```bash
# Reinitialize directories
python -c "from config import Config; Config.init_directories()"
```

## Cost Estimates (Approximate)

- **Character creation**: ~$0.02-0.05 (LLM + image)
- **Content planning**: ~$0.01-0.02 (LLM only)
- **Image generation**: ~$0.01-0.02 per scene
- **Video generation**: ~$0.10-0.30 per scene

**Budget tip**: Start with image generation to test content before generating expensive videos.

## Next Steps

After creating your first character and content:

1. **Experiment with different personalities**
   - Try different character archetypes
   - Test various target audiences

2. **Explore platforms**
   - See how content plans differ between Instagram/TikTok/YouTube

3. **Build a character library**
   - Create multiple characters for different niches
   - Reuse successful character templates

4. **Iterate on content themes**
   - Generate multiple plans for the same character
   - Test different content angles

Enjoy creating AI influencer content! 🎬
