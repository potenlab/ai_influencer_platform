from supabase import create_client
from datetime import datetime
from config import Config


class Database:
    def __init__(self):
        self.client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY)

    # Character operations
    def save_character(self, character):
        data = {
            'id': character['id'],
            'user_id': character['user_id'],
            'name': character['name'],
            'visual_description': character.get('visual_description'),
            'personality_traits': character.get('personality_traits', []),
            'tone_of_voice': character.get('tone_of_voice'),
            'content_style': character.get('content_style'),
            'target_audience': character.get('target_audience'),
            'content_themes': character.get('content_themes', []),
            'image_path': character.get('image_path'),
            'created_at': character.get('created_at', datetime.now().isoformat()),
        }
        self.client.table('characters').upsert(data).execute()

    def get_all_characters(self, user_id=None):
        query = self.client.table('characters').select('*').order('created_at', desc=True)
        if user_id:
            query = query.eq('user_id', user_id)
        result = query.execute()
        return result.data

    def get_character(self, character_id):
        result = self.client.table('characters').select('*').eq('id', character_id).maybe_single().execute()
        return result.data

    def delete_character(self, character_id):
        """Delete character and all related data. Returns list of media file paths to delete."""
        # Collect media file paths for cleanup
        media_result = self.client.table('media').select('file_path, first_frame_path').eq('character_id', character_id).execute()

        # Also collect media linked via content_plans
        plans_result = self.client.table('content_plans').select('id').eq('character_id', character_id).execute()
        plan_ids = [p['id'] for p in plans_result.data]

        plan_media = []
        if plan_ids:
            plan_media_result = self.client.table('media').select('file_path, first_frame_path').in_('plan_id', plan_ids).execute()
            plan_media = plan_media_result.data

        file_paths = []
        for row in media_result.data + plan_media:
            if row.get('file_path'):
                file_paths.append(row['file_path'])
            if row.get('first_frame_path'):
                file_paths.append(row['first_frame_path'])

        # Get character image_path
        char = self.get_character(character_id)
        if char and char.get('image_path'):
            file_paths.append(char['image_path'])

        # Delete media rows
        self.client.table('media').delete().eq('character_id', character_id).execute()
        if plan_ids:
            self.client.table('media').delete().in_('plan_id', plan_ids).execute()

        # Delete content plans
        self.client.table('content_plans').delete().eq('character_id', character_id).execute()

        # Delete character
        self.client.table('characters').delete().eq('id', character_id).execute()

        return file_paths

    # Content plan operations
    def save_content_plan(self, plan):
        data = {
            'id': plan['id'],
            'character_id': plan['character_id'],
            'title': plan.get('title'),
            'theme': plan.get('theme'),
            'platform': plan.get('platform', ''),
            'hook': plan.get('hook'),
            'duration_seconds': plan.get('duration_seconds'),
            'first_frame_prompt': plan.get('first_frame_prompt'),
            'video_prompt': plan.get('video_prompt'),
            'call_to_action': plan.get('call_to_action'),
            'created_at': plan.get('created_at', datetime.now().isoformat()),
        }
        self.client.table('content_plans').upsert(data).execute()

    def get_content_plans(self, character_id=None):
        query = self.client.table('content_plans').select('*').order('created_at', desc=True)
        if character_id:
            query = query.eq('character_id', character_id)
        return query.execute().data

    def get_content_plan(self, plan_id):
        result = self.client.table('content_plans').select('*').eq('id', plan_id).maybe_single().execute()
        return result.data

    # Media operations
    def save_media(self, plan_id, media_type, file_path):
        data = {
            'plan_id': plan_id,
            'media_type': media_type,
            'file_path': file_path,
            'created_at': datetime.now().isoformat(),
        }
        self.client.table('media').insert(data).execute()

    def save_media_v2(self, character_id, media_type, file_path,
                      generation_mode=None, prompt=None, video_prompt=None,
                      first_frame_path=None, reference_image_path=None,
                      plan_id=None):
        """Save media with extended v2 fields"""
        data = {
            'plan_id': plan_id,
            'character_id': character_id,
            'media_type': media_type,
            'file_path': file_path,
            'generation_mode': generation_mode,
            'prompt': prompt,
            'video_prompt': video_prompt,
            'first_frame_path': first_frame_path,
            'reference_image_path': reference_image_path,
            'created_at': datetime.now().isoformat(),
        }
        result = self.client.table('media').insert(data).execute()
        return result.data[0]['id'] if result.data else None

    def get_media(self, plan_id):
        result = self.client.table('media').select('*').eq('plan_id', plan_id).order('created_at', desc=True).execute()
        return result.data

    def get_all_media_with_details(self, character_id=None, media_type=None):
        """Get all media with character and plan details via joins."""
        # Use a Postgres function or multiple queries
        # Since Supabase supports foreign key joins via select syntax:
        query = self.client.table('media').select(
            '*, characters!media_character_id_fkey(name, id, image_path), '
            'content_plans!media_plan_id_fkey(title, theme, hook, first_frame_prompt, video_prompt, call_to_action, duration_seconds)'
        ).order('created_at', desc=True)

        if character_id:
            query = query.eq('character_id', character_id)
        if media_type:
            query = query.eq('media_type', media_type)

        result = query.execute()

        # Flatten the joined data to match the old format
        items = []
        for row in result.data:
            char = row.get('characters') or {}
            plan = row.get('content_plans') or {}
            items.append({
                'id': row['id'],
                'plan_id': row.get('plan_id'),
                'media_type': row['media_type'],
                'file_path': row['file_path'],
                'created_at': row['created_at'],
                'character_id': row.get('character_id'),
                'character_name': char.get('name', ''),
                'character_image_path': char.get('image_path', ''),
                'generation_mode': row.get('generation_mode'),
                'prompt': row.get('prompt'),
                'video_prompt': row.get('video_prompt'),
                'first_frame_path': row.get('first_frame_path'),
                'reference_image_path': row.get('reference_image_path'),
                'plan_title': plan.get('title'),
                'plan_theme': plan.get('theme'),
                'hook': plan.get('hook'),
                'plan_first_frame_prompt': plan.get('first_frame_prompt'),
                'plan_video_prompt': plan.get('video_prompt'),
                'call_to_action': plan.get('call_to_action'),
                'duration_seconds': plan.get('duration_seconds'),
            })
        return items
