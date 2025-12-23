from .database import unlock_achievement, get_unlocked_achievements

class AchievementManager:
    # Define Badges
    BADGES = {
        'first_win': {'name': 'First Steps', 'desc': 'Complete your first session'},
        'centurion': {'name': 'Centurion', 'desc': 'Complete 100 questions total'}, # Simplified for demo
        'sniper': {'name': 'Sniper', 'desc': '100% Accuracy in a Drill (20+ Qs)'},
        'speed_demon': {'name': 'Speed Demon', 'desc': 'Avg Speed < 2.0s in a Drill/Sprint (20+ Qs)'},
        'marathon': {'name': 'Marathoner', 'desc': 'Complete a session with 50+ Questions'},
        'master_mind': {'name': 'Master Mind', 'desc': 'Complete a Mixed Mode session with >90% Acc'}
    }

    def __init__(self):
        self.unlocked = get_unlocked_achievements()

    def check_achievements(self, session_data):
        # session_data: {'mode', 'total', 'correct', 'avg_speed', 'total_time', 'mistakes'}
        newly_unlocked = []
        
        # 1. First Win (Any session completion)
        if self._try_unlock('first_win'):
            newly_unlocked.append(self.BADGES['first_win'])

        # 2. Sniper
        if session_data['total'] >= 20 and session_data['correct'] == session_data['total']:
            if self._try_unlock('sniper'):
                newly_unlocked.append(self.BADGES['sniper'])
                
        # 3. Speed Demon
        if session_data['total'] >= 20 and session_data['avg_speed'] < 2.0 and session_data['avg_speed'] > 0:
            if self._try_unlock('speed_demon'):
                newly_unlocked.append(self.BADGES['speed_demon'])
                
        # 4. Marathon
        if session_data['total'] >= 50:
             if self._try_unlock('marathon'):
                newly_unlocked.append(self.BADGES['marathon'])
                
        # 5. Master Mind (Mixed Mode check must receive 'mode' string correctly)
        # Note: 'mode' in session_data might be "Drill (20 Qs)". We need to check if Operation was Mixed.
        # Ideally we pass 'operation' too.
        if session_data.get('operation') == 'Mixed' and session_data['total'] >= 20:
             acc = (session_data['correct'] / session_data['total'])
             if acc >= 0.9:
                 if self._try_unlock('master_mind'):
                     newly_unlocked.append(self.BADGES['master_mind'])

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
