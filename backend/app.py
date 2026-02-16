from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from werkzeug.utils import secure_filename
from functools import wraps
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from supabase import create_client as create_supabase_client

ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'mov', 'webm'}
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_VIDEO_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB
MAX_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024   # 10MB
from database import Database
from fal_api import FalClient
from openrouter_client import OpenRouterClient
from services import CharacterService, ContentService, MediaService, GenerateService
import traceback

app = Flask(__name__)
CORS(app)

# Initialize
Config.init_directories()
db = Database()
fal_client = FalClient(Config.FAL_KEY)
llm_client = OpenRouterClient(Config.OPENROUTER_API_KEY, Config.OPENROUTER_MODEL)

char_service = CharacterService(fal_client, llm_client, db)
content_service = ContentService(llm_client, db)
media_service = MediaService(fal_client, db)
generate_service = GenerateService(fal_client, llm_client, db)


# ===== Auth middleware =====

# Shared Supabase client for auth verification
_auth_client = create_supabase_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY)


def require_auth(f):
    """Decorator to require valid Supabase JWT."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401

        token = auth_header.split(' ', 1)[1]
        try:
            user_response = _auth_client.auth.get_user(token)
            user = user_response.user
            if not user:
                return jsonify({'error': 'Invalid token'}), 401
            g.user_id = user.id
            g.user_email = user.email
        except Exception as e:
            return jsonify({'error': f'Authentication failed: {str(e)}'}), 401

        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Decorator to require admin role."""
    @wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        result = db.client.table('profiles').select('role').eq('id', g.user_id).maybe_single().execute()
        if not result.data or result.data.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


# ===== Admin endpoints =====

@app.route('/api/admin/users', methods=['GET'])
@require_admin
def admin_list_users():
    """List all users (admin only)."""
    try:
        result = db.client.table('profiles').select('id, email, role, created_at').order('created_at', desc=True).execute()
        return jsonify(result.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users', methods=['POST'])
@require_admin
def admin_create_user():
    """Create a new user (admin only)."""
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'user')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        # Create user via Supabase Auth admin API
        result = db.client.auth.admin.create_user({
            'email': email,
            'password': password,
            'email_confirm': True,
            'user_metadata': {'role': role}
        })

        return jsonify({
            'id': result.user.id,
            'email': result.user.email,
            'role': role,
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
@require_admin
def admin_delete_user(user_id):
    """Delete a user (admin only)."""
    try:
        # Don't allow deleting self
        if user_id == g.user_id:
            return jsonify({'error': 'Cannot delete yourself'}), 400

        db.client.auth.admin.delete_user(user_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== Character endpoints =====

@app.route('/api/characters', methods=['GET'])
@require_auth
def get_characters():
    try:
        characters = char_service.get_all_characters(user_id=g.user_id)
        return jsonify(characters)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/characters', methods=['POST'])
@require_auth
def create_character():
    try:
        image_path = None
        image_mode = 'direct'

        if request.content_type and 'multipart/form-data' in request.content_type:
            name = request.form.get('name')
            concept = request.form.get('concept')
            audience = request.form.get('audience', 'General audience')
            image_mode = request.form.get('image_mode', 'direct')

            if 'image' in request.files:
                file = request.files['image']
                if file.filename:
                    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
                    if ext not in ALLOWED_IMAGE_EXTENSIONS:
                        return jsonify({'error': f'Invalid image type. Allowed: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'}), 400

                    file.seek(0, 2)
                    size = file.tell()
                    file.seek(0)
                    if size > MAX_IMAGE_UPLOAD_SIZE:
                        return jsonify({'error': 'Image too large. Maximum 10MB.'}), 400

                    filename = f"char_{uuid.uuid4().hex[:8]}.{ext}"
                    save_path = Config.IMAGES_DIR / filename
                    file.save(str(save_path))
                    image_path = f"/media/images/{filename}"
        else:
            data = request.json
            name = data.get('name')
            concept = data.get('concept')
            audience = data.get('audience', 'General audience')

        if not name or not concept:
            return jsonify({'error': 'Name and concept are required'}), 400

        character = char_service.create_character(
            name, concept, audience,
            image_path=image_path,
            image_mode=image_mode,
            user_id=g.user_id
        )
        return jsonify(character)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/characters/<character_id>', methods=['DELETE'])
@require_auth
def delete_character(character_id):
    try:
        character = char_service.get_character(character_id)
        if not character:
            return jsonify({'error': 'Character not found'}), 404

        char_service.delete_character(character_id)
        return jsonify({'success': True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/characters/<character_id>', methods=['GET'])
@require_auth
def get_character(character_id):
    try:
        character = char_service.get_character(character_id)
        if character:
            return jsonify(character)
        return jsonify({'error': 'Character not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== Legacy endpoints (content plans + old media generate) =====

@app.route('/api/content-plans', methods=['GET'])
@require_auth
def get_content_plans():
    try:
        character_id = request.args.get('character_id')
        plans = content_service.get_content_plans(character_id)
        return jsonify(plans)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/content-plans', methods=['POST'])
@require_auth
def create_content_plan():
    try:
        data = request.json
        character_id = data.get('character_id')
        theme = data.get('theme')

        if not character_id or not theme:
            return jsonify({'error': 'Character ID and theme are required'}), 400

        character = char_service.get_character(character_id)
        if not character:
            return jsonify({'error': 'Character not found'}), 404

        plan = content_service.create_content_plan(character, theme)
        return jsonify(plan)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/content-plans/<plan_id>', methods=['GET'])
@require_auth
def get_content_plan(plan_id):
    try:
        plan = content_service.get_content_plan(plan_id)
        if plan:
            return jsonify(plan)
        return jsonify({'error': 'Plan not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/media/generate', methods=['POST'])
@require_auth
def generate_media():
    """Legacy: Generate media for a content plan."""
    try:
        data = request.json
        plan_id = data.get('plan_id')
        media_type = data.get('media_type', 'image')
        generation_option = data.get('generation_option', 'ref_image')
        reference_image_path = data.get('reference_image_path')

        if not plan_id:
            return jsonify({'error': 'Plan ID is required'}), 400

        plan = content_service.get_content_plan(plan_id)
        if not plan:
            return jsonify({'error': 'Plan not found'}), 404

        for field in ('title', 'hook', 'first_frame_prompt', 'video_prompt', 'call_to_action'):
            if data.get(field) is not None:
                plan[field] = data[field]

        character = char_service.get_character(plan['character_id'])

        if media_type == 'video':
            result = media_service.generate_video(plan, character, generation_option, reference_image_path)
            return jsonify({
                'media_type': 'video',
                'video_path': result['video_path'],
                'first_frame_path': result['first_frame_path']
            })
        else:
            file_path = media_service.generate_image(plan, character, generation_option, reference_image_path)
            return jsonify({
                'media_type': 'image',
                'file_path': file_path
            })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/media/history', methods=['GET'])
@require_auth
def get_media_history():
    try:
        character_id = request.args.get('character_id')
        media_type = request.args.get('media_type')
        media = db.get_all_media_with_details(
            character_id=character_id if character_id else None,
            media_type=media_type if media_type else None
        )
        return jsonify(media)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/media/<plan_id>', methods=['GET'])
@require_auth
def get_media(plan_id):
    try:
        media = media_service.get_media(plan_id)
        return jsonify(media)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/media/upload-video', methods=['POST'])
@require_auth
def upload_video():
    """Upload a driving video file. Max 100MB, mp4/mov/webm."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({'error': 'No file selected'}), 400

        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        if ext not in ALLOWED_VIDEO_EXTENSIONS:
            return jsonify({'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_VIDEO_EXTENSIONS)}'}), 400

        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        if size > MAX_VIDEO_UPLOAD_SIZE:
            return jsonify({'error': 'File too large. Maximum 100MB.'}), 400

        filename = f"upload_{uuid.uuid4().hex[:8]}.{ext}"
        save_path = Config.VIDEOS_DIR / filename
        file.save(str(save_path))

        return jsonify({
            'file_path': str(save_path),
            'web_path': f"/media/videos/{filename}"
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/media/generate-dreamactor', methods=['POST'])
@require_auth
def generate_dreamactor():
    """Legacy: Generate DreamActor V2 motion-transfer video."""
    try:
        data = request.json
        character_id = data.get('character_id')
        driving_video_path = data.get('driving_video_path')
        plan_id = data.get('plan_id')

        if not character_id or not driving_video_path:
            return jsonify({'error': 'character_id and driving_video_path are required'}), 400

        character = char_service.get_character(character_id)
        if not character:
            return jsonify({'error': 'Character not found'}), 404

        video_url = media_service.generate_dreamactor_video(character, driving_video_path, plan_id)

        return jsonify({
            'media_type': 'video',
            'video_path': video_url
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ===== New v2 endpoints =====

@app.route('/api/generate/image', methods=['POST'])
@require_auth
def generate_image_v2():
    try:
        data = request.json
        character_id = data.get('character_id')
        prompt = data.get('prompt')
        option = data.get('option', 'ref_image')
        reference_image_path = data.get('reference_image_path')

        if not character_id or not prompt:
            return jsonify({'error': 'character_id and prompt are required'}), 400

        character = char_service.get_character(character_id)
        if not character:
            return jsonify({'error': 'Character not found'}), 404

        result = generate_service.generate_image(character, prompt, option, reference_image_path)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate/video/prepare', methods=['POST'])
@require_auth
def prepare_video_v2():
    try:
        data = request.json
        character_id = data.get('character_id')
        concept = data.get('concept')
        option = data.get('option', 'text_only')
        reference_image_path = data.get('reference_image_path')

        if not character_id or not concept:
            return jsonify({'error': 'character_id and concept are required'}), 400

        character = char_service.get_character(character_id)
        if not character:
            return jsonify({'error': 'Character not found'}), 404

        result = generate_service.prepare_video(character, concept, option, reference_image_path)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate/video/final', methods=['POST'])
@require_auth
def finalize_video_v2():
    try:
        data = request.json
        character_id = data.get('character_id')
        first_frame_path = data.get('first_frame_path')
        video_prompt = data.get('video_prompt')
        concept = data.get('concept', '')

        if not character_id or not first_frame_path or not video_prompt:
            return jsonify({'error': 'character_id, first_frame_path, and video_prompt are required'}), 400

        character = char_service.get_character(character_id)
        if not character:
            return jsonify({'error': 'Character not found'}), 404

        result = generate_service.finalize_video(character, first_frame_path, video_prompt, concept)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate/video/motion', methods=['POST'])
@require_auth
def generate_motion_video_v2():
    try:
        data = request.json
        character_id = data.get('character_id')
        prompt = data.get('prompt')
        driving_video_path = data.get('driving_video_path')

        if not character_id or not prompt or not driving_video_path:
            return jsonify({'error': 'character_id, prompt, and driving_video_path are required'}), 400

        character = char_service.get_character(character_id)
        if not character:
            return jsonify({'error': 'Character not found'}), 404

        result = generate_service.generate_motion_video(character, prompt, driving_video_path)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload/image', methods=['POST'])
@require_auth
def upload_image():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({'error': 'No file selected'}), 400

        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            return jsonify({'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'}), 400

        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        if size > MAX_IMAGE_UPLOAD_SIZE:
            return jsonify({'error': 'File too large. Maximum 10MB.'}), 400

        filename = f"ref_{uuid.uuid4().hex[:8]}.{ext}"
        save_path = Config.IMAGES_DIR / filename
        file.save(str(save_path))

        return jsonify({
            'file_path': str(save_path),
            'web_path': f"/media/images/{filename}"
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# Serve media files (no auth needed for serving)
@app.route('/media/images/<filename>')
def serve_image(filename):
    return send_from_directory(str(Config.IMAGES_DIR), filename)

@app.route('/media/videos/<filename>')
def serve_video(filename):
    return send_from_directory(str(Config.VIDEOS_DIR), filename)

@app.route('/api/download/images/<filename>')
def download_image(filename):
    return send_from_directory(str(Config.IMAGES_DIR), filename, as_attachment=True)

@app.route('/api/download/videos/<filename>')
def download_video(filename):
    return send_from_directory(str(Config.VIDEOS_DIR), filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True, port=8000)
