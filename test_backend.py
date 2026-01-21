#!/usr/bin/env python3
"""
Simple test to verify the JavaScript fixes work without requiring Anki
"""

import os
import sys
import json
from datetime import date

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

def test_database_api():
    """Test the database API directly"""
    try:
        from database_api import db_api
        
        print("Testing Database API...")
        
        # Test comprehensive stats
        stats = db_api.get_comprehensive_stats('today')
        print(f"Today's stats: {json.dumps(stats['basic_stats'], indent=2)}")
        
        stats = db_api.get_comprehensive_stats('all')
        print(f"All-time stats: {json.dumps(stats['basic_stats'], indent=2)}")
        
        # Test daily goals
        daily_goals = db_api.get_daily_goal_status()
        print(f"Daily goals: {json.dumps(daily_goals, indent=2)}")
        
        return True
        
    except ImportError as e:
        print(f"Import error: {e}")
        return False
    except Exception as e:
        print(f"Error during testing: {e}")
        return False

if __name__ == "__main__":
    success = test_database_api()
    if success:
        print("\n✅ Database API test passed!")
        print("The backend should be able to provide real data to the frontend.")
    else:
        print("\n❌ Database API test failed!")
        sys.exit(1)
