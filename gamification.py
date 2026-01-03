try:
    from .database import (unlock_achievement, get_unlocked_achievements, get_total_attempts_count,
                           get_operation_stats, get_digit_stats, get_session_count_by_mode,
                           get_unique_play_days, get_total_practice_time, get_sessions_by_time_of_day,
                           get_weekend_sessions, get_perfectionist_sessions)
except ImportError:
    from database import (unlock_achievement, get_unlocked_achievements, get_total_attempts_count,
                          get_operation_stats, get_digit_stats, get_session_count_by_mode,
                          get_unique_play_days, get_total_practice_time, get_sessions_by_time_of_day,
                          get_weekend_sessions, get_perfectionist_sessions)

class AchievementManager:
    # Define Badges
    BADGES = {
        # Basic Progress Achievements
        'first_win': {'name': 'First Steps', 'desc': 'Complete your first session'},
        'novice': {'name': 'Novice', 'desc': 'Complete 10 questions total'},
        'apprentice': {'name': 'Apprentice', 'desc': 'Complete 25 questions total'},
        'centurion': {'name': 'Centurion', 'desc': 'Complete 100 questions total'},
        'veteran': {'name': 'Veteran', 'desc': 'Complete 500 questions total'},
        'legend': {'name': 'Legend', 'desc': 'Complete 1000 questions total'},
        
        # Accuracy Achievements
        'sniper': {'name': 'Sniper', 'desc': '100% Accuracy in a Drill (20+ Qs)'},
        'sharpshooter': {'name': 'Sharpshooter', 'desc': '95% Accuracy in a Drill (30+ Qs)'},
        'marksman': {'name': 'Marksman', 'desc': '90% Accuracy in a Drill (40+ Qs)'},
        'perfectionist': {'name': 'Perfectionist', 'desc': '100% Accuracy in 3 separate sessions'},
        
        # Speed Achievements
        'speed_demon': {'name': 'Speed Demon', 'desc': 'Avg Speed < 2.0s in a Drill/Sprint (20+ Qs)'},
        'lightning': {'name': 'Lightning Fast', 'desc': 'Avg Speed < 1.5s in a Drill/Sprint (20+ Qs)'},
        'flash': {'name': 'Flash', 'desc': 'Avg Speed < 1.0s in a Drill/Sprint (10+ Qs)'},
        'quicksilver': {'name': 'Quicksilver', 'desc': 'Answer 10 questions under 1s each'},
        
        # Session Length Achievements
        'marathon': {'name': 'Marathoner', 'desc': 'Complete a session with 50+ Questions'},
        'ultra_marathon': {'name': 'Ultra Marathoner', 'desc': 'Complete a session with 100+ Questions'},
        'ironman': {'name': 'Ironman', 'desc': 'Complete a session with 200+ Questions'},
        
        # Streak Achievements
        'streak_5': {'name': 'On Fire', 'desc': 'Achieve a 5-question streak'},
        'streak_10': {'name': 'Blazing', 'desc': 'Achieve a 10-question streak'},
        'streak_25': {'name': 'Inferno', 'desc': 'Achieve a 25-question streak'},
        'streak_50': {'name': 'Volcano', 'desc': 'Achieve a 50-question streak'},
        
        # Operation Specific Achievements
        'addition_master': {'name': 'Addition Master', 'desc': 'Complete 50 addition questions with 90%+ accuracy'},
        'subtraction_master': {'name': 'Subtraction Master', 'desc': 'Complete 50 subtraction questions with 90%+ accuracy'},
        'multiplication_master': {'name': 'Multiplication Master', 'desc': 'Complete 50 multiplication questions with 90%+ accuracy'},
        'division_master': {'name': 'Division Master', 'desc': 'Complete 50 division questions with 90%+ accuracy'},
        
        # Difficulty Achievements
        'digit_expert': {'name': 'Digit Expert', 'desc': 'Complete 30 questions with 3-digit numbers'},
        'speed_digit': {'name': 'Speed Digits', 'desc': 'Complete 20 3-digit questions under 3s each'},
        'precision_digit': {'name': 'Precision Digits', 'desc': '95% accuracy with 3-digit numbers (20+ Qs)'},
        
        # Mode Specific Achievements
        'drill_sergeant': {'name': 'Drill Sergeant', 'desc': 'Complete 10 Drill mode sessions'},
        'sprint_champion': {'name': 'Sprint Champion', 'desc': 'Complete 5 Sprint mode sessions'},
        'coach_student': {'name': 'Coach\'s Pet', 'desc': 'Complete 10 Adaptive Coach sessions'},
        'master_mind': {'name': 'Master Mind', 'desc': 'Complete a Mixed Mode session with >90% Acc'},
        
        # Consistency Achievements
        'daily_player': {'name': 'Daily Player', 'desc': 'Play on 3 different days'},
        'weekly_warrior': {'name': 'Weekly Warrior', 'desc': 'Play on 7 different days'},
        'monthly_master': {'name': 'Monthly Master', 'desc': 'Play for 30 consecutive days'},
        
        # Special Achievements
        'early_bird': {'name': 'Early Bird', 'desc': 'Complete a session before 9 AM'},
        'night_owl': {'name': 'Night Owl', 'desc': 'Complete a session after 9 PM'},
        'weekend_warrior': {'name': 'Weekend Warrior', 'desc': 'Complete 5 sessions on weekends'},
        
        # Challenge Achievements
        'no_mistakes': {'name': 'Flawless', 'desc': 'Complete a session with zero mistakes'},
        'comeback_kid': {'name': 'Comeback Kid', 'desc': 'Get 80% accuracy after 5 mistakes'},
        'retake_master': {'name': 'Retake Master', 'desc': 'Successfully complete all retake questions'},
        
        # Total Time Achievements
        'time_master': {'name': 'Time Master', 'desc': 'Practice for 60 total minutes'},
        'time_veteran': {'name': 'Time Veteran', 'desc': 'Practice for 180 total minutes'},
        'time_legend': {'name': 'Time Legend', 'desc': 'Practice for 300 total minutes'},
    }

    def __init__(self):
        self.unlocked = get_unlocked_achievements()

    def check_achievements(self, session_data):
        # session_data: {'mode', 'total', 'correct', 'avg_speed', 'total_time', 'mistakes', 'operation', 'digits', 'max_streak'}
        newly_unlocked = []
        
        # Basic Progress Achievements (based on total attempts)
        total_attempts = get_total_attempts_count()
        if total_attempts >= 1 and self._try_unlock('first_win'):
            newly_unlocked.append(self.BADGES['first_win'])
        if total_attempts >= 10 and self._try_unlock('novice'):
            newly_unlocked.append(self.BADGES['novice'])
        if total_attempts >= 25 and self._try_unlock('apprentice'):
            newly_unlocked.append(self.BADGES['apprentice'])
        if total_attempts >= 100 and self._try_unlock('centurion'):
            newly_unlocked.append(self.BADGES['centurion'])
        if total_attempts >= 500 and self._try_unlock('veteran'):
            newly_unlocked.append(self.BADGES['veteran'])
        if total_attempts >= 1000 and self._try_unlock('legend'):
            newly_unlocked.append(self.BADGES['legend'])
        
        # Accuracy Achievements
        if session_data['total'] >= 20 and session_data['correct'] == session_data['total']:
            if self._try_unlock('sniper'):
                newly_unlocked.append(self.BADGES['sniper'])
        
        if session_data['total'] >= 30:
            acc = session_data['correct'] / session_data['total']
            if acc >= 0.95 and self._try_unlock('sharpshooter'):
                newly_unlocked.append(self.BADGES['sharpshooter'])
        
        if session_data['total'] >= 40:
            acc = session_data['correct'] / session_data['total']
            if acc >= 0.90 and self._try_unlock('marksman'):
                newly_unlocked.append(self.BADGES['marksman'])
        
        # Perfectionist (check across all sessions)
        perfectionist_count = get_perfectionist_sessions()
        if perfectionist_count >= 3 and self._try_unlock('perfectionist'):
            newly_unlocked.append(self.BADGES['perfectionist'])
        
        # Speed Achievements
        if session_data['total'] >= 20 and session_data['avg_speed'] < 2.0 and session_data['avg_speed'] > 0:
            if self._try_unlock('speed_demon'):
                newly_unlocked.append(self.BADGES['speed_demon'])
        
        if session_data['total'] >= 20 and session_data['avg_speed'] < 1.5 and session_data['avg_speed'] > 0:
            if self._try_unlock('lightning'):
                newly_unlocked.append(self.BADGES['lightning'])
        
        if session_data['total'] >= 10 and session_data['avg_speed'] < 1.0 and session_data['avg_speed'] > 0:
            if self._try_unlock('flash'):
                newly_unlocked.append(self.BADGES['flash'])
        
        # Session Length Achievements
        if session_data['total'] >= 50:
            if self._try_unlock('marathon'):
                newly_unlocked.append(self.BADGES['marathon'])
        
        if session_data['total'] >= 100:
            if self._try_unlock('ultra_marathon'):
                newly_unlocked.append(self.BADGES['ultra_marathon'])
        
        if session_data['total'] >= 200:
            if self._try_unlock('ironman'):
                newly_unlocked.append(self.BADGES['ironman'])
        
        # Streak Achievements
        max_streak = session_data.get('max_streak', 0)
        if max_streak >= 5 and self._try_unlock('streak_5'):
            newly_unlocked.append(self.BADGES['streak_5'])
        if max_streak >= 10 and self._try_unlock('streak_10'):
            newly_unlocked.append(self.BADGES['streak_10'])
        if max_streak >= 25 and self._try_unlock('streak_25'):
            newly_unlocked.append(self.BADGES['streak_25'])
        if max_streak >= 50 and self._try_unlock('streak_50'):
            newly_unlocked.append(self.BADGES['streak_50'])
        
        # Operation Specific Achievements
        operation = session_data.get('operation', '')
        if operation:
            total, correct = get_operation_stats(operation)
            if total >= 50 and correct / total >= 0.9:
                if operation == 'Addition' and self._try_unlock('addition_master'):
                    newly_unlocked.append(self.BADGES['addition_master'])
                elif operation == 'Subtraction' and self._try_unlock('subtraction_master'):
                    newly_unlocked.append(self.BADGES['subtraction_master'])
                elif operation == 'Multiplication' and self._try_unlock('multiplication_master'):
                    newly_unlocked.append(self.BADGES['multiplication_master'])
                elif operation == 'Division' and self._try_unlock('division_master'):
                    newly_unlocked.append(self.BADGES['division_master'])
        
        # Difficulty Achievements
        digits = session_data.get('digits', 1)
        if digits >= 3:
            total_3digit, avg_time = get_digit_stats(3)
            if total_3digit >= 30 and self._try_unlock('digit_expert'):
                newly_unlocked.append(self.BADGES['digit_expert'])
            
            if total_3digit >= 20 and avg_time and avg_time < 3.0 and self._try_unlock('speed_digit'):
                newly_unlocked.append(self.BADGES['speed_digit'])
            
            if session_data['total'] >= 20:
                acc = session_data['correct'] / session_data['total']
                if acc >= 0.95 and self._try_unlock('precision_digit'):
                    newly_unlocked.append(self.BADGES['precision_digit'])
        
        # Mode Specific Achievements
        mode = session_data.get('mode', '')
        if 'Drill' in mode:
            drill_count = get_session_count_by_mode('Drill')
            if drill_count >= 10 and self._try_unlock('drill_sergeant'):
                newly_unlocked.append(self.BADGES['drill_sergeant'])
        
        if 'Sprint' in mode:
            sprint_count = get_session_count_by_mode('Sprint')
            if sprint_count >= 5 and self._try_unlock('sprint_champion'):
                newly_unlocked.append(self.BADGES['sprint_champion'])
        
        if 'Coach' in mode:
            coach_count = get_session_count_by_mode('Coach')
            if coach_count >= 10 and self._try_unlock('coach_student'):
                newly_unlocked.append(self.BADGES['coach_student'])
        
        # Master Mind (Mixed Mode)
        if operation == 'Mixed' and session_data['total'] >= 20:
            acc = session_data['correct'] / session_data['total']
            if acc >= 0.9 and self._try_unlock('master_mind'):
                newly_unlocked.append(self.BADGES['master_mind'])
        
        # Consistency Achievements
        unique_days = get_unique_play_days()
        if unique_days >= 3 and self._try_unlock('daily_player'):
            newly_unlocked.append(self.BADGES['daily_player'])
        if unique_days >= 7 and self._try_unlock('weekly_warrior'):
            newly_unlocked.append(self.BADGES['weekly_warrior'])
        
        # Special Achievements (time-based)
        from datetime import datetime
        current_hour = datetime.now().hour
        if current_hour < 9 and self._try_unlock('early_bird'):
            newly_unlocked.append(self.BADGES['early_bird'])
        if current_hour >= 21 and self._try_unlock('night_owl'):
            newly_unlocked.append(self.BADGES['night_owl'])
        
        weekend_count = get_weekend_sessions()
        if weekend_count >= 5 and self._try_unlock('weekend_warrior'):
            newly_unlocked.append(self.BADGES['weekend_warrior'])
        
        # Challenge Achievements
        if session_data['mistakes'] == 0 and session_data['total'] >= 10:
            if self._try_unlock('no_mistakes'):
                newly_unlocked.append(self.BADGES['no_mistakes'])
        
        if session_data['mistakes'] >= 5:
            acc = session_data['correct'] / session_data['total']
            if acc >= 0.8 and self._try_unlock('comeback_kid'):
                newly_unlocked.append(self.BADGES['comeback_kid'])
        
        # Total Time Achievements
        total_minutes = get_total_practice_time()
        if total_minutes >= 60 and self._try_unlock('time_master'):
            newly_unlocked.append(self.BADGES['time_master'])
        if total_minutes >= 180 and self._try_unlock('time_veteran'):
            newly_unlocked.append(self.BADGES['time_veteran'])
        if total_minutes >= 300 and self._try_unlock('time_legend'):
            newly_unlocked.append(self.BADGES['time_legend'])
        
        return newly_unlocked

    def _try_unlock(self, code):
        if code not in self.unlocked:
            if unlock_achievement(code, self.BADGES[code]['name']):
                self.unlocked.add(code)
                return True
        return False

    def get_all_badges_status(self):
        # Returns list of dicts with status
        res = []
        for code, info in self.BADGES.items():
            res.append({
                'name': info['name'],
                'desc': info['desc'],
                'unlocked': code in self.unlocked
            })
        return res

class AppSettings:
    def __init__(self):
        self.sound_enabled = True
