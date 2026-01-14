import json
import os
import random

def generate_levels():
    base_path = r"d:\coding\Math drill 2\data\static\level_data.json"
    
    with open(base_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    levels = data.get("levels", [])
    start_id = max([l['id'] for l in levels]) + 1 if levels else 1
    
    new_levels = []
    
    operations = ['addition', 'subtraction', 'multiplication', 'division', 'complex']
    difficulties = ['Easy', 'Medium', 'Hard', 'Extreme']
    
    # Generate 150 levels
    for i in range(150):
        level_id = start_id + i
        
        # Progression logic
        # Cycle through operations every 5 levels
        op_idx = (i // 10) % len(operations)
        op = operations[op_idx]
        
        # Increase difficulty every 30 levels
        diff_idx = min(i // 40, 3) 
        difficulty = difficulties[diff_idx]
        
        # Digits increase with difficulty
        base_digits = 1
        if difficulty == 'Medium': base_digits = 2
        elif difficulty == 'Hard': base_digits = 3
        elif difficulty == 'Extreme': base_digits = 4
        
        # Random variance in digits for some flavor
        digits = base_digits
        if op == 'multiplication' and digits > 2: digits -= 1 # Keep mult sane
        
        # Unlock condition: usually previous level stars
        prev_level_id = level_id - 1
        unlock_condition = f"complete_level_{prev_level_id}_total_stars_1"
        if i == 0: # First new level
             # Unlock based on the last existing level if any, otherwise unlocked?
             # Actually, let's make it require stars from the very last existing level
             last_existing = levels[-1]['id'] if levels else 0
             if last_existing > 0:
                 unlock_condition = f"complete_level_{last_existing}_total_stars_1"
             else:
                 unlock_condition = "none"

        # Requirements
        total_q = 10 + (i // 10) * 2 # Increase length gradually
        min_acc = 70 + (i // 10) # increase expectation
        if min_acc > 95: min_acc = 95
        
        time_limit = None
        if i % 3 == 0: # Every 3rd level is a speed run
            time_limit = total_q * (5 if difficulty == 'Easy' else 3)
            
        level = {
            "id": level_id,
            "name": f"Level {level_id}: {difficulty} {op.capitalize()}",
            "description": f"Master {op} problems with {digits} digit numbers.",
            "operation": op,
            "digits": digits,
            "difficulty": difficulty,
            "requirements": {
                "totalQuestions": total_q,
                "minAccuracy": min_acc,
                "timeLimit": time_limit,
                "minCorrect": int(total_q * (min_acc / 100))
            },
            "rewards": {
                "starsPerQuestion": 1,
                "maxStars": 3,
                "unlocksLevel": level_id + 1,
                "pointsReward": 100 + (i * 10)
            },
            "unlockCondition": unlock_condition,
            "starThresholds": {
                "gold": int(total_q * 0.98),
                "silver": int(total_q * 0.93),
                "bronze": int(total_q * (min_acc / 100))
            }
        }
        
        new_levels.append(level)
        
    # Append
    data["levels"].extend(new_levels)
    
    # Save back
    with open(base_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Generated {len(new_levels)} levels. Total: {len(data['levels'])}")

if __name__ == "__main__":
    generate_levels()
