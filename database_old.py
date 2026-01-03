import sqlite3
import os
from datetime import date

# Get the addon's data directory for proper database storage
try:
    from aqt import mw
    ADDON_DIR = os.path.dirname(os.path.dirname(__file__))
    DB_NAME = os.path.join(mw.pm.addonFolder(), "math_drill.db")
except ImportError:
    # Fallback for standalone testing
    DB_NAME = "math_drill.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    # Enable WAL mode for better concurrent access
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA synchronous=NORMAL")
    c.execute("PRAGMA cache_size=10000")
    c.execute("PRAGMA temp_store=MEMORY")

    # Check if we need to do basic table creation first
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in c.fetchall()}
    
    # Create basic tables if they don't exist
    if 'sessions' not in existing_tables:
        c.execute("""
        CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT NOT NULL,
            operation TEXT NOT NULL,
            digits INTEGER NOT NULL,
            target_value INTEGER,
            total_attempts INTEGER NOT NULL,
            correct_count INTEGER NOT NULL,
            avg_speed REAL NOT NULL,
            created DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)
    else:
        # Migrate existing sessions table
        try:
            c.execute("SELECT operation FROM sessions LIMIT 1")
        except sqlite3.OperationalError:
            # Add missing columns with proper defaults
            c.execute("ALTER TABLE sessions ADD COLUMN operation TEXT NOT NULL DEFAULT 'Mixed'")
            c.execute("ALTER TABLE sessions ADD COLUMN digits INTEGER NOT NULL DEFAULT 2")

    # Add indexes for better performance
    c.execute("CREATE INDEX IF NOT EXISTS idx_sessions_mode ON sessions(mode)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_sessions_operation ON sessions(operation)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_sessions_operation_digits ON sessions(operation, digits)")

    if 'achievements' not in existing_tables:
        c.execute("""
        CREATE TABLE achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'general',
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)
    else:
        # Migrate existing achievements table
        try:
            c.execute("SELECT description FROM achievements LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("ALTER TABLE achievements ADD COLUMN description TEXT")
            c.execute("ALTER TABLE achievements ADD COLUMN category TEXT DEFAULT 'general'")
    
    c.execute("CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category)")
    
    if 'attempts' not in existing_tables:
        c.execute("""
        CREATE TABLE attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation TEXT NOT NULL,
            digits INTEGER NOT NULL,
            correct INTEGER NOT NULL,
            time_taken REAL NOT NULL,
            created DATE NOT NULL,
            session_id INTEGER,
            question_text TEXT,
            user_answer INTEGER,
            correct_answer INTEGER,
            difficulty_level INTEGER DEFAULT 1
        )
        """)
    else:
        # Migrate existing attempts table
        try:
            c.execute("SELECT session_id FROM attempts LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("ALTER TABLE attempts ADD COLUMN session_id INTEGER")
        
        # Add new fields for better analytics
        try:
            c.execute("SELECT question_text FROM attempts LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("ALTER TABLE attempts ADD COLUMN question_text TEXT")
            c.execute("ALTER TABLE attempts ADD COLUMN user_answer INTEGER")
            c.execute("ALTER TABLE attempts ADD COLUMN correct_answer INTEGER")
            c.execute("ALTER TABLE attempts ADD COLUMN difficulty_level INTEGER DEFAULT 1")

    # Add indexes for attempts table (only after columns exist)
    c.execute("CREATE INDEX IF NOT EXISTS idx_attempts_operation ON attempts(operation)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_attempts_digits ON attempts(digits)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_attempts_session_id ON attempts(session_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_attempts_operation_digits ON attempts(operation, digits)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_attempts_correct ON attempts(correct)")

    if 'weakness_tracking' not in existing_tables:
        c.execute("""
        CREATE TABLE weakness_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation TEXT NOT NULL,
            digits INTEGER NOT NULL,
            weakness_score REAL NOT NULL,
            consecutive_correct INTEGER NOT NULL DEFAULT 0,
            last_practiced DATE NOT NULL,
            mastery_level TEXT NOT NULL DEFAULT 'Novice',
            total_attempts INTEGER DEFAULT 0,
            total_correct INTEGER DEFAULT 0,
            avg_time REAL DEFAULT 0,
            first_practiced DATE,
            UNIQUE(operation, digits)
        )
        """)
    else:
        # Schema migration for new weakness_tracking fields
        try:
            c.execute("SELECT total_attempts FROM weakness_tracking LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("ALTER TABLE weakness_tracking ADD COLUMN total_attempts INTEGER DEFAULT 0")
            c.execute("ALTER TABLE weakness_tracking ADD COLUMN total_correct INTEGER DEFAULT 0")
            c.execute("ALTER TABLE weakness_tracking ADD COLUMN avg_time REAL DEFAULT 0")
            c.execute("ALTER TABLE weakness_tracking ADD COLUMN first_practiced DATE")
    
    c.execute("CREATE INDEX IF NOT EXISTS idx_weakness_score ON weakness_tracking(weakness_score)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_weakness_mastery ON weakness_tracking(mastery_level)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_weakness_last_practiced ON weakness_tracking(last_practiced)")

    # Add new table for user preferences and settings
    c.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Add new table for daily goals
    c.execute("""
    CREATE TABLE IF NOT EXISTS daily_goals (
        date DATE PRIMARY KEY,
        target_questions INTEGER DEFAULT 20,
        target_time_minutes INTEGER DEFAULT 10,
        questions_completed INTEGER DEFAULT 0,
        time_spent_minutes REAL DEFAULT 0,
        achieved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    c.execute("CREATE INDEX IF NOT EXISTS idx_daily_goals_date ON daily_goals(date)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_daily_goals_achieved ON daily_goals(achieved)")

    # Add adaptive difficulty tracking table
    c.execute("""
    CREATE TABLE IF NOT EXISTS adaptive_difficulty (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        digits INTEGER NOT NULL,
        current_difficulty REAL DEFAULT 1.0,
        success_rate REAL DEFAULT 0.5,
        avg_response_time REAL DEFAULT 0.0,
        last_adjusted DATETIME DEFAULT CURRENT_TIMESTAMP,
        adjustment_factor REAL DEFAULT 0.1,
        total_attempts INTEGER DEFAULT 0,
        recent_performance JSON,
        UNIQUE(operation, digits)
    )
    """)
    
    c.execute("CREATE INDEX IF NOT EXISTS idx_adaptive_operation_digits ON adaptive_difficulty(operation, digits)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_adaptive_difficulty ON adaptive_difficulty(current_difficulty)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_adaptive_success_rate ON adaptive_difficulty(success_rate)")

    conn.commit()
    conn.close()

def unlock_achievement(code, name):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("INSERT INTO achievements (code, name) VALUES (?, ?)", (code, name))
        conn.commit()
        return True # Newly unlocked
    except sqlite3.IntegrityError:
        return False # Already unlocked
    finally:
        conn.close()

def get_unlocked_achievements():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT code FROM achievements")
    data = {row[0] for row in c.fetchall()}
    conn.close()
    return data

def get_total_attempts_count():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM attempts")
    count = c.fetchone()[0]
    conn.close()
    return count

def get_operation_stats(operation):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT COUNT(*), SUM(correct) FROM attempts WHERE operation = ?", (operation,))
    total, correct = c.fetchone()
    conn.close()
    return total, correct

def get_digit_stats(digits):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT COUNT(*), AVG(time_taken) FROM attempts WHERE digits = ?", (digits,))
    total, avg_time = c.fetchone()
    conn.close()
    return total, avg_time

def get_session_count_by_mode(mode_pattern):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM sessions WHERE mode LIKE ?", (f"%{mode_pattern}%",))
    count = c.fetchone()[0]
    conn.close()
    return count

def get_unique_play_days():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT COUNT(DISTINCT DATE(created)) FROM sessions")
    days = c.fetchone()[0]
    conn.close()
    return days

def get_total_practice_time():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT SUM(total_attempts * avg_speed) FROM sessions")
    total_seconds = c.fetchone()[0] or 0
    conn.close()
    return total_seconds / 60  # Convert to minutes

def get_sessions_by_time_of_day(hour, comparison):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    if comparison == 'before':
        c.execute("SELECT COUNT(*) FROM sessions WHERE strftime('%H', created) < ?", (str(hour),))
    else:
        c.execute("SELECT COUNT(*) FROM sessions WHERE strftime('%H', created) >= ?", (str(hour),))
    count = c.fetchone()[0]
    conn.close()
    return count

def get_weekend_sessions():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM sessions WHERE strftime('%w', created) IN ('0', '6')")
    count = c.fetchone()[0]
    conn.close()
    return count

def get_perfectionist_sessions():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM sessions WHERE correct_count = total_attempts AND total_attempts >= 10")
    count = c.fetchone()[0]
    conn.close()
    return count

def log_session(mode, op, digits, target, total, correct, avg_speed):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""
    INSERT INTO sessions (mode, operation, digits, target_value, total_attempts, correct_count, avg_speed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (mode, op, digits, target, total, correct, avg_speed))
    session_id = c.lastrowid
    conn.commit()
    conn.close()
    return session_id

def get_personal_best(mode, op, digits):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    if "Drill" in mode:
        # PB is lowest avg_speed (which reflects total time for fixed 20 Qs)
        # Actually total_time = total_attempts * avg_speed.
        c.execute("""
        SELECT MIN(total_attempts * avg_speed) FROM sessions 
        WHERE mode LIKE 'Drill%' AND operation = ? AND digits = ? AND correct_count >= total_attempts
        """, (op, digits))
    elif "Sprint" in mode:
        # PB is highest correct_count
        c.execute("""
        SELECT MAX(correct_count) FROM sessions 
        WHERE mode LIKE 'Sprint%' AND operation = ? AND digits = ?
        """, (op, digits))
    else:
        conn.close()
        return None
        
    res = c.fetchone()
    conn.close()
    return res[0] if res and res[0] is not None else None

def log_attempt(operation, digits, correct, time_taken, session_id=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute("""
    INSERT INTO attempts (operation, digits, correct, time_taken, created, session_id)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (operation, digits, correct, time_taken, date.today(), session_id))

    conn.commit()
    conn.close()

def get_performance_breakdown():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Group by Operation and Digits
    # Filter for reasonably recent data? Let's take all time for mastery, or maybe last 30 days.
    # Let's do last 30 days to reflect current skill.
    c.execute("""
    SELECT operation, digits, COUNT(*), SUM(correct), AVG(time_taken)
    FROM attempts
    WHERE created >= date('now', '-30 days')
    GROUP BY operation, digits
    """)
    
    data = c.fetchall()
    conn.close()
    return data

def get_last_7_days_stats():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Get stats for last 7 days including today
    c.execute("""
    SELECT created, COUNT(*), SUM(correct)
    FROM attempts
    WHERE created >= date('now', '-6 days')
    GROUP BY created
    ORDER BY created ASC
    """)
    
    data = c.fetchall()
    conn.close()
    return data

def get_total_attempts_count():
    """Get the total number of questions answered all-time."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM attempts")
    result = c.fetchone()
    conn.close()
    return result[0] if result else 0

def get_today_attempts_count():
    """Get the total number of questions answered today."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM attempts WHERE created = ?", (date.today().isoformat(),))
    result = c.fetchone()
    conn.close()
    return result[0] if result else 0

def update_weakness_tracking(operation, digits, correct):
    """Update weakness tracking for a specific operation/digit combination."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Get recent performance for this skill (last 10 attempts)
    c.execute("""
    SELECT correct, time_taken 
    FROM attempts 
    WHERE operation = ? AND digits = ? 
    ORDER BY created DESC, id DESC 
    LIMIT 10
    """, (operation, digits))
    
    recent_attempts = c.fetchall()
    
    # Calculate weakness score based on recent performance
    if len(recent_attempts) < 3:
        weakness_score = 80.0  # High weakness for new skills
        mastery_level = "Novice"
    else:
        recent_correct = sum(1 for attempt in recent_attempts if attempt[0])
        recent_accuracy = recent_correct / len(recent_attempts)
        recent_avg_time = sum(attempt[1] for attempt in recent_attempts if attempt[1]) / len(recent_attempts)
        
        # Calculate weakness score (lower is better)
        if recent_accuracy >= 0.9 and recent_avg_time < 4.0:
            weakness_score = 10.0  # Mastered
            mastery_level = "Master"
        elif recent_accuracy >= 0.8:
            weakness_score = 30.0  # Good
            mastery_level = "Pro"
        elif recent_accuracy >= 0.6:
            weakness_score = 60.0  # Needs work
            mastery_level = "Apprentice"
        else:
            weakness_score = 90.0  # Struggling
            mastery_level = "Novice"
    
    # Update consecutive correct streak
    if correct:
        c.execute("""
        SELECT consecutive_correct FROM weakness_tracking 
        WHERE operation = ? AND digits = ?
        """, (operation, digits))
        result = c.fetchone()
        consecutive = (result[0] + 1) if result else 1
    else:
        consecutive = 0
    
    # Insert or update weakness tracking
    c.execute("""
    INSERT OR REPLACE INTO weakness_tracking 
    (operation, digits, weakness_score, consecutive_correct, last_practiced, mastery_level)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (operation, digits, weakness_score, consecutive, date.today().isoformat(), mastery_level))
    
    conn.commit()
    conn.close()

def get_weakness_areas():
    """Get all weakness areas sorted by weakness score (highest first)."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    c.execute("""
    SELECT operation, digits, weakness_score, consecutive_correct, mastery_level, last_practiced
    FROM weakness_tracking
    WHERE weakness_score > 20
    ORDER BY weakness_score DESC, last_practiced ASC
    """)
    
    data = c.fetchall()
    conn.close()
    
    return [{
        'operation': row[0],
        'digits': row[1], 
        'weakness_score': row[2],
        'consecutive_correct': row[3],
        'mastery_level': row[4],
        'last_practiced': row[5]
    } for row in data]

def get_weakest_area():
    """Get the single weakest area that needs the most practice."""
    weaknesses = get_weakness_areas()
    return weaknesses[0] if weaknesses else None

# === Adaptive Learning System ===

def get_adaptive_difficulty(operation, digits):
    """Get current adaptive difficulty for a specific operation/digit combination."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""
    SELECT current_difficulty, success_rate, avg_response_time, total_attempts, recent_performance
    FROM adaptive_difficulty 
    WHERE operation = ? AND digits = ?
    """, (operation, digits))
    result = c.fetchone()
    conn.close()
    
    if result:
        return {
            'current_difficulty': result[0],
            'success_rate': result[1],
            'avg_response_time': result[2],
            'total_attempts': result[3],
            'recent_performance': result[4]
        }
    else:
        # Create new entry with default values
        return {
            'current_difficulty': 1.0,
            'success_rate': 0.5,
            'avg_response_time': 0.0,
            'total_attempts': 0,
            'recent_performance': None
        }

def update_adaptive_difficulty(operation, digits, correct, time_taken):
    """Update adaptive difficulty based on performance."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Get current adaptive data
    c.execute("""
    SELECT current_difficulty, success_rate, avg_response_time, total_attempts, recent_performance
    FROM adaptive_difficulty 
    WHERE operation = ? AND digits = ?
    """, (operation, digits))
    result = c.fetchone()
    
    if result:
        current_difficulty, success_rate, avg_response_time, total_attempts, recent_perf = result
        total_attempts += 1
        
        # Update recent performance (keep last 10 attempts)
        import json
        if recent_perf:
            recent_data = json.loads(recent_perf)
        else:
            recent_data = []
        
        recent_data.append({
            'correct': correct,
            'time_taken': time_taken,
            'timestamp': date.today().isoformat()
        })
        
        # Keep only last 10 attempts
        if len(recent_data) > 10:
            recent_data = recent_data[-10:]
        
        # Calculate new success rate based on recent performance
        recent_correct = sum(1 for attempt in recent_data if attempt['correct'])
        new_success_rate = recent_correct / len(recent_data)
        
        # Update average response time
        if avg_response_time == 0:
            new_avg_time = time_taken
        else:
            new_avg_time = (avg_response_time * 0.8) + (time_taken * 0.2)  # Weighted average
        
        # Adaptive difficulty adjustment
        adjustment_factor = 0.1  # Base adjustment factor
        
        # Adjust based on performance
        if new_success_rate > 0.85 and time_taken < 3.0:  # Performing very well
            difficulty_change = adjustment_factor * 1.5
        elif new_success_rate > 0.75:  # Performing well
            difficulty_change = adjustment_factor
        elif new_success_rate < 0.4:  # Struggling
            difficulty_change = -adjustment_factor * 1.2
        elif new_success_rate < 0.6:  # Some difficulty
            difficulty_change = -adjustment_factor * 0.8
        else:
            difficulty_change = 0  # Optimal difficulty
        
        # Apply difficulty change with bounds
        new_difficulty = max(0.5, min(3.0, current_difficulty + difficulty_change))
        
        # Update database
        c.execute("""
        UPDATE adaptive_difficulty 
        SET current_difficulty = ?, success_rate = ?, avg_response_time = ?,
            total_attempts = ?, recent_performance = ?, last_adjusted = CURRENT_TIMESTAMP
        WHERE operation = ? AND digits = ?
        """, (new_difficulty, new_success_rate, new_avg_time, total_attempts,
              json.dumps(recent_data), operation, digits))
    else:
        # Create new entry
        import json
        initial_performance = json.dumps([{
            'correct': correct,
            'time_taken': time_taken,
            'timestamp': date.today().isoformat()
        }])
        
        c.execute("""
        INSERT INTO adaptive_difficulty 
        (operation, digits, current_difficulty, success_rate, avg_response_time, 
         total_attempts, recent_performance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (operation, digits, 1.0, 1.0 if correct else 0.0, time_taken, 1,
              initial_performance))
    
    conn.commit()
    conn.close()

def get_adaptive_recommendations(limit=5):
    """Get adaptive learning recommendations based on current performance."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    c.execute("""
    SELECT operation, digits, current_difficulty, success_rate, avg_response_time
    FROM adaptive_difficulty 
    WHERE total_attempts >= 3
    ORDER BY 
        CASE 
            WHEN success_rate < 0.6 THEN 1
            WHEN success_rate < 0.8 THEN 2
            ELSE 3
        END,
        success_rate ASC,
        last_adjusted ASC
    LIMIT ?
    """, (limit,))
    
    recommendations = []
    for row in c.fetchall():
        operation, digits, difficulty, success_rate, avg_time = row
        
        if success_rate < 0.6:
            priority = "High Priority - Needs Practice"
            reason = f"Low success rate ({success_rate:.1%})"
        elif success_rate < 0.8:
            priority = "Medium Priority - Improving"
            reason = f"Moderate success rate ({success_rate:.1%})"
        else:
            priority = "Low Priority - Maintenance"
            reason = f"Good success rate ({success_rate:.1%})"
        
        recommendations.append({
            'operation': operation,
            'digits': digits,
            'difficulty': difficulty,
            'priority': priority,
            'reason': reason,
            'success_rate': success_rate,
            'avg_time': avg_time
        })
    
    conn.close()
    return recommendations

def get_adaptive_learning_insights():
    """Get comprehensive adaptive learning insights."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Overall learning velocity
    c.execute("""
    SELECT 
        COUNT(*) as total_adaptive_skills,
        AVG(success_rate) as avg_success_rate,
        AVG(current_difficulty) as avg_difficulty,
        SUM(CASE WHEN success_rate >= 0.8 THEN 1 ELSE 0 END) as mastered_skills,
        SUM(CASE WHEN success_rate < 0.6 THEN 1 ELSE 0 END) as struggling_skills
    FROM adaptive_difficulty 
    WHERE total_attempts >= 5
    """)
    
    overall_stats = c.fetchone()
    
    # Learning trends by operation
    c.execute("""
    SELECT 
        operation,
        AVG(success_rate) as avg_success,
        AVG(current_difficulty) as avg_difficulty,
        COUNT(*) as skill_count
    FROM adaptive_difficulty 
    WHERE total_attempts >= 3
    GROUP BY operation
    ORDER BY avg_success DESC
    """)
    
    operation_trends = []
    for row in c.fetchall():
        operation_trends.append({
            'operation': row[0],
            'avg_success': row[1],
            'avg_difficulty': row[2],
            'skill_count': row[3]
        })
    
    # Difficulty progression
    c.execute("""
    SELECT 
        digits,
        AVG(success_rate) as avg_success,
        AVG(current_difficulty) as avg_difficulty,
        COUNT(*) as skill_count
    FROM adaptive_difficulty 
    WHERE total_attempts >= 3
    GROUP BY digits
    ORDER BY digits
    """)
    
    difficulty_progression = []
    for row in c.fetchall():
        difficulty_progression.append({
            'digits': row[0],
            'avg_success': row[1],
            'avg_difficulty': row[2],
            'skill_count': row[3]
        })
    
    conn.close()
    
    return {
        'overall_stats': {
            'total_adaptive_skills': overall_stats[0],
            'avg_success_rate': overall_stats[1] or 0,
            'avg_difficulty': overall_stats[2] or 0,
            'mastered_skills': overall_stats[3] or 0,
            'struggling_skills': overall_stats[4] or 0
        },
        'operation_trends': operation_trends,
        'difficulty_progression': difficulty_progression
    }
