#!/bin/bash
# AI Influencer Studio - Launch Script

echo "=================================="
echo "AI Influencer Studio"
echo "=================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Run: python3 -m venv venv"
    exit 1
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Create .env with your API keys"
    exit 1
fi

# Run tests (optional, comment out to skip)
echo ""
echo "🧪 Running system checks..."
python test_setup.py

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ System checks failed. Please fix errors above."
    exit 1
fi

# Launch application
echo ""
echo "🚀 Launching AI Influencer Studio..."
echo ""
python gui_main.py
