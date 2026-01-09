import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any


class LevelsManager:
    """Manages level data, progression, and completion tracking"""

    def __init__(self, addon_path: str):
        self.addon_path = addon_path
        self.data_dir = os.path.join(addon_path, "data")
        self.static_dir = os.path.join(self.data_dir, "static")
        self.user_dir = os.path.join(self.data_dir, "user")
        
        # Create directories if they don't exist
        os.makedirs(self.user_dir, exist_ok=True)
        
        self.level_data_path = os.path.join(self.static_dir, "level_data.json")
        self.completion_path = os.path.join(self.user_dir, "level_completion.json")
        
        self.levels_data: List[Dict] = []
        self.completions: Dict[int, Dict] = {}
        
        self.load_level_data()
        self.load_completions()

    def load_level_data(self) -> None:
        """Load level definitions from JSON"""
        try:
            if os.path.exists(self.level_data_path):
                with open(self.level_data_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.levels_data = data.get("levels", [])
                print(f"✓ Loaded {len(self.levels_data)} levels from {self.level_data_path}")
            else:
                print(f"✗ Level data file not found: {self.level_data_path}")
                self.levels_data = []
        except Exception as e:
            print(f"✗ Error loading level data: {e}")
            self.levels_data = []

    def load_completions(self) -> None:
        """Load user's level completion data"""
        try:
            if os.path.exists(self.completion_path):
                with open(self.completion_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Index by level ID for quick lookup
                    self.completions = {item['levelId']: item for item in data.get('completions', [])}
                print(f"✓ Loaded {len(self.completions)} level completions")
            else:
                print(f"  No completion data yet: {self.completion_path}")
                self.completions = {}
        except Exception as e:
            print(f"✗ Error loading completions: {e}")
            self.completions = {}

    def save_completions(self) -> None:
        """Save completion data to JSON"""
        try:
            os.makedirs(os.path.dirname(self.completion_path), exist_ok=True)
            data = {
                "lastUpdated": datetime.now().isoformat(),
                "completions": list(self.completions.values())
            }
            with open(self.completion_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving completions: {e}")

    def get_all_levels(self) -> List[Dict]:
        """Get all levels with unlock and completion status"""
        result = []
        for level in self.levels_data:
            level_info = level.copy()
            level_id = level['id']
            
            # Add completion status
            if level_id in self.completions:
                completion = self.completions[level_id]
                level_info['isCompleted'] = True
                level_info['starsEarned'] = completion.get('starsEarned', 0)
                level_info['bestTime'] = completion.get('bestTime', 0)
                level_info['bestAccuracy'] = completion.get('bestAccuracy', 0)
                level_info['completionDate'] = completion.get('completionDate', '')
            else:
                level_info['isCompleted'] = False
                level_info['starsEarned'] = 0
                level_info['bestTime'] = 0
                level_info['bestAccuracy'] = 0
                level_info['completionDate'] = ''
            
            # Determine if level is unlocked
            level_info['isLocked'] = not self._is_level_unlocked(level)
            
            result.append(level_info)
        
        return result

    def get_level(self, level_id: int) -> Optional[Dict]:
        """Get a specific level"""
        for level in self.levels_data:
            if level['id'] == level_id:
                level_info = level.copy()
                
                if level_id in self.completions:
                    completion = self.completions[level_id]
                    level_info['isCompleted'] = True
                    level_info['starsEarned'] = completion.get('starsEarned', 0)
                else:
                    level_info['isCompleted'] = False
                    level_info['starsEarned'] = 0
                
                level_info['isLocked'] = not self._is_level_unlocked(level)
                return level_info
        
        return None

    def _is_level_unlocked(self, level: Dict) -> bool:
        """Check if a level is unlocked based on unlock condition"""
        unlock_condition = level.get('unlockCondition', 'none')
        
        if unlock_condition == 'none':
            return True
        
        # Parse unlock condition (e.g., "complete_level_1_with_1_star")
        if unlock_condition.startswith('complete_level_'):
            parts = unlock_condition.split('_')
            try:
                required_level_id = int(parts[2])
                required_stars = int(parts[4]) if len(parts) > 4 else 1
                
                if required_level_id in self.completions:
                    completion = self.completions[required_level_id]
                    return completion.get('starsEarned', 0) >= required_stars
            except (IndexError, ValueError):
                pass
        
        # Parse "collect_X_stars_from_levels_1_to_Y"
        elif unlock_condition.startswith('collect_'):
            parts = unlock_condition.split('_')
            try:
                required_stars = int(parts[1])
                start_level = int(parts[5])
                end_level = int(parts[7])
                
                total_stars = 0
                for level_id in range(start_level, end_level + 1):
                    if level_id in self.completions:
                        total_stars += self.completions[level_id].get('starsEarned', 0)
                
                return total_stars >= required_stars
            except (IndexError, ValueError):
                pass
        
        return False

    def complete_level(self, level_id: int, correct_answers: int, 
                      total_questions: int, time_taken: float) -> Dict[str, Any]:
        """
        Complete a level and calculate stars earned
        
        Args:
            level_id: The level ID
            correct_answers: Number of correct answers
            total_questions: Total questions in the level
            time_taken: Time taken in seconds (excluding UI delays)
        
        Returns:
            Dictionary with stars earned and level completion info
        """
        level = self.get_level(level_id)
        if not level:
            return {'success': False, 'error': 'Level not found'}
        
        requirements = level['requirements']
        
        # Check if minimum requirements are met
        if correct_answers < requirements['minCorrect']:
            return {
                'success': False,
                'error': 'Not enough correct answers',
                'starsEarned': 0,
                'correctAnswers': correct_answers,
                'required': requirements['minCorrect']
            }
        
        # Calculate accuracy
        accuracy = (correct_answers / total_questions) * 100
        
        # Calculate stars (1-3)
        stars = 1
        
        if accuracy >= 95:
            stars = 3
        elif accuracy >= 85:
            stars = 2
        
        # Check time constraint if applicable
        if requirements['timeLimit']:
            if time_taken > requirements['timeLimit']:
                # Still complete but reduce stars
                stars = max(1, stars - 1)
        
        # Check if this is a new record
        is_new_record = True
        if level_id in self.completions:
            previous = self.completions[level_id]
            is_new_record = stars > previous.get('starsEarned', 0)
        
        # Save completion
        completion_data = {
            'levelId': level_id,
            'starsEarned': stars,
            'correctAnswers': correct_answers,
            'totalQuestions': total_questions,
            'bestAccuracy': accuracy,
            'bestTime': time_taken,
            'completionDate': datetime.now().isoformat(),
            'isNewRecord': is_new_record
        }
        
        self.completions[level_id] = completion_data
        self.save_completions()
        
        return {
            'success': True,
            'starsEarned': stars,
            'accuracy': accuracy,
            'timeTaken': time_taken,
            'isNewRecord': is_new_record,
            'levelName': level['name'],
            'nextLevelId': level.get('rewards', {}).get('unlocksLevel')
        }

    def get_progression_stats(self) -> Dict[str, Any]:
        """Get overall progression statistics"""
        total_levels = len(self.levels_data)
        completed_levels = len([c for c in self.completions.values() if c.get('starsEarned', 0) > 0])
        total_stars = sum(c.get('starsEarned', 0) for c in self.completions.values())
        
        return {
            'totalLevels': total_levels,
            'completedLevels': completed_levels,
            'totalStars': total_stars,
            'maxPossibleStars': total_levels * 3,
            'progressPercentage': (completed_levels / total_levels * 100) if total_levels > 0 else 0
        }

    def get_unlocked_levels_count(self) -> int:
        """Get count of unlocked levels"""
        return sum(1 for level in self.levels_data if self._is_level_unlocked(level))
