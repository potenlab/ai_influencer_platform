from config import Config
from fal_api import FalClient
from openrouter_client import OpenRouterClient
from database import Database
from datetime import datetime
from pathlib import Path
import uuid

class CharacterService:
    def __init__(self, fal_client: FalClient, llm_client: OpenRouterClient, db: Database):
        self.fal_client = fal_client
        self.llm_client = llm_client
        self.db = db

    def create_character(self, name: str, concept: str, audience: str,
                         image_path: str = None, image_mode: str = 'direct',
                         user_id: str = None):
        """Create new character with AI-generated personality and ID photo.

        Args:
            image_path: Uploaded image web path (e.g. /media/images/xxx.png).
            image_mode: 'direct' = use uploaded image as-is,
                        'generate' = use uploaded image as reference for AI generation.
        """
        personality = self.llm_client.generate_character_personality(concept, audience)

        character_id = str(uuid.uuid4())
        character = {
            'id': character_id,
            'user_id': user_id,
            'name': name,
            'visual_description': personality['visual_description'],
            'personality_traits': personality['personality_traits'],
            'tone_of_voice': personality['tone_of_voice'],
            'content_style': personality['content_style'],
            'target_audience': audience,
            'content_themes': personality['content_themes'],
            'created_at': datetime.now().isoformat()
        }

        if image_path and image_mode == 'direct':
            # Use uploaded image as-is
            character['image_path'] = image_path
        elif image_path and image_mode == 'generate':
            # Generate new image using uploaded image as reference
            ref_local = str(Config.DATA_DIR / image_path[1:])
            gen_filename = f"{character_id}.png"
            gen_path = Config.IMAGES_DIR / gen_filename
            self.fal_client.generate_scene_image_from_character(
                prompt=personality['visual_description'],
                image_paths=[ref_local],
                save_path=str(gen_path)
            )
            character['image_path'] = f"/media/images/{gen_filename}"
        else:
            # No image uploaded — generate from text prompt only
            gen_filename = f"{character_id}.png"
            gen_path = Config.IMAGES_DIR / gen_filename
            self.fal_client.generate_character_image(
                prompt=personality['visual_description'],
                save_path=str(gen_path)
            )
            character['image_path'] = f"/media/images/{gen_filename}"

        self.db.save_character(character)
        return character

    def get_all_characters(self, user_id=None):
        return self.db.get_all_characters(user_id=user_id)

    def get_character(self, character_id: str):
        return self.db.get_character(character_id)

    def delete_character(self, character_id: str):
        """Delete character and clean up related media files from disk."""
        file_paths = self.db.delete_character(character_id)

        # Delete actual files from disk
        for web_path in file_paths:
            if web_path and web_path.startswith('/media/'):
                local_path = Config.DATA_DIR / web_path[1:]
                try:
                    Path(local_path).unlink(missing_ok=True)
                except Exception:
                    pass


class ContentService:
    """Legacy content planning service"""
    def __init__(self, llm_client: OpenRouterClient, db: Database):
        self.llm_client = llm_client
        self.db = db

    def create_content_plan(self, character: dict, theme: str):
        """Generate single-video content plan"""
        plan_data = self.llm_client.generate_content_plan(
            character=character,
            theme=theme
        )

        plan = {
            'id': str(uuid.uuid4()),
            'character_id': character['id'],
            'title': plan_data['title'],
            'theme': theme,
            'platform': '',
            'hook': plan_data['hook'],
            'duration_seconds': plan_data['duration_seconds'],
            'first_frame_prompt': plan_data['first_frame_prompt'],
            'video_prompt': plan_data['video_prompt'],
            'call_to_action': plan_data['call_to_action'],
            'created_at': datetime.now().isoformat()
        }

        self.db.save_content_plan(plan)
        return plan

    def get_content_plans(self, character_id=None):
        return self.db.get_content_plans(character_id)

    def get_content_plan(self, plan_id: str):
        return self.db.get_content_plan(plan_id)


class MediaService:
    """Legacy media service"""
    def __init__(self, fal_client: FalClient, db: Database):
        self.fal_client = fal_client
        self.db = db

    def _get_character_image_path(self, character):
        """Convert character web path to local filesystem path"""
        if not character or not character.get('image_path'):
            return None
        web_path = character['image_path']
        if web_path.startswith('/media/'):
            return str(Config.DATA_DIR / web_path[1:])
        return None

    def generate_image(self, plan: dict, character, generation_option: str = 'ref_image', reference_image_path: str = None) -> str:
        plan_id = plan['id']
        first_frame_prompt = plan['first_frame_prompt']

        filename = f"{plan_id}_first_frame.png"
        save_path = Config.IMAGES_DIR / filename

        if generation_option == 'ref_image':
            ref_local_path = None
            if reference_image_path:
                if reference_image_path.startswith('/media/'):
                    ref_local_path = str(Config.DATA_DIR / reference_image_path[1:])
            if not ref_local_path:
                ref_local_path = self._get_character_image_path(character)

            if ref_local_path:
                self.fal_client.generate_scene_image_from_character(
                    prompt=first_frame_prompt,
                    image_paths=[ref_local_path],
                    save_path=str(save_path)
                )
            else:
                enhanced_prompt = first_frame_prompt
                if character and character.get('visual_description'):
                    enhanced_prompt = f"{character['visual_description']}. {first_frame_prompt}"
                self.fal_client.generate_character_image(
                    prompt=enhanced_prompt,
                    save_path=str(save_path)
                )
        else:
            enhanced_prompt = first_frame_prompt
            if character and character.get('visual_description'):
                enhanced_prompt = f"{character['visual_description']}. {first_frame_prompt}"
            self.fal_client.generate_character_image(
                prompt=enhanced_prompt,
                save_path=str(save_path)
            )

        file_url = f"/media/images/{filename}"
        self.db.save_media(plan_id, 'image', file_url)
        return file_url

    def generate_video(self, plan: dict, character, generation_option: str = 'ref_image', reference_image_path: str = None) -> dict:
        plan_id = plan['id']

        first_frame_url = self.generate_image(plan, character, generation_option, reference_image_path)
        first_frame_local = str(Config.DATA_DIR / first_frame_url[1:])

        video_filename = f"{plan_id}_video.mp4"
        video_save_path = Config.VIDEOS_DIR / video_filename

        self.fal_client.generate_video(
            prompt=plan['video_prompt'],
            duration=plan['duration_seconds'],
            save_path=str(video_save_path),
            image_path=first_frame_local
        )

        video_url = f"/media/videos/{video_filename}"
        self.db.save_media(plan_id, 'video', video_url)

        return {
            'first_frame_path': first_frame_url,
            'video_path': video_url
        }

    def generate_dreamactor_video(self, character, driving_video_path: str, plan_id: str = None) -> str:
        face_image_path = self._get_character_image_path(character)
        if not face_image_path:
            raise ValueError("Character has no ID photo for DreamActor")

        video_filename = f"{plan_id or 'dreamactor'}_{uuid.uuid4().hex[:8]}_dreamactor.mp4"
        video_save_path = Config.VIDEOS_DIR / video_filename

        self.fal_client.generate_dreamactor_video(
            face_image_path=face_image_path,
            driving_video_path=driving_video_path,
            save_path=str(video_save_path)
        )

        video_url = f"/media/videos/{video_filename}"
        if plan_id:
            self.db.save_media(plan_id, 'video', video_url)
        return video_url

    def get_media(self, plan_id: str):
        return self.db.get_media(plan_id)


class GenerateService:
    """New v2 generation service — no Plan step required"""

    def __init__(self, fal_client: FalClient, llm_client: OpenRouterClient, db: Database):
        self.fal_client = fal_client
        self.llm_client = llm_client
        self.db = db

    def _get_local_path(self, web_path: str) -> str:
        """Convert /media/... web path to local filesystem path"""
        if web_path and web_path.startswith('/media/'):
            return str(Config.DATA_DIR / web_path[1:])
        return web_path

    def _get_character_image_local(self, character: dict) -> str:
        """Get the local filesystem path for character's ID photo"""
        img = character.get('image_path')
        if not img:
            raise ValueError("Character has no ID photo")
        return self._get_local_path(img)

    def generate_image(self, character: dict, prompt: str, option: str,
                       reference_image_path: str = None) -> dict:
        """Generate an image directly (no Plan needed).

        Args:
            character: Character dict
            prompt: User prompt
            option: 'ref_image' or 'text_only'
            reference_image_path: Web path to uploaded reference image (optional)
        """
        char_local = self._get_character_image_local(character)
        gen_id = uuid.uuid4().hex[:12]
        filename = f"gen_{gen_id}.png"
        save_path = Config.IMAGES_DIR / filename

        if option == 'ref_image':
            # Always include character ID photo
            image_paths = [char_local]
            # Add optional reference image
            if reference_image_path:
                ref_local = self._get_local_path(reference_image_path)
                if ref_local:
                    image_paths.append(ref_local)

            self.fal_client.generate_scene_image_from_character(
                prompt=prompt,
                image_paths=image_paths,
                save_path=str(save_path)
            )
        else:
            # text_only: still use character ID photo for consistency
            self.fal_client.generate_scene_image_from_character(
                prompt=prompt,
                image_paths=[char_local],
                save_path=str(save_path)
            )

        file_url = f"/media/images/{filename}"
        media_id = self.db.save_media_v2(
            character_id=character['id'],
            media_type='image',
            file_path=file_url,
            generation_mode=option,
            prompt=prompt,
            reference_image_path=reference_image_path,
        )

        return {'media_id': media_id, 'file_path': file_url}

    def prepare_video(self, character: dict, concept: str, option: str,
                      reference_image_path: str = None) -> dict:
        """Prepare video: generate first frame + LLM video prompt.

        Returns prepare result (not saved to DB yet).
        """
        char_local = self._get_character_image_local(character)
        gen_id = uuid.uuid4().hex[:12]

        # Step 1: Generate first frame image
        ff_filename = f"ff_{gen_id}.png"
        ff_save_path = Config.IMAGES_DIR / ff_filename

        image_paths = [char_local]
        if option == 'ref_image' and reference_image_path:
            ref_local = self._get_local_path(reference_image_path)
            if ref_local:
                image_paths.append(ref_local)

        first_frame_prompt = f"A high-quality still frame of {character['name']}. {concept}"
        self.fal_client.generate_scene_image_from_character(
            prompt=first_frame_prompt,
            image_paths=image_paths,
            save_path=str(ff_save_path)
        )

        first_frame_url = f"/media/images/{ff_filename}"

        # Step 2: Generate video prompt via LLM
        video_prompt = self.llm_client.generate_video_prompt(character, concept)

        return {
            'prepare_id': gen_id,
            'first_frame_path': first_frame_url,
            'video_prompt': video_prompt,
        }

    def finalize_video(self, character: dict, first_frame_path: str,
                       video_prompt: str, concept: str) -> dict:
        """Finalize video: first frame + edited video prompt → Grok image-to-video.

        Duration is determined by LLM based on the final video prompt.
        """
        # Determine optimal duration from the final (possibly edited) prompt
        duration = self.llm_client.determine_video_duration(video_prompt)

        ff_local = self._get_local_path(first_frame_path)
        gen_id = uuid.uuid4().hex[:12]

        video_filename = f"vid_{gen_id}.mp4"
        video_save_path = Config.VIDEOS_DIR / video_filename

        self.fal_client.generate_video(
            prompt=video_prompt,
            duration=duration,
            save_path=str(video_save_path),
            image_path=ff_local
        )

        video_url = f"/media/videos/{video_filename}"
        media_id = self.db.save_media_v2(
            character_id=character['id'],
            media_type='video',
            file_path=video_url,
            generation_mode='video',
            prompt=concept,
            video_prompt=video_prompt,
            first_frame_path=first_frame_path,
        )

        return {
            'media_id': media_id,
            'video_path': video_url,
            'first_frame_path': first_frame_path,
        }

    def generate_motion_video(self, character: dict, prompt: str,
                              driving_video_path: str) -> dict:
        """Generate video using Kling Motion Control.

        Args:
            character: Character dict (ID photo used as image_url)
            prompt: Text prompt
            driving_video_path: Local filesystem path to driving video
        """
        char_local = self._get_character_image_local(character)
        gen_id = uuid.uuid4().hex[:12]

        video_filename = f"motion_{gen_id}.mp4"
        video_save_path = Config.VIDEOS_DIR / video_filename

        self.fal_client.generate_motion_control_video(
            image_path=char_local,
            video_path=driving_video_path,
            prompt=prompt,
            save_path=str(video_save_path)
        )

        video_url = f"/media/videos/{video_filename}"
        media_id = self.db.save_media_v2(
            character_id=character['id'],
            media_type='video',
            file_path=video_url,
            generation_mode='motion_control',
            prompt=prompt,
        )

        return {'media_id': media_id, 'video_path': video_url}
