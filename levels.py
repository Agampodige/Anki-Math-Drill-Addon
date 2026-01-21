import json
import os
from datetime import datetime

class LevelManager:
    def __init__(self, data_dir=None):
        if data_dir is None:
            self.data_dir = os.path.join(os.path.dirname(__file__), 'data')
        else:
            self.data_dir = data_dir
            
        self.levels_file = os.path.join(self.data_dir, 'levels.json')
        self.progress_file = os.path.join(self.data_dir, 'level_progress.json')
        
        self.levels = self._load_levels()
        self.progress = self._load_progress()
        
    def _load_levels(self):
        """Load level definitions from JSON file and generate procedural ones"""
        levels = []
        
        # 1. Load static levels (1-6)
        if os.path.exists(self.levels_file):
            try:
                with open(self.levels_file, 'r', encoding='utf-8') as f:
                    levels = json.load(f)
            except Exception as e:
                print(f"Error loading levels: {e}")
        
        # 2. Procedurally generate levels 7-100
        # Determine the last used ID from static levels
        last_id = max([l['id'] for l in levels]) if levels else 0
        
        operations = ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Mixed']
        
        for lvl_num in range(last_id + 1, 101):
            # Calculate difficulty parameters based on level number
            # Cycle through operations
            op_idx = (lvl_num - 1) % len(operations)
            operation = operations[op_idx]
            
            # Digits increase every 20 levels roughly
            digits = 1 + (lvl_num // 20)
            if digits > 4: digits = 4
            
            # Questions increase slightly
            questions = 10 + (lvl_num // 10) * 2
            if questions > 30: questions = 30
            
            # Time limit (optional, harder levels might have it)
            time_limit = 0
            if lvl_num % 5 == 0:  # Every 5th level is a speed challenge
                time_limit = int(questions * 4.0) # 4 seconds per question
            
            # Star Requirements to unlock this level
            # Strategy: User needs approx 70% of total possible stars from previous levels
            # Each previous level gives max 3 stars.
            # safe calculation: (lvl_num - 1) * 2
            required_stars = (lvl_num - 1) * 2
            
            title = f"Level {lvl_num}"
            if lvl_num % 10 == 0:
                title = f"Mastery Challenge {lvl_num}"
            elif lvl_num % 5 == 0:
                title = f"Speed Run {lvl_num}"
                
            desc = f"{operation} practice with {digits} digit{'s' if digits > 1 else ''}."
            
            level = {
                "id": lvl_num,
                "title": title,
                "description": desc,
                "operation": operation,
                "digits": digits,
                "required_stars": required_stars,
                "criteria": {
                    "questions": questions,
                    "time_limit": time_limit,
                    "min_accuracy": 80,
                    "max_time_per_question": 0
                },
                "stars_criteria": {
                    "3": {
                        "min_accuracy": 100,
                        "max_time": int(questions * 3.0) if time_limit > 0 else 0
                    },
                    "2": {
                        "min_accuracy": 90,
                        "max_time": 0
                    },
                    "1": {
                        "min_accuracy": 80,
                        "max_time": 0
                    }
                }
            }
            levels.append(level)
            
        return levels
            
    def _load_progress(self):
        """Load user progress from JSON file"""
        if not os.path.exists(self.progress_file):
            return {"unlocked": [1], "completed": {}}  # Level 1 unlocked by default
        try:
            with open(self.progress_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if "unlocked" not in data: data["unlocked"] = [1]
                if "completed" not in data: data["completed"] = {}
                return data
        except Exception as e:
            print(f"Error loading progress: {e}")
            return {"unlocked": [1], "completed": {}}
            
    def _save_progress(self):
        """Save user progress to JSON file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.progress_file), exist_ok=True)
            with open(self.progress_file, 'w', encoding='utf-8') as f:
                json.dump(self.progress, f, indent=2)
        except Exception as e:
            print(f"Error saving progress: {e}")
            
    def get_total_stars(self):
        """Calculate total stars earned across all levels"""
        total = 0
        for lvl_id, data in self.progress['completed'].items():
            total += data.get('stars', 0)
        return total
            
    def get_all_levels(self):
        """Get all levels with calculated status based on stars"""
        result = []
        total_stars = self.get_total_stars()
        
        for level in self.levels:
            lvl_id = level['id']
            status = 'locked'
            stars = 0
            
            # Check completion status
            str_id = str(lvl_id)
            if str_id in self.progress['completed']:
                status = 'completed'
                stars = self.progress['completed'][str_id].get('stars', 0)
            
            # Check lock status
            # Level 1 is always unlocked
            elif lvl_id == 1:
                status = 'unlocked'
            # Check calculated unlock
            elif level.get('required_stars', 0) <= total_stars:
                status = 'unlocked'
            # Legacy/Manual unlock check backup
            elif lvl_id in self.progress.get('unlocked', []):
                status = 'unlocked'
                
            level_copy = level.copy()
            level_copy['status'] = status
            level_copy['stars'] = stars
            # Ensure required_stars is sent to frontend
            if 'required_stars' not in level_copy:
                level_copy['required_stars'] = 0
                
            result.append(level_copy)
            
        return result
        
    def get_level_by_id(self, level_id):
        """Get a specific level definition"""
        for level in self.levels:
            if level['id'] == level_id:
                return level
        return None
        
    def complete_level(self, level_id, session_stats):
        """
        Check if level criteria met and update progress
        session_stats: {questions_answered, accuracy, total_time, ...}
        """
        level = self.get_level_by_id(level_id)
        if not level:
            return {'success': False, 'message': 'Level not found'}
            
        criteria = level['criteria']
        
        # Check if failed criteria
        if session_stats['questions'] < criteria['questions']:
             # Special case: allow finishing if they did ALMOST all? No, strict for levels.
            return {'success': False, 'message': 'Not enough questions completed'}
            
        if session_stats['accuracy'] < criteria['min_accuracy']:
            return {'success': False, 'message': f"Accuracy too low (Need {criteria['min_accuracy']}%)"}
            
        if criteria['time_limit'] > 0 and session_stats['total_time'] > criteria['time_limit']:
             return {'success': False, 'message': f"Time limit exceeded (Max {criteria['time_limit']}s)"}
             
        # Level Passed! Calculate Stars
        stars = 1
        stars_criteria = level.get('stars_criteria', {})
        
        # Check for 3 stars
        c3 = stars_criteria.get('3', {})
        if (session_stats['accuracy'] >= c3.get('min_accuracy', 0) and 
            (c3.get('max_time', 0) == 0 or session_stats['total_time'] <= c3.get('max_time', 0))):
            stars = 3
        # Check for 2 stars
        elif (session_stats['accuracy'] >= stars_criteria.get('2', {}).get('min_accuracy', 0) and
              (stars_criteria.get('2', {}).get('max_time', 0) == 0 or session_stats['total_time'] <= stars_criteria.get('2', {}).get('max_time', 0))):
            stars = 2
            
        # Update Progress
        str_id = str(level_id)
        
        # Only update if new score is better (more stars)
        current_stars = 0
        if str_id in self.progress['completed']:
            current_stars = self.progress['completed'][str_id].get('stars', 0)
            
        if stars > current_stars:
            self.progress['completed'][str_id] = {
                'stars': stars,
                'timestamp': datetime.now().isoformat()
            }
            
        # We don't need to explicitly unlock next ID anymore, 
        # as it is calculated based on total stars.
        # But we verify if the next level WOULD be unlocked now
        
        self._save_progress()
        
        # Calculate next unlock just for UI feedback
        total_stars = self.get_total_stars()
        next_level = self.get_level_by_id(level_id + 1)
        next_unlocked = False
        if next_level:
            if next_level.get('required_stars', 0) <= total_stars:
                next_unlocked = True
        
        return {
            'success': True,
            'stars': stars,
            'message': 'Level Completed!',
            'next_unlocked': next_unlocked
        }
