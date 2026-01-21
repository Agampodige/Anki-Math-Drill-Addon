import json
import os
import shutil
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Union

# Set up logging
logger = logging.getLogger(__name__)

class LevelsManager:
    """
    Manages level data, progression, and completion tracking with robust data handling.
    """

    def __init__(self, addon_path: str):
        self.addon_path = addon_path
        self.data_dir = os.path.join(addon_path, "data")
        self.static_dir = os.path.join(self.data_dir, "static")
        self.user_dir = os.path.join(self.data_dir, "user")
        
        # Ensure directories exist
        os.makedirs(self.user_dir, exist_ok=True)
        
        self.level_data_path = os.path.join(self.static_dir, "level_data.json")
        self.completion_path = os.path.join(self.user_dir, "level_completion.json")
        
        self.levels_data: List[Dict] = []
        self.completions: Dict[int, Dict] = {}
        
        self._load_data()

    def _load_data(self) -> None:
        """Load all necessary data from disk."""
        self._load_level_definitions()
        self._load_user_completions()

    def _load_level_definitions(self) -> None:
        """Load static level definitions."""
        try:
            if os.path.exists(self.level_data_path):
                with open(self.level_data_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.levels_data = data.get("levels", [])
                print(f"Loaded {len(self.levels_data)} levels")
            else:
                print(f"Level data file missing: {self.level_data_path}")
                self.levels_data = []
        except Exception as e:
            print(f"Failed to load level data: {e}")
            self.levels_data = []

    def _load_user_completions(self) -> None:
        """Load user progress."""
        try:
            if os.path.exists(self.completion_path):
                with open(self.completion_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Create lookup map: levelId -> completion data
                    self.completions = {item['levelId']: item for item in data.get('completions', [])}
                print(f"Loaded {len(self.completions)} completions")
            else:
                self.completions = {}
        except Exception as e:
            print(f"Failed to load completions: {e}")
            self.completions = {}

    def _atomic_write(self, data: Dict, path: str) -> bool:
        """
        Write data to a file atomically to prevent corruption.
        Writes to a temp file first, then renames it.
        """
        temp_path = f"{path}.tmp"
        try:
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            # Atomic rename (on POSIX) / Replace (on Windows with os.replace)
            os.replace(temp_path, path)
            return True
        except Exception as e:
            print(f"Failed to write data atomically to {path}: {e}")
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
            return False

    def save_completions(self) -> bool:
        """Persist user completions to disk."""
        data = {
            "lastUpdated": datetime.now().isoformat(),
            "completions": list(self.completions.values())
        }
        return self._atomic_write(data, self.completion_path)

    def get_all_levels(self) -> List[Dict]:
        """Return all levels with their current unlock/completion status."""
        result = []
        # Calculate total stars once for unlock logic
        total_stars = sum(c.get('starsEarned', 0) for c in self.completions.values())
        
        for level in self.levels_data:
            level_info = self._enrich_level_data(level, total_stars)
            result.append(level_info)
        return result

    def get_level(self, level_id: int) -> Optional[Dict]:
        """Get a specific level by ID."""
        for level in self.levels_data:
            if level['id'] == level_id:
                total_stars = sum(c.get('starsEarned', 0) for c in self.completions.values())
                return self._enrich_level_data(level, total_stars)
        return None

    def _enrich_level_data(self, level: Dict, total_stars: int) -> Dict:
        """Add dynamic status (locked, completed, stars) to static level data."""
        level_info = level.copy()
        level_id = level['id']
        
        # Completion status
        completion = self.completions.get(level_id)
        if completion:
            level_info.update({
                'isCompleted': True,
                'starsEarned': completion.get('starsEarned', 0),
                'bestTime': completion.get('bestTime', 0),
                'bestAccuracy': completion.get('bestAccuracy', 0),
                'completionDate': completion.get('completionDate', '')
            })
        else:
            level_info.update({
                'isCompleted': False,
                'starsEarned': 0,
                'bestTime': 0,
                'bestAccuracy': 0,
                'completionDate': ''
            })
        
        # Lock status
        level_info['isLocked'] = not self._check_unlock_condition(level, total_stars)
        return level_info

    def _check_unlock_condition(self, level: Dict, total_stars: int) -> bool:
        """Determine if a level is unlocked."""
        condition = level.get('unlockCondition', 'none')
        
        if condition == 'none':
            return True
            
        # Optimization: Most common case first
        if condition.startswith('total_stars_'):
            try:
                required = int(condition.split('_')[2])
                return total_stars >= required
            except (IndexError, ValueError):
                pass
                
        # Legacy support: complete_level_X
        if condition.startswith('complete_level_'):
            try:
                parts = condition.split('_')
                # parts: ['complete', 'level', 'ID', 'total', 'stars', 'COUNT']
                req_id = int(parts[2])
                
                # Check for star count in various possible positions
                req_stars = 1
                if 'stars' in parts:
                    stars_idx = parts.index('stars')
                    if len(parts) > stars_idx + 1:
                        req_stars = int(parts[stars_idx + 1])
                elif len(parts) > 3:
                     # Attempt to find any trailing integer as stars
                     try:
                         req_stars = int(parts[-1])
                     except ValueError:
                         pass

                prev_comp = self.completions.get(req_id)
                return prev_comp and prev_comp.get('starsEarned', 0) >= req_stars
            except (ValueError, IndexError):
                pass

        return False

    def complete_level(self, level_id: int, correct_answers: int, 
                       total_questions: int, time_taken: float) -> Dict[str, Any]:
        """
        Process level completion.
        Calculates scores and persists only if the new result is 'better' 
        or if it's a first attempt (even if failed).
        """
        level = self.get_level(level_id)
        if not level:
            return {'success': False, 'error': 'Level not found'}

        # 1. Calculate Score
        stats = self._calculate_stats(level, correct_answers, total_questions, time_taken)
        
        # 2. Determine if we should save (Best Record or First Fail)
        should_save, is_new_record = self._should_save_result(level_id, stats)
        
        if should_save:
            self._save_level_result(level_id, stats, is_new_record)

        return {
            'success': stats['passed_requirements'],
            'error': stats.get('error'),
            'starsEarned': stats['stars'],
            'accuracy': stats['accuracy'],
            'timeTaken': time_taken,
            'isNewRecord': is_new_record,
            'levelName': level['name'],
            'nextLevelId': level.get('rewards', {}).get('unlocksLevel')
        }

    def _calculate_stats(self, level: Dict, correct: int, total: int, time: float) -> Dict:
        """Calculate stars, accuracy, and pass/fail status."""
        reqs = level['requirements']
        
        passed = correct >= reqs['minCorrect']
        error = None if passed else 'Not enough correct answers'
        
        accuracy = (correct / total * 100) if total > 0 else 0
        
        stars = 0
        if passed:
            stars = 1
            if accuracy >= 98:
                stars = 3
            elif accuracy >= 93:
                stars = 2
                
            if reqs['timeLimit'] and time > reqs['timeLimit']:
                stars = max(1, stars - 1)
        
        return {
            'passed_requirements': passed,
            'error': error,
            'stars': stars,
            'accuracy': accuracy,
            'time': time,
            'correct': correct,
            'total': total
        }

    def _should_save_result(self, level_id: int, new: Dict) -> tuple[bool, bool]:
        """
        Compare new stats against existing record.
        Returns: (should_save, is_new_record)
        """
        if level_id not in self.completions:
            # Always save first attempt, even if failed (0 stars)
            return True, True
            
        old = self.completions[level_id]
        old_stars = old.get('starsEarned', 0)
        old_acc = old.get('bestAccuracy', 0)
        old_time = old.get('bestTime', float('inf'))
        if old_time == 0: old_time = float('inf') # Handle legacy 0 time

        new_stars = new['stars']
        new_acc = new['accuracy']
        new_time = new['time']

        # Logic for "Better":
        # 1. More stars is always better
        # 2. Same stars: Higher accuracy is better
        # 3. Same stars & accuracy: Lower time is better
        
        is_better = False
        if new_stars > old_stars:
            is_better = True
        elif new_stars == old_stars:
            if new_acc > old_acc:
                is_better = True
            elif abs(new_acc - old_acc) < 0.01: # Float epsilon
                if new_time < old_time:
                    is_better = True
        
        # We always return "is_better" as "is_new_record" for UI flair.
        # But we ONLY save if is_better is True.
        # Exception: We do NOT overwrite a success (stars>0) with a fail (stars=0) 
        # unless we explicitly want to track "best fail" which is weird.
        # Current logic: Only strict improvements defined above.
        
        return is_better, is_better

    def _save_level_result(self, level_id: int, stats: Dict, is_new_record: bool) -> None:
        """Create completion entry and save to disk."""
        entry = {
            'levelId': level_id,
            'starsEarned': stats['stars'],
            'correctAnswers': stats['correct'],
            'totalQuestions': stats['total'],
            'bestAccuracy': stats['accuracy'],
            'bestTime': stats['time'],
            'completionDate': datetime.now().isoformat(),
            'isNewRecord': is_new_record
        }
        self.completions[level_id] = entry
        self.save_completions()

    def get_progression_stats(self) -> Dict[str, Any]:
        """Get summary stats for dashboard."""
        total_levels = len(self.levels_data)
        # Completed means at least 1 star (passed)
        completed_count = len([c for c in self.completions.values() if c.get('starsEarned', 0) > 0])
        total_stars = sum(c.get('starsEarned', 0) for c in self.completions.values())
        
        return {
            'totalLevels': total_levels,
            'completedLevels': completed_count,
            'totalStars': total_stars,
            'maxPossibleStars': total_levels * 3,
            'progressPercentage': round((completed_count / total_levels * 100) if total_levels > 0 else 0)
        }
