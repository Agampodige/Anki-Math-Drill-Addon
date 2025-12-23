from .database import get_performance_breakdown
import random

class SmartCoach:
    def __init__(self):
        self.knowledge_map = {} # Key: (Op, Digits) -> {acc, speed, count}
        
    def analyze(self):
        data = get_performance_breakdown()
        # Data: [(op, digits, count, correct_sum, avg_time), ...]
        
        self.knowledge_map = {}
        for row in data:
            op, digits, count, correct_sum, avg_time = row
            accuracy = (correct_sum / count * 100) if count > 0 else 0
            
            # Determine Mastery Level
            if count < 10: level = "Novice"
            elif accuracy < 85: level = "Apprentice"
            elif accuracy >= 95 and (avg_time < 4.0 if digits == 1 else (avg_time < 8.0 if digits == 2 else avg_time < 15.0)):
                level = "Master"
            else:
                level = "Pro"
                
            self.knowledge_map[(op, digits)] = {
                'acc': accuracy,
                'speed': avg_time if avg_time else 0,
                'count': count,
                'level': level
            }
            
    def get_recommendation(self):
        self.analyze()
        
        operations = ["Addition", "Subtraction", "Multiplication", "Division"]
        digits_levels = [1, 2, 3] 
        
        candidates = []
        
        for op in operations:
            for d in digits_levels:
                key = (op, d)
                stats = self.knowledge_map.get(key, {'acc': 0, 'speed': 0, 'count': 0, 'level': "Novice"})
                
                score = 0
                reason = ""
                
                if stats['level'] == "Novice":
                    score = 80 # High priority to explore
                    reason = "Let's learn the basics"
                elif stats['level'] == "Apprentice":
                    score = 100 - stats['acc'] + 50 # High priority to fix errors. 60% acc -> 90 score.
                    reason = f"Fix accuracy ({stats['acc']:.1f}%)"
                elif stats['level'] == "Pro":
                    score = 40 + (stats['speed'] * 2) # Prioritize slower pro skills
                    reason = f"Push for speed (Avg: {stats['speed']:.1f}s)"
                elif stats['level'] == "Master":
                    score = 10 # Maintenance
                    reason = "Maintenance drill"
                    
                candidates.append({
                    'key': key,
                    'score': score,
                    'reason': reason,
                    'level': stats['level']
                })
        
        # Sort by score descending
        candidates.sort(key=lambda x: x['score'], reverse=True)
        
        # Weighted random top 3 to avoid boredom? Or just top 1. 
        # Let's do a slight randomness among top 3
        top_n = candidates[:3]
        if not top_n: return ("Addition", 1), "Get started!"
        
        choice = random.choice(top_n)
        return choice['key'], f"{choice['reason']} [{choice['level']}]"

    def get_mastery_grid_data(self):
        self.analyze()
        return self.knowledge_map
