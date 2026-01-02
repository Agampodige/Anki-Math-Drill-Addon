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

    c.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT,
        operation TEXT,
        digits INTEGER,
        target_value INTEGER, -- e.g. 20 questions or 60 seconds
        total_attempts INTEGER,
        correct_count INTEGER,
        avg_speed REAL,
        created DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Schema migration for operation/digits if they don't exist
    try:
        c.execute("SELECT operation FROM sessions LIMIT 1")
    except sqlite3.OperationalError:
        c.execute("ALTER TABLE sessions ADD COLUMN operation TEXT")
        c.execute("ALTER TABLE sessions ADD COLUMN digits INTEGER")

    c.execute("""
    CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    c.execute("""
    CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT,
        digits INTEGER,
        correct INTEGER,
        time_taken REAL,
        created DATE,
        session_id INTEGER
    )
    """)
    
    # Check if attempts has session_id
    try:
        c.execute("SELECT session_id FROM attempts LIMIT 1")
    except sqlite3.OperationalError:
        c.execute("ALTER TABLE attempts ADD COLUMN session_id INTEGER")

    c.execute("""
    CREATE TABLE IF NOT EXISTS weakness_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT,
        digits INTEGER,
        weakness_score REAL,
        consecutive_correct INTEGER,
        last_practiced DATE,
        mastery_level TEXT,
        UNIQUE(operation, digits)
    )
    """)

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
