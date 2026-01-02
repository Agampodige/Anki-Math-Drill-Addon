try:
    from .database import get_performance_breakdown, get_weakest_area, get_weakness_areas
except ImportError:
    from database import get_performance_breakdown, get_weakest_area, get_weakness_areas
import random
from datetime import datetime, timedelta
import math

class SmartCoach:
    def __init__(self):
        self.knowledge_map = {}  # Key: (Op, Digits) -> {acc, speed, count, level}
        self.user_level = 1  # Overall user level (1-10)
        self.spaced_repetition_map = {}  # For tracking when to review skills
        self.learning_path = []  # Suggested learning sequence
        
    def analyze(self):
        """Comprehensive analysis of user performance"""
        # Get weakness tracking data directly instead of performance breakdown
        try:
            from .database import get_weakness_areas
        except ImportError:
            from database import get_weakness_areas
            
        weakness_data = get_weakness_areas()
        
        # Calculate overall user level based on weakness data
        total_score = 0
        skill_count = 0
        
        for weakness in weakness_data:
            op = weakness['operation']
            digits = weakness['digits']
            
            # Convert weakness score to skill score (inverse relationship)
            skill_score = 100 - weakness['weakness_score']
            
            # Estimate accuracy and speed from weakness data
            # Since we don't have detailed data, use reasonable estimates
            if skill_score >= 90:
                accuracy = 95
                speed = 3.0 if digits == 1 else (5.0 if digits == 2 else 8.0)
                level = "Master"
            elif skill_score >= 80:
                accuracy = 90
                speed = 4.0 if digits == 1 else (6.0 if digits == 2 else 10.0)
                level = "Proficient"
            elif skill_score >= 70:
                accuracy = 85
                speed = 5.0 if digits == 1 else (7.0 if digits == 2 else 12.0)
                level = "Competent"
            elif skill_score >= 50:
                accuracy = 75
                speed = 6.0 if digits == 1 else (8.0 if digits == 2 else 15.0)
                level = "Learning"
            else:
                accuracy = 60
                speed = 8.0 if digits == 1 else (10.0 if digits == 2 else 20.0)
                level = "Struggling"
            
            self.knowledge_map[(op, digits)] = {
                'acc': accuracy,
                'speed': speed,
                'count': weakness.get('consecutive_correct', 0) + 5,  # Estimate practice count
                'level': level,
                'score': skill_score,
                'next_review': None,  # Will be calculated below
                'last_practiced': datetime.now().date()
            }
            
            total_score += skill_score
            skill_count += 1
        
        # Calculate overall user level
        if skill_count > 0:
            self.user_level = min(10, max(1, int(total_score / skill_count / 10)))
        else:
            self.user_level = 1
        
        # Update learning path
        self.update_learning_path()
        
    def update_learning_path(self):
        """Create or update personalized learning path"""
        # Suggested progression: Addition → Subtraction → Multiplication → Division
        # Within each operation: 1-digit → 2-digit → 3-digit
        operations_order = ["Addition", "Subtraction", "Multiplication", "Division"]
        digits_order = [1, 2, 3]
        
        self.learning_path = []
        
        for op in operations_order:
            for d in digits_order:
                key = (op, d)
                if key in self.knowledge_map:
                    skill = self.knowledge_map[key]
                    # Prioritize skills that need attention
                    priority = 100 - skill['score']  # Lower score = higher priority
                    
                    # Add urgency bonus for overdue reviews
                    if skill['next_review'] and skill['next_review'] < datetime.now():
                        priority += 50
                    
                    # Add time decay: skills not practiced recently get higher priority
                    if 'last_practiced' in skill:
                        days_since = (datetime.now().date() - skill['last_practiced']).days
                        priority += min(30, days_since * 2)
                    
                    self.learning_path.append({
                        'operation': op,
                        'digits': d,
                        'priority': priority,
                        'current_score': skill['score'],
                        'level': skill['level']
                    })
        
        # Sort by priority (highest first)
        self.learning_path.sort(key=lambda x: x['priority'], reverse=True)
        
        # If learning path is empty, add default starting points
        if not self.learning_path:
            self.learning_path = [
                {'operation': 'Addition', 'digits': 1, 'priority': 100, 'current_score': 0, 'level': 'New'},
                {'operation': 'Subtraction', 'digits': 1, 'priority': 90, 'current_score': 0, 'level': 'New'},
                {'operation': 'Multiplication', 'digits': 1, 'priority': 80, 'current_score': 0, 'level': 'New'},
            ]
            
    def get_recommendation(self, consideration_count=5):
        """Get personalized practice recommendation with explanation"""
        self.analyze()
        
        # Check for immediate needs
        immediate_needs = []
        for skill in self.learning_path:
            key = (skill['operation'], skill['digits'])
            if key in self.knowledge_map:
                skill_data = self.knowledge_map[key]
                if skill_data['score'] < 40:  # Critical need
                    immediate_needs.append(skill)
        
        if immediate_needs:
            # Pick the most critical need
            target = min(immediate_needs, key=lambda x: x['current_score'])
            return (target['operation'], target['digits']), f"🔥 CRITICAL: Your {target['operation']} ({target['digits']}-digit) needs immediate attention!"
        
        # Check for spaced repetition reviews that are overdue
        overdue_reviews = []
        for skill in self.learning_path:
            key = (skill['operation'], skill['digits'])
            if key in self.knowledge_map:
                skill_data = self.knowledge_map[key]
                if (skill_data.get('next_review') and 
                    skill_data['next_review'] < datetime.now() and
                    skill_data['score'] > 70):  # Only review if previously mastered
                    overdue_reviews.append(skill)
        
        if overdue_reviews:
            # Pick the most overdue review
            target = overdue_reviews[0]
            days_overdue = (datetime.now() - self.knowledge_map[(target['operation'], target['digits'])]['next_review']).days
            return (target['operation'], target['digits']), f"📅 REVIEW: Time to refresh {target['operation']} ({target['digits']}-digit), {days_overdue} days overdue"
        
        # Consider top N skills for balanced recommendation
        consideration_set = self.learning_path[:consideration_count]
        
        # Add some randomness but weighted by priority
        weights = [skill['priority'] ** 2 for skill in consideration_set]  # Square to emphasize differences
        
        if not weights:
            return ("Addition", 1), "Let's get started with basic addition!"
        
        target = random.choices(consideration_set, weights=weights)[0]
        
        # Generate personalized message based on level
        if target['level'] == "New":
            reason = f"🧠 NEW SKILL: Let's learn {target['operation']} with {target['digits']}-digit numbers"
        elif target['level'] == "Struggling":
            reason = f"💪 BUILD CONFIDENCE: Practice {target['operation']} ({target['digits']}-digit) to improve from struggling"
        elif target['level'] == "Learning":
            reason = f"📚 SOLIDIFY: Strengthen your {target['operation']} ({target['digits']}-digit) foundation"
        elif target['level'] == "Competent":
            reason = f"⚡ BUILD SPEED: Speed up your {target['operation']} ({target['digits']}-digit) calculations"
        elif target['level'] == "Proficient":
            reason = f"🎯 REACH MASTERY: Refine your {target['operation']} ({target['digits']}-digit) skills"
        else:
            reason = f"🏆 MAINTAIN: Keep your {target['operation']} ({target['digits']}-digit) mastery sharp"
        
        return (target['operation'], target['digits']), reason
    
    def get_weakness_focus_areas(self, limit=None):
        """Get detailed weakness analysis with improvement suggestions for ALL categories"""
        self.analyze()
        
        weaknesses = []
        operations_order = ["Addition", "Subtraction", "Multiplication", "Division"]
        
        for op in operations_order:
            for d in [1, 2, 3]:
                key = (op, d)
                if key in self.knowledge_map:
                    skill = self.knowledge_map[key]
                    
                    # Calculate improvement suggestions
                    suggestions = []
                    
                    if skill['acc'] < 80:
                        suggestions.append("Focus on accuracy - aim for 90%+")
                    elif skill['acc'] < 90:
                        suggestions.append("Good accuracy, now work on consistency")
                    
                    # Speed benchmarks based on digits
                    speed_targets = {1: 3.0, 2: 5.0, 3: 8.0}
                    if skill['speed'] > speed_targets.get(d, 5.0) * 1.5:
                        suggestions.append(f"Too slow - target speed: {speed_targets[d]:.1f}s")
                    elif skill['speed'] > speed_targets.get(d, 5.0):
                        suggestions.append(f"Speed is good, aim for {speed_targets[d]:.1f}s")
                    
                    if skill['count'] < 10:
                        suggestions.append("Need more practice - do at least 10 problems")
                    
                    weaknesses.append({
                        'operation': op,
                        'digits': d,
                        'weakness_score': 100 - skill['score'],
                        'accuracy': skill['acc'],
                        'speed': skill['speed'],
                        'count': skill['count'],
                        'level': skill['level'],
                        'consecutive_correct': 0,  # Would need tracking in database
                        'suggestions': suggestions[:2],  # Limit to 2 suggestions
                        'practiced': True
                    })
                else:
                    # Category not practiced yet
                    weaknesses.append({
                        'operation': op,
                        'digits': d,
                        'weakness_score': 50,  # Medium priority for unpracticed categories
                        'accuracy': 0,
                        'speed': 0,
                        'count': 0,
                        'level': 'Not Started',
                        'consecutive_correct': 0,
                        'suggestions': ['Start practicing this category', 'Try basic problems first'],
                        'practiced': False
                    })
        
        # Sort by weakness score (unpracticed categories in middle, high weaknesses first)
        weaknesses.sort(key=lambda x: (not x['practiced'], x['weakness_score']), reverse=True)
        
        if limit:
            return weaknesses[:limit]
        return weaknesses
        
    def should_continue_focus(self, operation, digits, questions_so_far=0):
        """Determine if we should continue focusing on current skill"""
        self.analyze()
        
        key = (operation, digits)
        if key not in self.knowledge_map:
            return True  # Continue if it's a new skill
        
        skill = self.knowledge_map[key]
        
        # Continue if:
        # 1. Skill is still struggling (< 60 score)
        # 2. Haven't done enough questions yet (minimum 5)
        # 3. Accuracy is below 80%
        
        continue_focus = (
            skill['score'] < 60 or 
            questions_so_far < 5 or
            skill['acc'] < 80
        )
        
        # But don't continue too long - max 15 questions per focus session
        if questions_so_far >= 15:
            return False
            
        return continue_focus
    
    def get_mastery_grid_data(self):
        """Enhanced mastery grid with more detailed data"""
        self.analyze()
        return self.knowledge_map
    
    def get_progress_report(self):
        """Generate a comprehensive progress report"""
        self.analyze()
        
        total_skills = len(self.knowledge_map)
        mastered_skills = sum(1 for s in self.knowledge_map.values() if s['score'] >= 90)
        struggling_skills = sum(1 for s in self.knowledge_map.values() if s['score'] < 60)
        
        # Calculate average improvement
        improvements = []
        for skill in self.knowledge_map.values():
            # This would need historical data - for now use current score
            improvements.append(skill['score'])
        
        avg_score = sum(improvements) / len(improvements) if improvements else 0
        
        # Identify strongest and weakest areas
        if self.knowledge_map:
            strongest = max(self.knowledge_map.items(), key=lambda x: x[1]['score'])
            weakest = min(self.knowledge_map.items(), key=lambda x: x[1]['score'])
        else:
            strongest = weakest = None
        
        return {
            'user_level': self.user_level,
            'total_skills_practiced': total_skills,
            'mastered_skills': mastered_skills,
            'struggling_skills': struggling_skills,
            'average_score': avg_score,
            'strongest_area': strongest,
            'weakest_area': weakest,
            'next_milestone': self.get_next_milestone()
        }
    
    def get_next_milestone(self):
        """Suggest next learning milestone"""
        self.analyze()
        
        # Check if user is ready for next digit level
        for op in ["Addition", "Subtraction", "Multiplication", "Division"]:
            for current_digits in [1, 2]:
                next_digits = current_digits + 1
                current_key = (op, current_digits)
                next_key = (op, next_digits)
                
                if (current_key in self.knowledge_map and 
                    self.knowledge_map[current_key]['score'] >= 85 and
                    next_key not in self.knowledge_map):
                    return f"Advance to {op} with {next_digits}-digit numbers"
        
        # Check for operation progression
        operations = ["Addition", "Subtraction", "Multiplication", "Division"]
        for i in range(len(operations) - 1):
            current_op = operations[i]
            next_op = operations[i + 1]
            
            # Check if current operation at 1-digit is good enough
            current_key = (current_op, 1)
            if (current_key in self.knowledge_map and 
                self.knowledge_map[current_key]['score'] >= 80):
                # Check if next operation needs work
                next_key = (next_op, 1)
                if next_key not in self.knowledge_map or self.knowledge_map[next_key]['score'] < 70:
                    return f"Start learning {next_op} with 1-digit numbers"
        
        return "Master your current skills before advancing"
    
    def get_practice_plan(self, duration_minutes=10):
        """Generate a practice plan for a specific duration"""
        self.analyze()
        self.update_learning_path()
        
        # Estimate questions per minute based on user level
        questions_per_minute = 2 + (self.user_level * 0.5)
        target_questions = int(duration_minutes * questions_per_minute)
        
        plan = []
        time_remaining = duration_minutes * 60  # in seconds
        
        for skill in self.learning_path:
            if time_remaining <= 0 or len(plan) >= target_questions:
                break
            
            # Estimate time for this skill type
            avg_time = self.knowledge_map.get((skill['operation'], skill['digits']), {}).get('speed', 5.0)
            questions_for_skill = min(10, int(time_remaining / avg_time))
            
            if questions_for_skill >= 3:  # At least 3 questions to be meaningful
                plan.append({
                    'operation': skill['operation'],
                    'digits': skill['digits'],
                    'questions': questions_for_skill,
                    'focus': "Accuracy" if skill['current_score'] < 70 else "Speed",
                    'estimated_time': questions_for_skill * avg_time
                })
                time_remaining -= questions_for_skill * avg_time
        
        return {
            'total_duration': duration_minutes,
            'target_questions': target_questions,
            'estimated_completion': (duration_minutes * 60 - time_remaining) / 60,
            'plan': plan
        }

    def get_motivational_message(self):
        """Get motivational message based on user progress"""
        self.analyze()
        
        total_attempts = sum(skill['count'] for skill in self.knowledge_map.values())
        mastered_count = sum(1 for skill in self.knowledge_map.values() if skill['score'] >= 90)
        
        if total_attempts == 0:
            return "🎯 Ready to begin your math journey? Let's start with addition!"
        
        if mastered_count >= 5:
            return "🌟 You're a math superstar! Keep pushing your limits!"
        
        if self.user_level >= 7:
            return "🚀 Amazing progress! You're reaching advanced levels!"
        
        if total_attempts > 100:
            return "💪 Consistency is key! Your daily practice is paying off!"
        
        # Random motivational quotes
        quotes = [
            "Every expert was once a beginner. Keep practicing!",
            "Math is not about speed, it's about understanding.",
            "Mistakes are proof that you're trying.",
            "The only way to learn math is to do math.",
            "You're getting better with every problem!"
        ]
        
        return random.choice(quotes)