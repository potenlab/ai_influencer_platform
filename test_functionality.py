#!/usr/bin/env python3
"""
Functional test - Tests actual API integration without GUI
"""

import sys
from config import Config
from fal_api import FalClient
from openrouter_client import OpenRouterClient
from services import CharacterService, ContentService, MediaService

def test_character_creation():
    """Test creating a character with real API calls"""
    print("=" * 60)
    print("Testing Character Creation (with real API calls)")
    print("=" * 60)

    Config.init_directories()

    # Initialize clients
    print("\n1. Initializing API clients...")
    fal_client = FalClient(Config.FAL_KEY)
    llm_client = OpenRouterClient(Config.OPENROUTER_API_KEY, Config.OPENROUTER_MODEL)
    print("✓ Clients initialized")

    # Initialize services
    print("\n2. Initializing services...")
    char_service = CharacterService(fal_client, llm_client)
    print("✓ Services initialized")

    # Create a test character
    print("\n3. Creating test character...")
    print("   Name: Tech Guru Sam")
    print("   Concept: Friendly tech educator who explains complex topics simply")
    print("   Audience: Tech beginners and enthusiasts")
    print("\n   This will:")
    print("   - Call OpenRouter API to generate personality")
    print("   - Call fal.ai API to generate character image")
    print("   - Save character data to JSON")
    print("\n   Please wait 20-40 seconds...")

    try:
        character = char_service.create_character(
            name="Tech Guru Sam",
            concept="Friendly tech educator who explains complex topics simply for beginners",
            audience="Tech beginners and enthusiasts aged 18-35"
        )

        print("\n✓ Character created successfully!")
        print(f"\n   Character ID: {character.id}")
        print(f"   Name: {character.name}")
        print(f"   Personality Traits: {', '.join(character.personality_traits)}")
        print(f"   Tone of Voice: {character.tone_of_voice}")
        print(f"   Content Style: {character.content_style}")
        print(f"   Target Audience: {character.target_audience}")
        print(f"   Content Themes: {', '.join(character.content_themes)}")
        print(f"   Image Path: {character.image_path}")

        # Verify files exist
        print("\n4. Verifying saved files...")
        import os

        json_path = Config.CHARACTERS_DIR / f"{character.id}.json"
        if os.path.exists(json_path):
            print(f"   ✓ Character JSON saved: {json_path}")
        else:
            print(f"   ✗ Character JSON NOT found: {json_path}")

        if character.image_path and os.path.exists(character.image_path):
            size = os.path.getsize(character.image_path)
            print(f"   ✓ Character image saved: {character.image_path} ({size:,} bytes)")
        else:
            print(f"   ✗ Character image NOT found: {character.image_path}")

        return True

    except Exception as e:
        print(f"\n✗ Error creating character: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_content_planning():
    """Test content planning with real API calls"""
    print("\n" + "=" * 60)
    print("Testing Content Planning")
    print("=" * 60)

    # Get the character we just created
    print("\n1. Loading character...")
    char_service = CharacterService(
        FalClient(Config.FAL_KEY),
        OpenRouterClient(Config.OPENROUTER_API_KEY, Config.OPENROUTER_MODEL)
    )

    characters = char_service.get_all_characters()
    if not characters:
        print("✗ No characters found. Create a character first.")
        return False

    character = characters[-1]  # Get the most recent character
    print(f"✓ Loaded character: {character.name}")

    # Create content plan
    print("\n2. Generating content plan...")
    print("   Theme: Quick Python tips for beginners")
    print("   Platform: instagram")
    print("\n   This will call OpenRouter API to generate content plan...")
    print("   Please wait 10-20 seconds...")

    try:
        content_service = ContentService(
            OpenRouterClient(Config.OPENROUTER_API_KEY, Config.OPENROUTER_MODEL)
        )

        plan = content_service.create_content_plan(
            character=character,
            theme="Quick Python tips for beginners",
            platform="instagram"
        )

        print("\n✓ Content plan created successfully!")
        print(f"\n   Plan ID: {plan.id}")
        print(f"   Title: {plan.title}")
        print(f"   Platform: {plan.platform}")
        print(f"   Hook: {plan.hook}")
        print(f"\n   Scenes:")
        for scene in plan.scenes:
            print(f"   {scene.scene_number}. {scene.description}")
            print(f"      Duration: {scene.duration_seconds}s")
            print(f"      Visual: {scene.visual_prompt[:80]}...")
        print(f"\n   Call to Action: {plan.call_to_action}")

        # Verify saved
        print("\n3. Verifying saved plan...")
        import os
        json_path = Config.CONTENT_PLANS_DIR / f"{plan.id}.json"
        if os.path.exists(json_path):
            print(f"   ✓ Plan saved: {json_path}")
        else:
            print(f"   ✗ Plan NOT found: {json_path}")

        return True

    except Exception as e:
        print(f"\n✗ Error creating content plan: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "=" * 60)
    print("AI Influencer System - Functional Test")
    print("=" * 60)
    print("\nThis test will make REAL API calls:")
    print("- OpenRouter (LLM) for personality & content generation")
    print("- fal.ai for image generation")
    print("\nEstimated cost: ~$0.05-0.10")
    print("Estimated time: 1-2 minutes")
    print("=" * 60)

    response = input("\nProceed with functional test? (y/n): ")
    if response.lower() != 'y':
        print("Test cancelled.")
        return 0

    # Test character creation
    if not test_character_creation():
        print("\n✗ Character creation test failed")
        return 1

    # Test content planning
    if not test_content_planning():
        print("\n✗ Content planning test failed")
        return 1

    print("\n" + "=" * 60)
    print("✓ All functional tests passed!")
    print("=" * 60)
    print("\nYou can now:")
    print("1. Run 'python gui_main.py' to use the GUI application")
    print("2. Check 'data/characters/' for created characters")
    print("3. Check 'data/content_plans/' for generated plans")
    print("4. Check 'data/media/images/' for character images")

    return 0

if __name__ == '__main__':
    sys.exit(main())
