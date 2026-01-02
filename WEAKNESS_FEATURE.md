# Weakness Tracking Feature

## Overview
This feature adds intelligent weakness tracking to the Math Drill application, allowing it to identify areas where the user struggles and provide targeted practice until mastery.

## How It Works

### 1. Weakness Detection
- Tracks performance for each combination of operation (Addition, Subtraction, Multiplication, Division) and digit level (1, 2, 3 digits)
- Calculates a weakness score based on recent performance (last 10 attempts)
- Assigns mastery levels: Novice, Apprentice, Pro, Master

### 2. Adaptive Coach Mode
The "Adaptive Coach" mode now:
- Identifies the weakest area that needs improvement
- Focuses on that area until the user shows improvement
- Provides continuous targeted practice
- Shows progress and coaching messages

### 3. Weakness Analysis Dialog
- Press **W** or click the **🎯 Weakness** button to view current weaknesses
- Shows all areas that need work, ordered by priority
- Displays mastery level, current streak, and weakness score
- Color-coded by severity (red = critical, orange = needs work, yellow = minor)

## Database Schema

### weakness_tracking table
- `operation`: Math operation type
- `digits`: Number of digits (1, 2, or 3)
- `weakness_score`: Score from 0-100 (higher = weaker)
- `consecutive_correct`: Current streak of correct answers
- `last_practiced`: Date last practiced
- `mastery_level`: Current skill level

## Weakness Score Calculation

- **Novice** (< 3 attempts or accuracy < 60%): Score 80
- **Apprentice** (60-80% accuracy): Score 60
- **Pro** (80-90% accuracy): Score 30  
- **Master** (90%+ accuracy and fast speed): Score 10

## Usage

1. **Practice normally** - The system automatically tracks your performance
2. **Use Adaptive Coach mode** - Get targeted practice on weak areas
3. **Check Weakness dialog** - Press **W** to see what needs work
4. **Focus on improvement** - The coach will guide you to mastery

## Integration Points

- `database.py`: New weakness tracking functions
- `coach.py`: Enhanced SmartCoach with weakness focus
- `main.py`: UI integration and adaptive question generation

## Benefits

- **Efficient Learning**: Focus practice time where it's needed most
- **Continuous Improvement**: Tracks progress and adjusts difficulty
- **Motivation**: Clear path from weakness to mastery
- **Personalized Experience**: Adapts to individual skill patterns

## Keyboard Shortcuts

- **W**: Open Weakness Analysis dialog
- **M**: Toggle mode (including Adaptive Coach)
- **P**: Progress/Mastery dialog
- **A**: Achievements
- **S**: Settings
