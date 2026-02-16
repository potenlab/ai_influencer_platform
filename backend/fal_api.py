import fal_client as fal
import requests
from pathlib import Path

class FalClient:
    def __init__(self, api_key: str):
        fal.api_key = api_key

    def generate_character_image(self, prompt: str, save_path: str) -> str:
        """Generate character image using Nano Banana Pro (text-to-image)"""
        result = fal.run(
            "fal-ai/nano-banana-pro",
            arguments={
                "prompt": prompt,
                "image_size": "square_hd",
                "num_images": 1
            }
        )

        # Download and save image
        image_url = result['images'][0]['url']
        response = requests.get(image_url)
        response.raise_for_status()

        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(response.content)

        return save_path

    def generate_scene_image_from_character(self, prompt: str, image_paths: list[str], save_path: str) -> str:
        """Generate scene-specific image using character photo(s) as reference (image-to-image).

        Args:
            prompt: Generation prompt
            image_paths: List of local file paths (1-2 images: ID photo, optional reference)
            save_path: Where to save the result
        """
        # Upload all images to get public URLs
        image_urls = [self.upload_file(p) for p in image_paths]

        # Use Nano Banana Pro Edit for img2img
        result = fal.run(
            "fal-ai/nano-banana-pro/edit",
            arguments={
                "prompt": prompt,
                "image_urls": image_urls,
                "num_images": 1,
                "aspect_ratio": "9:16",  # Vertical for social media
                "resolution": "2K"
            }
        )

        # Download and save image
        image_url = result['images'][0]['url']
        response = requests.get(image_url)
        response.raise_for_status()

        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(response.content)

        return save_path

    def upload_file(self, file_path: str) -> str:
        """Upload a local file to fal.ai and return public URL"""
        from fal_client import upload_file
        url = upload_file(file_path)
        return url

    def generate_video(self, prompt: str, duration: int, save_path: str, image_url: str = None, image_path: str = None) -> str:
        """Generate video using Grok Imagine - with image input for consistency

        Args:
            image_url: Public URL of image (for fal.ai to download)
            image_path: Local file path to upload to fal.ai first
        """

        # If local image path is provided, upload it first to get public URL
        if image_path and not image_url:
            image_url = self.upload_file(image_path)

        # Use image-to-video if image is provided, otherwise text-to-video
        if image_url:
            result = fal.subscribe(
                "xai/grok-imagine-video/image-to-video",
                arguments={
                    "prompt": prompt,
                    "image_url": image_url,
                    "duration": min(duration, 15),
                    "aspect_ratio": "9:16",  # Vertical for social media
                    "resolution": "720p"
                },
                with_logs=True
            )
        else:
            result = fal.subscribe(
                "xai/grok-imagine-video/text-to-video",
                arguments={
                    "prompt": prompt,
                    "duration": min(duration, 15),
                    "aspect_ratio": "9:16",  # Vertical for social media
                    "resolution": "720p"
                },
                with_logs=True
            )

        # Download and save video
        video_url = result['video']['url']
        response = requests.get(video_url)
        response.raise_for_status()

        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(response.content)

        return save_path

    def generate_dreamactor_video(self, face_image_path: str, driving_video_path: str, save_path: str) -> str:
        """Generate motion-transfer video using DreamActor V2 (legacy).

        Args:
            face_image_path: Local path to face/character image
            driving_video_path: Local path to driving video (motion source)
            save_path: Local path to save output video
        """
        face_image_url = self.upload_file(face_image_path)
        driving_video_url = self.upload_file(driving_video_path)

        result = fal.subscribe(
            "fal-ai/bytedance/dreamactor/v2",
            arguments={
                "face_image_url": face_image_url,
                "driving_video_url": driving_video_url,
            },
            with_logs=True
        )

        video_url = result['video']['url']
        response = requests.get(video_url)
        response.raise_for_status()

        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(response.content)

        return save_path

    def generate_motion_control_video(self, image_path: str, video_path: str, prompt: str, save_path: str) -> str:
        """Generate video using Kling Motion Control.

        Args:
            image_path: Local path to character image (ID photo)
            video_path: Local path to driving/reference video
            prompt: Text prompt describing the video
            save_path: Local path to save output video
        """
        image_url = self.upload_file(image_path)
        video_url = self.upload_file(video_path)

        result = fal.subscribe(
            "fal-ai/kling-video/v2.6/standard/motion-control",
            arguments={
                "image_url": image_url,
                "video_url": video_url,
                "prompt": prompt,
                "character_orientation": "video",
            },
            with_logs=True
        )

        out_video_url = result['video']['url']
        response = requests.get(out_video_url)
        response.raise_for_status()

        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(response.content)

        return save_path
