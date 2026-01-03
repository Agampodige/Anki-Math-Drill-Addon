"""
Adaptive Learning Analytics Module
Provides advanced analytics and insights for the adaptive learning system
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
try:
    from .database_api import db_api
except ImportError:
    from database_api import db_api


class AdaptiveAnalytics:
    """Advanced analytics for adaptive learning system"""
    
    def __init__(self):
        self.db_api = db_api
    
    def get_comprehensive_adaptive_report(self) -> Dict[str, Any]:
        """Generate comprehensive adaptive learning report"""
        try:
            # Get adaptive insights from database
            from .database import get_adaptive_learning_insights
            insights = get_adaptive_learning_insights()
            
            # Get personalized recommendations
            recommendations = self.db_api.get_adaptive_recommendations(10)
            
            # Get learning path
            learning_path = []  # Simplified for now
            
            # Get performance trends
            trends = self._analyze_performance_trends()
            
            # Get learning velocity
            velocity = self._calculate_learning_velocity()
            
            # Get difficulty progression
            progression = self._analyze_difficulty_progression()
            
            return {
                'insights': insights,
                'recommendations': recommendations,
                'learning_path': learning_path,
                'performance_trends': trends,
                'learning_velocity': velocity,
                'difficulty_progression': progression,
                'generated_at': datetime.now().isoformat()
            }
        except Exception as e:
            print(f"Error generating comprehensive report: {e}")
            return {'error': str(e), 'generated_at': datetime.now().isoformat()}
    
    def _analyze_performance_trends(self) -> Dict[str, Any]:
        """Analyze performance trends over time"""
        try:
            trends_data = self.db_api.get_performance_trends(days=30)
            
            if not trends_data:
                return {'trend': 'insufficient_data', 'accuracy_change': 0, 'speed_change': 0}
            
            # Calculate trend direction
            if len(trends_data) >= 7:
                recent_week = trends_data[-7:]
                earlier_week = trends_data[-14:-7] if len(trends_data) >= 14 else trends_data[:-7]
                
                recent_avg_accuracy = sum(t['accuracy'] for t in recent_week) / len(recent_week)
                earlier_avg_accuracy = sum(t['accuracy'] for t in earlier_week) / len(earlier_week)
                
                recent_avg_speed = sum(t['avg_time'] for t in recent_week) / len(recent_week)
                earlier_avg_speed = sum(t['avg_time'] for t in earlier_week) / len(earlier_week)
                
                accuracy_change = recent_avg_accuracy - earlier_avg_accuracy
                speed_change = recent_avg_speed - earlier_avg_speed
                
                # Determine trend
                if accuracy_change > 0.05 or speed_change < -0.2:
                    return 'improving'
                elif accuracy_change < -0.05 or speed_change > 0.2:
                    return 'declining'
                else:
                    return 'stable'
            
            return {'trend': 'insufficient_data', 'accuracy_change': 0, 'speed_change': 0}
            
        except Exception as e:
            print(f"Error analyzing performance trends: {e}")
            return {'trend': 'error', 'error': str(e)}
    
    def _calculate_learning_velocity(self) -> Dict[str, Any]:
        """Calculate learning velocity metrics"""
        try:
            # Get adaptive difficulty data from JSON
            import json_storage
            adaptive_data = json_storage._load_json_file(json_storage.ADAPTIVE_DIFFICULTY_FILE, [])
            
            # Calculate velocity metrics
            if not adaptive_data:
                return {'velocity_score': 0, 'improvement_rate': 0, 'consistency_score': 0}
            
            # Simple velocity calculation based on success rates
            total_success_rate = sum(item.get('success_rate', 0) for item in adaptive_data)
            avg_success_rate = total_success_rate / len(adaptive_data) if adaptive_data else 0
            
            return {
                'velocity_score': avg_success_rate * 100,
                'improvement_rate': avg_success_rate * 50,
                'consistency_score': 80 if avg_success_rate > 0.7 else 60
            }
            
        except Exception as e:
            print(f"Error calculating learning velocity: {e}")
            return {'velocity_score': 0, 'improvement_rate': 0, 'consistency_score': 0}
    
    def _analyze_difficulty_progression(self) -> Dict[str, Any]:
        """Analyze difficulty progression across skills"""
        try:
            # Get adaptive difficulty data from JSON
            import json_storage
            adaptive_data = json_storage._load_json_file(json_storage.ADAPTIVE_DIFFICULTY_FILE, [])
            
            if not adaptive_data:
                return {'progression': 'insufficient_data'}
            
            # Group by operation
            operation_progression = {}
            for item in adaptive_data:
                operation = item.get('operation', 'Unknown')
                difficulty = item.get('current_difficulty', 1.0)
                success_rate = item.get('success_rate', 0)
                
                if operation not in operation_progression:
                    operation_progression[operation] = []
                
                operation_progression[operation].append({
                    'difficulty': difficulty,
                    'success_rate': success_rate
                })
            
            return {
                'operation_progression': operation_progression,
                'total_skills': len(adaptive_data)
            }
            
        except Exception as e:
            print(f"Error analyzing difficulty progression: {e}")
            return {'progression': 'error', 'error': str(e)}
    
    def get_adaptive_recommendations_summary(self) -> Dict[str, Any]:
        """Get summary of adaptive recommendations"""
        try:
            recommendations = self.db_api.get_adaptive_recommendations(10)
            
            # Categorize recommendations
            high_priority = [r for r in recommendations if r.get('priority', '').startswith('High')]
            medium_priority = [r for r in recommendations if r.get('priority', '').startswith('Medium')]
            low_priority = [r for r in recommendations if r.get('priority', '').startswith('Low')]
            
            return {
                'total_recommendations': len(recommendations),
                'high_priority': len(high_priority),
                'medium_priority': len(medium_priority),
                'low_priority': len(low_priority),
                'recommendations': recommendations
            }
            
        except Exception as e:
            print(f"Error getting recommendations summary: {e}")
            return {'error': str(e)}
    
    def export_adaptive_data(self) -> Dict[str, Any]:
        """Export adaptive learning data for analysis"""
        try:
            # Get all adaptive difficulty data
            import json_storage
            adaptive_data = json_storage._load_json_file(json_storage.ADAPTIVE_DIFFICULTY_FILE, [])
            
            # Get comprehensive stats
            stats = self.db_api.get_comprehensive_stats('all')
            
            return {
                'adaptive_difficulty_data': adaptive_data,
                'comprehensive_stats': stats,
                'export_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error exporting adaptive data: {e}")
            return {'error': str(e)}


# Global analytics instance
adaptive_analytics = AdaptiveAnalytics()
