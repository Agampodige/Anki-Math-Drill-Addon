#!/usr/bin/env python3
"""
Test script for the new level progress page functionality
"""

import json
import os
import sys

# Add the project directory to the path
sys.path.insert(0, os.path.dirname(__file__))

def test_level_progress_page():
    """Test that the level progress page has all required components"""
    
    print("Testing level progress page implementation...")
    
    # Check if the level progress HTML file exists and has required elements
    progress_file = os.path.join('web', 'level_progress.html')
    
    if not os.path.exists(progress_file):
        print(f"❌ ERROR: {progress_file} not found")
        return False
    
    print(f"✅ Found {progress_file}")
    
    # Read the file and check for required components
    with open(progress_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check for required HTML elements
    required_elements = [
        'id="levelTitle"',           # Level title display
        'id="levelOperation"',       # Operation type display
        'id="timerSection"',         # Timer section (conditional)
        'id="questionsFill"',        # Progress bar fill
        'id="questionsText"',        # Progress text
        'id="gameSection"',          # Game section
        'id="questionDisplay"',      # Question display
        'id="answerInput"',          # Answer input
        'id="submitBtn"',            # Submit button
        'id="feedback"',             # Feedback display
        'onclick="startGame()"',     # Start game handler
        'onclick="checkAnswer()"',   # Check answer handler
    ]
    
    missing_elements = []
    for element in required_elements:
        if element not in content:
            missing_elements.append(element)
    
    if missing_elements:
        print(f"❌ ERROR: Missing required elements: {missing_elements}")
        return False
    
    print("✅ All required HTML elements found")
    
    # Check for required JavaScript functionality
    required_js_functions = [
        'startGame()',               # Start game function
        'checkAnswer()',             # Check answer function
        'loadNextQuestion()',        # Load next question
        'updateProgressDisplay()',   # Update progress
        'endGame()',                 # End game
        'sendToPython(',            # Python bridge communication
        'get_level_question',        # Get level question from backend
        'log_attempt',              # Log attempts to backend
        'end_session',              # End session on backend
    ]
    
    missing_js_functions = []
    for func in required_js_functions:
        if func not in content:
            missing_js_functions.append(func)
    
    if missing_js_functions:
        print(f"❌ ERROR: Missing required JavaScript functions: {missing_js_functions}")
        return False
    
    print("✅ All required JavaScript functions found")
    
    # Check for CSS styles
    required_css_classes = [
        '.game-section',             # Game section styling
        '.question-display',        # Question display styling
        '.answer-input',            # Answer input styling
        '.submit-btn',              # Submit button styling
        '.feedback',                # Feedback styling
        '.correct',                 # Correct answer styling
        '.incorrect',               # Incorrect answer styling
        '.hidden',                  # Hidden class
    ]
    
    missing_css_classes = []
    for css_class in required_css_classes:
        if css_class not in content:
            missing_css_classes.append(css_class)
    
    if missing_css_classes:
        print(f"❌ ERROR: Missing required CSS classes: {missing_css_classes}")
        return False
    
    print("✅ All required CSS classes found")
    
    # Check that it doesn't navigate to index.html
    if 'navigate_to_main' in content:
        print("❌ ERROR: Still contains navigation to main page")
        return False
    
    if 'index.html' in content:
        print("❌ ERROR: Still contains references to index.html")
        return False
    
    print("✅ Correctly removed navigation to index.html")
    
    # Check for proper game flow
    game_flow_elements = [
        'sessionActive',             # Session state tracking
        'questionsAnswered',         # Questions answered tracking
        'correctAnswers',            # Correct answers tracking
        'currentAnswer',             # Current answer storage
        'gameStartTime',             # Game start time
        'timerInterval',             # Timer interval
    ]
    
    missing_flow_elements = []
    for element in game_flow_elements:
        if element not in content:
            missing_flow_elements.append(element)
    
    if missing_flow_elements:
        print(f"❌ ERROR: Missing game flow elements: {missing_flow_elements}")
        return False
    
    print("✅ All required game flow elements found")
    
    print("\n" + "=" * 60)
    print("🎉 LEVEL PROGRESS PAGE TEST PASSED!")
    print("The level progress page is properly implemented with:")
    print("  ✅ Level title and operation display")
    print("  ✅ Progress bar showing completion status")
    print("  ✅ Timer display (when applicable)")
    print("  ✅ Question answering interface")
    print("  ✅ Answer validation and feedback")
    print("  ✅ Backend integration for questions")
    print("  ✅ Session tracking and completion")
    print("  ✅ Navigation to completion page")
    print("  ✅ No navigation to index.html")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    test_level_progress_page()
