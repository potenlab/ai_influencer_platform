import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Config:
    FAL_KEY = os.getenv('FAL_KEY')
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
    OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'moonshotai/kimi-k2')
    SUPABASE_URL = os.getenv('SUPABASE_URL', '')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')
    DATA_DIR = Path(os.getenv('DATA_DIR', './data'))

    # Ensure directories exist
    CHARACTERS_DIR = DATA_DIR / 'characters'
    CONTENT_PLANS_DIR = DATA_DIR / 'content_plans'
    IMAGES_DIR = DATA_DIR / 'media' / 'images'
    VIDEOS_DIR = DATA_DIR / 'media' / 'videos'

    @classmethod
    def init_directories(cls):
        for dir_path in [cls.CHARACTERS_DIR, cls.CONTENT_PLANS_DIR,
                         cls.IMAGES_DIR, cls.VIDEOS_DIR]:
            dir_path.mkdir(parents=True, exist_ok=True)
