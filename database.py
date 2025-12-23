import sqlite3
from datetime import date

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
