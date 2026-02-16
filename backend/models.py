from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class Character(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    visual_description: str  # For image generation
    personality_traits: List[str]
    tone_of_voice: str  # e.g., "friendly", "professional", "humorous"
    content_style: str  # e.g., "educational", "entertaining"
    target_audience: str
    content_themes: List[str] = []
    image_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class ContentScene(BaseModel):
    scene_number: int
    description: str
    duration_seconds: int
    first_frame_prompt: str  # Prompt for generating the starting image
    visual_prompt: str  # Second-by-second prompt for video generation

class ContentPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    character_id: str
    title: str
    theme: str
    platform: str  # "instagram", "tiktok", "youtube"
    hook: str
    scenes: List[ContentScene]
    call_to_action: str
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
