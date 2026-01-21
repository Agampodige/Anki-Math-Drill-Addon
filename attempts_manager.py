import json
import os
from datetime import datetime
from typing import Any, Dict, List


class AttemptsManager:
    """Manages saving/loading of attempts and computing basic statistics."""

    def __init__(self, addon_path: str):
        self.addon_path = addon_path
        self.data_dir = os.path.join(addon_path, "data")
        self.static_file = os.path.join(self.data_dir, "attempts.json")
        self.user_file = os.path.join(self.data_dir, "user", "attempts.json")

        os.makedirs(os.path.dirname(self.user_file), exist_ok=True)

        self.attempts_data: Dict[str, Any] = self.load_attempts()

    def _default_structure(self) -> Dict[str, Any]:
        return {"lastId": 0, "attempts": [], "lastSaved": "", "totalAttempts": 0}

    def load_attempts(self) -> Dict[str, Any]:
        """Load attempts from user file if present, otherwise fall back to static file or empty structure."""
        try:
            if os.path.exists(self.user_file):
                with open(self.user_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                print(f"Loaded user attempts from {self.user_file}")
                return data

            if os.path.exists(self.static_file):
                with open(self.static_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                print(f"Loaded static attempts from {self.static_file}")
                return data

            print(f"  No attempts file found, using empty structure")
            return self._default_structure()
        except Exception as e:
            print(f"Error loading attempts: {e}")
            return self._default_structure()

    def save_attempts(self, attempts_payload: Any) -> Dict[str, Any]:
        """Save incoming attempts to the user attempts file.

        Accepts either a single attempt dict, a list of attempts, or a dict with key 'attempts'.
        Returns a summary dict with success flag and counts.
        """
        try:
            # Normalize incoming attempts to a list
            if isinstance(attempts_payload, dict) and "attempts" in attempts_payload:
                new_attempts = attempts_payload.get("attempts", [])
            elif isinstance(attempts_payload, list):
                new_attempts = attempts_payload
            elif isinstance(attempts_payload, dict):
                new_attempts = [attempts_payload]
            else:
                return {"success": False, "message": "Unsupported payload format"}

            if not new_attempts:
                return {"success": True, "added": 0, "message": "No attempts to add"}

            data = self.load_attempts()
            last_id = data.get("lastId", 0)
            attempts_list: List[Dict[str, Any]] = data.get("attempts", [])

            added_count = 0
            for attempt in new_attempts:
                # Assign an id if missing or conflicting
                if not isinstance(attempt, dict):
                    continue

                if "id" not in attempt or attempt["id"] in [a.get("id") for a in attempts_list]:
                    last_id += 1
                    attempt["id"] = last_id
                
                # Ensure timestamp exists for heatmap
                if "timestamp" not in attempt:
                    import time
                    attempt["timestamp"] = time.time()

                attempts_list.append(attempt)
                added_count += 1

            # Update summary fields
            data["attempts"] = attempts_list
            data["lastId"] = last_id
            data["lastSaved"] = datetime.now().isoformat()
            data["totalAttempts"] = len(attempts_list)

            # Ensure directory
            os.makedirs(os.path.dirname(self.user_file), exist_ok=True)
            with open(self.user_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            self.attempts_data = data

            print(f"Saved {added_count} new attempts to {self.user_file}")
            return {"success": True, "added": added_count, "totalAttempts": data["totalAttempts"]}

        except Exception as e:
            print(f"Error saving attempts: {e}")
            return {"success": False, "message": str(e)}

    def get_heatmap_data(self) -> Dict[str, int]:
        """Get aggregated attempt counts by date for heatmap visualization.
        
        Returns:
            Dict mapping date strings (YYYY-MM-DD) to attempt counts
        """
        try:
            data = self.load_attempts()
            attempts = data.get("attempts", [])
            
            date_counts = {}
            for attempt in attempts:
                # Get timestamp from attempt
                ts = attempt.get("timestamp") or attempt.get("date")
                if not ts:
                    continue
                
                try:
                    # Convert timestamp/date to date string
                    from datetime import datetime
                    if isinstance(ts, (int, float)):
                        date_obj = datetime.fromtimestamp(ts)
                    else:
                        # Try parsing string format (ISO)
                        ts_str = str(ts).replace("Z", "+00:00")
                        date_obj = datetime.fromisoformat(ts_str)
                        
                    date_str = date_obj.strftime("%Y-%m-%d")
                    
                    # Increment count for this date
                    date_counts[date_str] = date_counts.get(date_str, 0) + 1
                except (ValueError, OSError, OverflowError) as e:
                    # Skip invalid timestamps
                    print(f"Invalid timestamp {timestamp}: {e}")
                    continue
            
            return date_counts
        except Exception as e:
            print(f"Error computing heatmap data: {e}")
            return {}

    def get_weaknesses(self, operation: str = None, digits: int = None) -> List[Dict[str, Any]]:
        """
        Analyze attempts to find specific number pairs that the user struggles with.
        Identifies pairs with:
        1. High error rate
        2. Significantly slower response time ( > 1.5x average)
        
        Returns a list of weakness objects: {"num1": int, "num2": int, "op": str, "reason": str}
        """
        try:
            data = self.load_attempts()
            attempts = data.get("attempts", [])
            if not attempts:
                return []

            # Group attempts by pair and operation
            stats = {} # key: (num1, num2, op)
            
            # Map display symbols to standard operation names
            op_map = {
                "+": "addition",
                "−": "subtraction",
                "×": "multiplication",
                "÷": "division"
            }

            for a in attempts:
                # Filter by operation/digits if provided
                if operation and a.get("operation") != operation:
                    continue
                if digits and a.get("digits") != digits:
                    continue

                q_str = a.get("question", "")
                # Try to parse operands from question string "A op B"
                parts = q_str.split()
                if len(parts) < 3:
                    # Maybe it has " = ?" at the end
                    parts = q_str.replace("= ?", "").strip().split()
                
                if len(parts) >= 3:
                    try:
                        num1 = int(parts[0])
                        op_sym = parts[1]
                        num2 = int(parts[2])
                        op = op_map.get(op_sym, a.get("operation"))
                        
                        key = (num1, num2, op)
                        if key not in stats:
                            stats[key] = {"correct": 0, "total": 0, "times": []}
                        
                        stats[key]["total"] += 1
                        if a.get("isCorrect"):
                            stats[key]["correct"] += 1
                        
                        if a.get("timeTaken"):
                            stats[key]["times"].append(float(a["timeTaken"]))
                    except (ValueError, IndexError):
                        continue

            if not stats:
                return []

            # Calculate global averages for comparison
            all_times = [t for s in stats.values() for t in s["times"]]
            global_avg_time = sum(all_times) / len(all_times) if all_times else 5.0
            
            weaknesses = []
            for (n1, n2, op), s in stats.items():
                accuracy = s["correct"] / s["total"]
                avg_time = sum(s["times"]) / len(s["times"]) if s["times"] else 0
                
                reason = None
                if accuracy < 0.7 and s["total"] >= 2:
                    reason = "accuracy"
                elif avg_time > global_avg_time * 1.5 and s["total"] >= 2:
                    reason = "speed"
                
                if reason:
                    weaknesses.append({
                        "num1": n1,
                        "num2": n2,
                        "op": op,
                        "reason": reason,
                        "accuracy": round(accuracy * 100, 1),
                        "avgTime": round(avg_time, 2)
                    })

            # Sort by accuracy (worst first) then speed
            weaknesses.sort(key=lambda x: (x.get("accuracy", 100), -x.get("avgTime", 0)))
            
            return weaknesses[:10] # Return top 10 weaknesses
            
        except Exception as e:
            print(f"Error getting weaknesses: {e}")
            return []

    def get_attempt_statistics(self) -> Dict[str, Any]:
        """Compute basic statistics from available attempts."""
        try:
            data = self.load_attempts()
            attempts = data.get("attempts", [])
            total = len(attempts)
            if total == 0:
                return {
                    "totalAttempts": 0, 
                    "correctCount": 0, 
                    "incorrectCount": 0, 
                    "accuracy": 0.0, 
                    "averageTime": 0.0,
                    "byOperation": {},
                    "attempts": []
                }

            # Validate and sanitize attempts
            valid_attempts = []
            for a in attempts:
                if not isinstance(a, dict):
                    continue
                # Ensure required fields exist
                if "isCorrect" not in a:
                    a["isCorrect"] = False
                if "timeTaken" not in a:
                    a["timeTaken"] = 0
                if "operation" not in a:
                    a["operation"] = "unknown"
                valid_attempts.append(a)
            
            total = len(valid_attempts)
            if total == 0:
                return {
                    "totalAttempts": 0, 
                    "correctCount": 0, 
                    "incorrectCount": 0, 
                    "accuracy": 0.0, 
                    "averageTime": 0.0,
                    "byOperation": {},
                    "attempts": []
                }

            correct = sum(1 for a in valid_attempts if a.get("isCorrect"))
            incorrect = total - correct
            avg_time = sum((a.get("timeTaken", 0) or 0) for a in valid_attempts) / total
            accuracy = (correct / total) * 100 if total > 0 else 0.0

            by_op = {}
            for a in valid_attempts:
                op = a.get("operation", "unknown")
                # Initialize operation stats if not present
                if op not in by_op:
                    by_op[op] = {
                        "count": 0, 
                        "correct": 0,
                        "total_time": 0.0
                    }
                
                # Update stats
                by_op[op]["count"] += 1
                by_op[op]["total_time"] += (a.get("timeTaken", 0) or 0)
                
                if a.get("isCorrect"):
                    by_op[op]["correct"] += 1

            # Convert by_op to final format with calculated fields
            final_by_op = {}
            for op, stats in by_op.items():
                count = stats["count"]
                final_by_op[op] = {
                    "count": count,
                    "correct": stats["correct"],
                    "accuracy": (stats["correct"] / count * 100) if count > 0 else 0.0,
                    "avgTime": (stats["total_time"] / count) if count > 0 else 0.0
                }

            return {
                "totalAttempts": total,
                "correctCount": correct,
                "incorrectCount": incorrect,
                "accuracy": accuracy,
                "averageTime": avg_time,
                "byOperation": final_by_op,
                "attempts": valid_attempts  # Include raw attempts for trend analysis
            }
        except Exception as e:
            print(f"Error computing attempt statistics: {e}")
            import traceback
            traceback.print_exc()
            return {
                "error": str(e),
                "totalAttempts": 0, 
                "correctCount": 0, 
                "incorrectCount": 0, 
                "accuracy": 0.0, 
                "averageTime": 0.0,
                "byOperation": {},
                "attempts": []
            }
