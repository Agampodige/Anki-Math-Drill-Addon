# Math Drill Test Suite

This directory contains test files for the Math Drill addon's weakness tracking and adaptive learning features.

## Test Files

### Core Tests
- **`test_weakness.py`** - Tests basic weakness tracking functionality
- **`test_adaptive_focus.py`** - Tests that adaptive coach focuses on weakest areas across all operations
- **`test_full_flow.py`** - Tests complete flow: logging attempts → weakness tracking → recommendations

### Debug & Analysis Tools
- **`read_real_data.py`** - Reads actual database data and shows current recommendations
- **`debug_weakness.py`** - Debugs weakness tracking data structure
- **`test_dialog_fix.py`** - Tests WeaknessDialog UI component fixes

## Running Tests

### Run All Tests
```bash
cd tests
python run_tests.py
```

### Run Individual Tests
```bash
cd tests
python test_weakness.py
python read_real_data.py
```

## What These Tests Verify

1. **Weakness Tracking Accuracy** - Ensures weakness scores are calculated correctly
2. **Adaptive Coach Logic** - Verifies coach recommends weakest areas, not just Addition
3. **Database Integration** - Tests data flow between attempts, weakness tracking, and recommendations
4. **UI Compatibility** - Ensures WeaknessDialog works with updated data structures
5. **Real Performance Analysis** - Shows actual user performance and recommendations

## Test Data

Tests create sample data simulating:
- Strong performance (Addition: 100% accuracy)
- Medium performance (Subtraction: 50% accuracy)  
- Weak performance (Multiplication: 9% accuracy)
- Mixed performance (Division: 50% accuracy)

This ensures the adaptive coach properly prioritizes areas needing improvement.
