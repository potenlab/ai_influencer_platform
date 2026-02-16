#!/usr/bin/env python3
"""
Test script to verify AI Influencer setup is correct
"""

import sys
from pathlib import Path

def test_imports():
    """Test that all modules can be imported"""
    print("Testing module imports...")
    try:
        from config import Config
        from models import Character, ContentPlan, ContentScene
        from storage import JSONStorage
        from fal_api import FalClient
        from openrouter_client import OpenRouterClient
        from services import CharacterService, ContentService, MediaService
        import gui_main
        print("✓ All modules imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False

def test_config():
    """Test configuration and environment variables"""
    print("\nTesting configuration...")
    try:
        from config import Config

        assert Config.FAL_KEY is not None, "FAL_KEY not set"
        assert Config.OPENROUTER_API_KEY is not None, "OPENROUTER_API_KEY not set"
        assert Config.OPENROUTER_MODEL is not None, "OPENROUTER_MODEL not set"

        print(f"✓ FAL_KEY: {Config.FAL_KEY[:20]}...")
        print(f"✓ OPENROUTER_API_KEY: {Config.OPENROUTER_API_KEY[:20]}...")
        print(f"✓ OPENROUTER_MODEL: {Config.OPENROUTER_MODEL}")
        print(f"✓ DATA_DIR: {Config.DATA_DIR}")

        return True
    except AssertionError as e:
        print(f"✗ Configuration error: {e}")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_directories():
    """Test that data directories are created"""
    print("\nTesting directory structure...")
    try:
        from config import Config
        Config.init_directories()

        dirs = [
            Config.CHARACTERS_DIR,
            Config.CONTENT_PLANS_DIR,
            Config.IMAGES_DIR,
            Config.VIDEOS_DIR
        ]

        for dir_path in dirs:
            if dir_path.exists() and dir_path.is_dir():
                print(f"✓ {dir_path}")
            else:
                print(f"✗ {dir_path} not found")
                return False

        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_data_models():
    """Test that data models work correctly"""
    print("\nTesting data models...")
    try:
        from models import Character, ContentPlan, ContentScene

        # Test Character model
        char = Character(
            name="Test Character",
            visual_description="A test character",
            personality_traits=["friendly", "creative"],
            tone_of_voice="casual",
            content_style="educational",
            target_audience="developers"
        )
        print(f"✓ Character model: {char.name} (ID: {char.id[:8]}...)")

        # Test ContentScene model
        scene = ContentScene(
            scene_number=1,
            description="Test scene",
            duration_seconds=5,
            visual_prompt="A test visual prompt"
        )
        print(f"✓ ContentScene model: Scene {scene.scene_number}")

        # Test ContentPlan model
        plan = ContentPlan(
            character_id=char.id,
            title="Test Plan",
            theme="testing",
            platform="instagram",
            hook="Test hook",
            scenes=[scene],
            call_to_action="Test CTA"
        )
        print(f"✓ ContentPlan model: {plan.title} (ID: {plan.id[:8]}...)")

        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_storage():
    """Test JSON storage operations"""
    print("\nTesting storage operations...")
    try:
        from models import Character
        from storage import JSONStorage
        from config import Config

        storage = JSONStorage(Config.CHARACTERS_DIR)

        # Create test character
        char = Character(
            name="Storage Test",
            visual_description="Test",
            personality_traits=["test"],
            tone_of_voice="test",
            content_style="test",
            target_audience="test"
        )

        # Save
        filename = f"test_{char.id}.json"
        success = storage.save(char, filename)
        if not success:
            print("✗ Failed to save character")
            return False
        print(f"✓ Saved character to {filename}")

        # Load
        loaded = storage.load(filename, Character)
        if loaded is None:
            print("✗ Failed to load character")
            return False
        print(f"✓ Loaded character: {loaded.name}")

        # Clean up
        (Config.CHARACTERS_DIR / filename).unlink()
        print("✓ Cleaned up test file")

        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("AI Influencer System - Setup Test")
    print("=" * 60)

    tests = [
        test_imports,
        test_config,
        test_directories,
        test_data_models,
        test_storage
    ]

    results = []
    for test in tests:
        results.append(test())

    print("\n" + "=" * 60)
    print("Test Results")
    print("=" * 60)

    passed = sum(results)
    total = len(results)

    print(f"Passed: {passed}/{total}")

    if passed == total:
        print("\n✓ All tests passed! System is ready to use.")
        print("\nRun the application with:")
        print("  source venv/bin/activate")
        print("  python gui_main.py")
        return 0
    else:
        print("\n✗ Some tests failed. Please fix the issues above.")
        return 1

if __name__ == '__main__':
    sys.exit(main())
