import sqlite3
from .database import DB_NAME
from datetime import date

def get_today_stats():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute("""
    SELECT COUNT(*),
           SUM(correct),
           AVG(time_taken)
    FROM attempts
    WHERE created = ?
    """, (date.today(),))

    total, correct, avg_time = c.fetchone()
    conn.close()

    if total == 0:
        return "No data for today."

    accuracy = (correct / total) * 100
    return f"Attempts: {total} | Accuracy: {accuracy:.1f}% | Avg Time: {avg_time:.2f}s"


def get_overall_stats():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute("""
    SELECT COUNT(*), SUM(correct)
    FROM attempts
    """)

    total, correct = c.fetchone()
    conn.close()

    if total == 0:
        return "No attempts yet."

    accuracy = (correct / total) * 100
    return f"Total Attempts: {total} | Overall Accuracy: {accuracy:.1f}%"
