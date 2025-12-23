import sys
import random
import time
import threading
import winsound
from datetime import date, datetime
import math
from aqt.qt import QShortcut, QKeySequence
from aqt.qt import (
    QWidget, QLabel, QPushButton, QVBoxLayout, QHBoxLayout,
    QComboBox, QLineEdit, QFrame, QGridLayout, QSizePolicy,
    QGraphicsOpacityEffect, QDialog, QScrollArea, QProgressBar,
    QStackedWidget, QPainter, QPen, QColor, QFont, QFontDatabase,
    QLinearGradient, QBrush, QAction, QTimer, QRectF, Qt,
    QPropertyAnimation, QPoint, QEasingCurve, QParallelAnimationGroup,
    QSequentialAnimationGroup, pyqtSignal
)


from .database import init_db, log_attempt, log_session, get_last_7_days_stats, get_personal_best, get_total_attempts_count, get_today_attempts_count
from .analytics import get_today_stats
from .coach import SmartCoach
from .gamification import AchievementManager, AppSettings



# ----------------- THEME & STYLES -----------------

DARK_BG = "#0B0E0B"
CARD_BG = "#1A201A"
ACCENT_COLOR = "#2ECC71"  # Emerald Green
SUCCESS_COLOR = "#2ECC71"
ERROR_COLOR = "#FF6B6B"
TEXT_COLOR = "#ECF0F1"
MUTED_COLOR = "#4B5E4B"
SECONDARY_ACCENT = "#27AE60"

STYLESHEET = f"""
    QWidget {{
        background-color: {DARK_BG};
        color: {TEXT_COLOR};
        font-family: 'Segoe UI', 'Inter', sans-serif;
    }}
    QLabel {{ font-size: 16px; border: none; }}
    QLineEdit {{
        background-color: {CARD_BG};
        border: 2px solid {MUTED_COLOR};
        border-radius: 12px;
        padding: 15px;
        font-size: 32px;
        color: white;
        selection-background-color: {ACCENT_COLOR};
        selection-color: {DARK_BG};
    }}
    QLineEdit:focus {{
        border: 2px solid {ACCENT_COLOR};
        background-color: #1F271F;
    }}
    QComboBox {{
        background-color: {CARD_BG};
        border: 1px solid {MUTED_COLOR};
        border-radius: 8px;
        padding: 8px;
        min-width: 120px;
    }}
    QComboBox:hover {{
        border: 1px solid {ACCENT_COLOR};
    }}
    QPushButton {{
        background-color: {ACCENT_COLOR};
        color: {DARK_BG};
        font-weight: bold;
        border-radius: 10px;
        padding: 12px 20px;
        font-size: 15px;
        border: none;
    }}
    QPushButton:hover {{ 
        background-color: {SECONDARY_ACCENT};
        margin-top: -1px;
    }}
    QPushButton:pressed {{
        background-color: #1E8449;
        margin-top: 1px;
    }}
    QProgressBar {{
        border: none;
        background-color: #121812;
        border-radius: 6px;
        height: 10px;
        text-align: center;
    }}
    QProgressBar::chunk {{
        background-color: {ACCENT_COLOR};
        border-radius: 6px;
    }}
    QScrollArea {{
        border: none;
        background-color: transparent;
    }}
    .card {{
        background-color: {CARD_BG};
        border-radius: 12px;
        border: 1px solid #252F25;
    }}
    .status-card {{
        background-color: #121812;
        border-radius: 10px;
        border: 1px solid {CARD_BG};
    }}
    #GhostLine {{
        background-color: rgba(255, 255, 255, 0.4);
        width: 3px;
    }}
"""

# ----------------- WIDGETS -----------------

class FlashOverlay(QWidget):
    def __init__(self, parent):
        super().__init__(parent)
        self.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
        self.hide()
        
    def flash(self, color):
        if self.parent():
            self.resize(self.parent().size())
        self.setStyleSheet(f"background-color: {color}; border-radius: 12px;")
        self.show()
        
        effect = QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(effect)
        
        anim = QPropertyAnimation(effect, b"opacity")
        anim.setDuration(300)
        anim.setStartValue(0.3)
        anim.setEndValue(0.0)
        anim.setEasingCurve(QEasingCurve.Type.OutQuad)
        anim.finished.connect(self.hide)
        anim.start(QPropertyAnimation.DeletionPolicy.DeleteWhenStopped)

class ResultDialog(QDialog):
    def __init__(self, session_data, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Session Complete")
        self.setMinimumSize(400, 500)
        self.resize(450, 600)
        self.setStyleSheet(STYLESHEET)
        self.retake_requested = False
        
        layout = QVBoxLayout(self)
        
        # Title
        title = QLabel("Session Complete!")
        title.setStyleSheet(f"font-size: 24px; font-weight: bold; color: {SUCCESS_COLOR};")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        # Stats Grid
        grid_frame = QFrame()
        grid_frame.setStyleSheet(f"background-color: {DARK_BG}; border-radius: 12px; border: 1px solid {CARD_BG};")
        grid = QGridLayout(grid_frame)
        grid.setContentsMargins(15, 15, 15, 15)
        grid.setSpacing(15)
        
        def add_stat(label, val, row, col, is_main=False):
            l_lbl = QLabel(label)
            l_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
            v_lbl = QLabel(val)
            v_lbl.setStyleSheet(f"color: {SUCCESS_COLOR if is_main else TEXT_COLOR}; font-size: {'24px' if is_main else '18px'}; font-weight: bold;")
            grid.addWidget(l_lbl, row, col)
            grid.addWidget(v_lbl, row+1, col)
        
        accuracy = (session_data['correct'] / session_data['total'] * 100) if session_data['total'] > 0 else 0
        
        

        add_stat("Accuracy", f"{accuracy:.1f}%", 0, 0, True)
        add_stat("Avg Speed", f"{session_data['avg_speed']:.2f}s", 0, 1)
        add_stat("Total Questions", f"{session_data['total']}", 2, 0)
        add_stat("Total Time", f"{session_data['total_time']:.1f}s", 2, 1)
        
        layout.addWidget(grid_frame)
        
        # Mistakes
        if session_data['mistakes']:
            m_lbl = QLabel("Mistakes Review")
            m_lbl.setStyleSheet(f"color: {ACCENT_COLOR}; font-weight: bold; margin-top: 5px;")
            layout.addWidget(m_lbl)
            
            scroll = QScrollArea()
            scroll.setWidgetResizable(True)
            scroll.setFixedHeight(120)
            content = QWidget()
            vbox = QVBoxLayout(content)
            for m in session_data['mistakes']:
                lbl = QLabel(f"• {m[0]} = {m[1]} (You: {m[2]})")
                lbl.setStyleSheet(f"color: {ERROR_COLOR}; font-size: 13px;")
                vbox.addWidget(lbl)
            scroll.setWidget(content)
            layout.addWidget(scroll)
        else:
            p_lbl = QLabel("Perfect Session! 🎉")
            p_lbl.setStyleSheet(f"color: {ACCENT_COLOR}; font-size: 18px; font-weight: bold;")
            p_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout.addWidget(p_lbl)
            
        layout.addStretch()

        # Buttons
        btn_box = QVBoxLayout()
        btn_box.setSpacing(10)
        
        if session_data['mistakes']:
            retake_btn = QPushButton("🔁 Retake Mistakes")
            retake_btn.setMinimumHeight(50)
            retake_btn.setStyleSheet(f"background-color: {SECONDARY_ACCENT}; color: white; font-weight: bold; font-size: 16px;")
            retake_btn.clicked.connect(self.request_retake)
            btn_box.addWidget(retake_btn)

        close_btn = QPushButton("Stop Review & Close (Esc)")
        close_btn.setMinimumHeight(45)
        close_btn.setStyleSheet(f"background-color: {ACCENT_COLOR}; color: {DARK_BG}; font-weight: bold;")
        close_btn.clicked.connect(self.accept)
        btn_box.addWidget(close_btn)
        
        layout.addLayout(btn_box)

    def request_retake(self):
        self.retake_requested = True
        self.accept()
        
    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Escape:
            self.accept()
        super().keyPressEvent(event)

class AnalyticsChart(QWidget):
    def __init__(self):
        super().__init__()
        self.setMinimumHeight(120)
        self.data_points = []

    def update_data(self):
        self.data_points = get_last_7_days_stats()
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        if not self.data_points:
            painter.setPen(QPen(QColor(MUTED_COLOR)))
            painter.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, "No recent activity")
            return

        counts = [row[1] for row in self.data_points]
        max_count = max(counts) if counts else 1
        
        w, h = self.width(), self.height()
        bar_width = (w / 7) - 10
        start_x = w - (len(self.data_points) * (bar_width + 10))
        
        for i, (date_str, count, correct_sum) in enumerate(self.data_points):
            accuracy = correct_sum / count if count > 0 else 0
            bar_h = (count / max_count) * (h - 25)
            if bar_h < 4: bar_h = 4 
            
            x = start_x + i * (bar_width + 10)
            y = h - bar_h - 20
            
            color = QColor(ACCENT_COLOR) if accuracy >= 0.9 else (QColor("#e67e22") if accuracy >= 0.7 else QColor(ERROR_COLOR))
            
            painter.setBrush(QBrush(color))
            painter.setPen(Qt.PenStyle.NoPen)
            painter.drawRoundedRect(QRectF(x, y, bar_width, bar_h), 6, 6)
            
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                label = dt.strftime("%a") # Day name
            except: label = "?"
            
            painter.setPen(QPen(QColor(MUTED_COLOR)))
            painter.drawText(QRectF(x, h - 18, bar_width, 18), Qt.AlignmentFlag.AlignCenter, label)

class SettingsDialog(QDialog):
    def __init__(self, settings, parent=None):
        super().__init__(parent)
        self.settings = settings
        self.setWindowTitle("Settings")
        self.setMinimumSize(300, 200)
        self.setStyleSheet(STYLESHEET)
        
        layout = QVBoxLayout(self)
        
        title = QLabel("Preferences")
        title.setStyleSheet(f"font-size: 18px; font-weight: bold; color: {ACCENT_COLOR};")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        # Sound Toggle
        self.sound_btn = QPushButton(f"Sound Effects: {'ON' if settings.sound_enabled else 'OFF'}")
        self.sound_btn.clicked.connect(self.toggle_sound)
        layout.addWidget(self.sound_btn)
        
        close = QPushButton("Close")
        close.clicked.connect(self.accept)
        layout.addWidget(close)
        
    def toggle_sound(self):
        self.settings.sound_enabled = not self.settings.sound_enabled
        self.sound_btn.setText(f"Sound Effects: {'ON' if self.settings.sound_enabled else 'OFF'}")

class AchievementDialog(QDialog):
    def __init__(self, manager, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Achievements")
        self.setMinimumSize(500, 600)
        self.resize(550, 700)
        self.setStyleSheet(STYLESHEET)
        
        layout = QVBoxLayout(self)
        
        title = QLabel("🏆 Your Trophy Case")
        title.setStyleSheet(f"font-size: 20px; font-weight: bold; color: #e0af68;")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("border: none;")
        
        content = QWidget()
        vbox = QVBoxLayout(content)
        vbox.setSpacing(10)
        
        badges = manager.get_all_badges_status()
        
        for b in badges:
            card = QFrame()
            # Style: emerald border if unlocked, gray if locked
            border_col = ACCENT_COLOR if b['unlocked'] else MUTED_COLOR
            opacity = "1.0" if b['unlocked'] else "0.5"
            bg_col = "#121812"
            
            card.setStyleSheet(f"""
                QFrame {{
                    background-color: {bg_col};
                    border: 2px solid {border_col};
                    border-radius: 12px;
                    opacity: {opacity};
                }}
            """)
            card.setMinimumHeight(80)
            
            h = QHBoxLayout(card)
            
            icon = QLabel("🏆" if b['unlocked'] else "🔒")
            icon.setStyleSheet("font-size: 32px; border: none;")
            h.addWidget(icon)
            
            text_v = QVBoxLayout()
            name = QLabel(b['name'])
            name.setStyleSheet(f"font-weight: bold; font-size: 16px; color: {border_col}; border: none;")
            desc = QLabel(b['desc'])
            desc.setStyleSheet(f"color: {TEXT_COLOR}; border: none;")
            desc.setWordWrap(True)
            
            text_v.addWidget(name)
            text_v.addWidget(desc)
            h.addLayout(text_v)
            
            vbox.addWidget(card)
            
        scroll.setWidget(content)
        layout.addWidget(scroll)
        
        close = QPushButton("Close")
        close.clicked.connect(self.accept)
        layout.addWidget(close)

class MasteryDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Skill Mastery Matrix")
        self.setMinimumSize(600, 500)
        self.resize(700, 600)
        self.setStyleSheet(STYLESHEET)
        
        layout = QVBoxLayout(self)
        
        # Header
        header = QLabel("Your Math Skills Profile")
        header.setStyleSheet(f"font-size: 20px; font-weight: bold; color: {ACCENT_COLOR}; margin-bottom: 10px;")
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(header)
        
        # Grid
        grid_frame = QFrame()
        grid_frame.setStyleSheet(f"background-color: {CARD_BG}; border-radius: 10px;")
        grid = QGridLayout(grid_frame)
        grid.setSpacing(10)
        
        coach = SmartCoach()
        data = coach.get_mastery_grid_data()
        
        ops = ["Addition", "Subtraction", "Multiplication", "Division"]
        digits = [1, 2, 3]
        
        # Headers
        for i, d in enumerate(digits):
            lbl = QLabel(f"{d} Digit")
            lbl.setStyleSheet(f"font-weight: bold; color: {MUTED_COLOR};")
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            grid.addWidget(lbl, 0, i+1)
            
        for i, op in enumerate(ops):
            lbl = QLabel(op)
            lbl.setStyleSheet(f"font-weight: bold; color: {MUTED_COLOR};")
            grid.addWidget(lbl, i+1, 0)
            
            for j, d in enumerate(digits):
                stats = data.get((op, d), {'level': 'Novice', 'acc': 0, 'speed': 0, 'count': 0})
                
                # Card
                card = QFrame()
                lvl = stats['level']
                color = "#2C3E50" # Novice (Darker)
                if lvl == "Apprentice": color = "#27AE60" # Nephritis
                elif lvl == "Pro": color = "#2ECC71" # Emerald
                elif lvl == "Master": color = "#F1C40F" # Gold
                
                card.setStyleSheet(f"""
                    background-color: {color}; 
                    border-radius: 8px;
                    color: {DARK_BG if lvl != "Novice" else TEXT_COLOR};
                """)
                card.setFixedSize(130, 80)
                
                vbox = QVBoxLayout(card)
                vbox.setContentsMargins(5,5,5,5)
                vbox.setSpacing(2)
                
                lvl_lbl = QLabel(lvl.upper())
                lvl_lbl.setStyleSheet("font-weight: bold; font-size: 12px;")
                lvl_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
                
                detail = QLabel(f"{stats['acc']:.0f}% | {stats['speed']:.1f}s")
                detail.setStyleSheet("font-size: 11px;")
                detail.setAlignment(Qt.AlignmentFlag.AlignCenter)
                
                count_lbl = QLabel(f"({stats['count']} plays)")
                count_lbl.setStyleSheet("font-size: 10px; opacity: 0.8;")
                count_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)

                vbox.addWidget(lvl_lbl)
                vbox.addWidget(detail)
                vbox.addWidget(count_lbl)
                
                grid.addWidget(card, i+1, j+1)
                
        layout.addWidget(grid_frame)
        
        # Legend
        legend = QLabel("Legend: Novice (Need practice) → Apprentice (Fix errors) → Pro (Speed up) → Master (Perfect)")
        legend.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px; margin-top: 10px;")
        legend.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(legend)
        
        # Close
        btn = QPushButton("Close")
        btn.clicked.connect(self.accept)
        layout.addWidget(btn, alignment=Qt.AlignmentFlag.AlignCenter)

# ----------------- MAIN APP -----------------

class MathDrill(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        init_db()
        self.setWindowFlags(Qt.WindowType.Window)
        self.setWindowTitle("Math Drill")
        self.setMinimumSize(450, 650)
        self.resize(500, 750)
        # Session State
        self.session_mode = "Free Play" # Free Play, Drill 20, Sprint 60s
        self.session_target = 0
        self.session_active = False # For timed modes
        
        self.session_attempts = [] # List of {'correct': bool, 'time': float}
        self.session_mistakes = [] # List of tuples: (q_label_text, answer, user_text)
        self.session_start_time = None
        

        # QShortcut(QKeySequence("Esc"), self).activated.connect(lambda: self.clear_or_reset())
        # QShortcut(QKeySequence("Ctrl+Q"), self).activated.connect(self.end_session)
        # QShortcut(QKeySequence("M"), self).activated.connect(self.toggle_mode)
        # QShortcut(QKeySequence("O"), self).activated.connect(self.toggle_operation)
        # QShortcut(QKeySequence("1"), self).activated.connect(lambda: self.digits_box.setCurrentIndex(0))
        # QShortcut(QKeySequence("2"), self).activated.connect(lambda: self.digits_box.setCurrentIndex(1))
        # QShortcut(QKeySequence("3"), self).activated.connect(lambda: self.digits_box.setCurrentIndex(2))



        # Retake State
        self.retake_active = False
        self.retake_queue = [] # List of tuples: (q_text, answer)
        self.retake_mastery = {} # q_text -> count (1 or 2)
        
        self.settings_manager = AppSettings()
        self.achievements = AchievementManager()
        
        self.streak = 0
        self.current_operation = None
        self.start_time = None
        self.a = 0
        self.b = 0
        self.answer = 0
        
        self.current_pb = None
        
        self.init_ui()
        self.apply_theme()
        self.refresh_stats()
        
    def apply_theme(self):
        self.setStyleSheet(STYLESHEET)    

    def init_ui(self):
        self.setWindowTitle("Math Drill Pro")
        self.setMinimumSize(450, 650)
        self.resize(500, 750)
        
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(15)
        main_layout.setContentsMargins(25, 25, 25, 25)

        # Header
        header_layout = QHBoxLayout()
        title = QLabel("MATH DRILL")
        title.setStyleSheet(f"color: {ACCENT_COLOR}; font-weight: bold; font-size: 14px; letter-spacing: 2px;")
        
        self.streak_label = QLabel("🔥 0")
        self.streak_label.setStyleSheet("color: #FF9F1C; font-weight: bold; font-size: 18px;")
        
        header_layout.addWidget(title)
        
        # Buttons
        btn_style = f"background-color: {CARD_BG}; color: {TEXT_COLOR}; border: 1px solid {MUTED_COLOR}; font-size: 12px; padding: 6px; border-radius: 6px;"
        
        prog_btn = QPushButton("📊 Progress")
        prog_btn.setStyleSheet(btn_style)
        prog_btn.clicked.connect(self.show_mastery)
        prog_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        
        trophy_btn = QPushButton("🏆")
        trophy_btn.setToolTip("Achievements")
        trophy_btn.setStyleSheet(btn_style)
        trophy_btn.setFixedSize(34, 34)
        trophy_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        trophy_btn.clicked.connect(self.show_achievements)
        
        set_btn = QPushButton("⚙️")
        set_btn.setToolTip("Settings")
        set_btn.setStyleSheet(btn_style)
        set_btn.setFixedSize(34, 34)
        set_btn.clicked.connect(self.show_settings)
        set_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
    
        
        header_layout.addWidget(prog_btn)
        header_layout.addWidget(trophy_btn)
        header_layout.addWidget(set_btn)
        
        header_layout.addStretch()
        header_layout.addWidget(self.streak_label)
        
        # --- Control Card ---
        self.control_card = QFrame()
        self.control_card.setProperty("class", "card")
        control_layout = QHBoxLayout(self.control_card)
        control_layout.setContentsMargins(15, 5, 15, 5)
        control_layout.setSpacing(10)
        
        self.mode_box = QComboBox()
        self.mode_box.addItems(["Free Play", "Drill (20 Qs)", "Sprint (60s)", "Adaptive Coach"])
        self.mode_box.currentTextChanged.connect(self.reset_session)
        
        self.operation_box = QComboBox()
        self.operation_box.addItems(["Addition", "Subtraction", "Multiplication", "Division", "Mixed"])
        
        self.digits_box = QComboBox()
        self.digits_box.addItems(["1 digit", "2 digits", "3 digits"])
        self.digits_box.setCurrentIndex(1)
        
        for w in [self.mode_box, self.operation_box, self.digits_box]:
            w.setFocusPolicy(Qt.FocusPolicy.NoFocus)
            w.setMinimumWidth(100)
            w.setStyleSheet("font-size: 11px; padding: 4px;")

        control_layout.addWidget(self.mode_box)
        control_layout.addWidget(self.operation_box)
        control_layout.addWidget(self.digits_box)
        
        # --- Enhanced Stats Card ---
        self.status_card = QFrame()
        self.status_card.setProperty("class", "status-card")
        status_layout = QVBoxLayout(self.status_card)
        status_layout.setContentsMargins(15, 10, 15, 10)
        status_layout.setSpacing(8)
        
        # Stats Row with three counters
        stats_row = QHBoxLayout()
        stats_row.setSpacing(12)
        
        # Session Counter
        session_frame = QFrame()
        session_frame.setStyleSheet(f"background-color: rgba(126, 200, 80, 0.1); border-radius: 8px; padding: 8px;")
        session_layout = QVBoxLayout(session_frame)
        session_layout.setContentsMargins(10, 6, 10, 6)
        session_layout.setSpacing(2)
        
        session_icon = QLabel("📝")
        session_icon.setStyleSheet("font-size: 18px;")
        session_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        self.session_count_label = QLabel("0")
        self.session_count_label.setStyleSheet(f"color: {ACCENT_COLOR}; font-size: 24px; font-weight: bold;")
        self.session_count_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        session_text = QLabel("Session")
        session_text.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 10px;")
        session_text.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        session_layout.addWidget(session_icon)
        session_layout.addWidget(self.session_count_label)
        session_layout.addWidget(session_text)
        
        # Today Counter
        today_frame = QFrame()
        today_frame.setStyleSheet(f"background-color: rgba(224, 175, 104, 0.1); border-radius: 8px; padding: 8px;")
        today_layout = QVBoxLayout(today_frame)
        today_layout.setContentsMargins(10, 6, 10, 6)
        today_layout.setSpacing(2)
        
        today_icon = QLabel("📅")
        today_icon.setStyleSheet("font-size: 18px;")
        today_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        self.today_count_label = QLabel("0")
        self.today_count_label.setStyleSheet(f"color: #e0af68; font-size: 24px; font-weight: bold;")
        self.today_count_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        today_text = QLabel("Today")
        today_text.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 10px;")
        today_text.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        today_layout.addWidget(today_icon)
        today_layout.addWidget(self.today_count_label)
        today_layout.addWidget(today_text)
        
        # Lifetime Counter
        lifetime_frame = QFrame()
        lifetime_frame.setStyleSheet(f"background-color: rgba(125, 207, 255, 0.1); border-radius: 8px; padding: 8px;")
        lifetime_layout = QVBoxLayout(lifetime_frame)
        lifetime_layout.setContentsMargins(10, 6, 10, 6)
        lifetime_layout.setSpacing(2)
        
        lifetime_icon = QLabel("🎯")
        lifetime_icon.setStyleSheet("font-size: 18px;")
        lifetime_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        self.lifetime_count_label = QLabel("0")
        self.lifetime_count_label.setStyleSheet(f"color: #7dcfff; font-size: 24px; font-weight: bold;")
        self.lifetime_count_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        lifetime_text = QLabel("Lifetime")
        lifetime_text.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 10px;")
        lifetime_text.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        lifetime_layout.addWidget(lifetime_icon)
        lifetime_layout.addWidget(self.lifetime_count_label)
        lifetime_layout.addWidget(lifetime_text)
        
        stats_row.addWidget(session_frame, 1)
        stats_row.addWidget(today_frame, 1)
        stats_row.addWidget(lifetime_frame, 1)
        
        status_layout.addLayout(stats_row)
        
        # Additional stats (accuracy, speed) - smaller text below
        self.stats_detail_label = QLabel("Start answering to see stats")
        self.stats_detail_label.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 11px;")
        self.stats_detail_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        status_layout.addWidget(self.stats_detail_label)
        
        # Progress bar for drill/sprint modes
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setFixedHeight(6)
        self.progress_bar.setTextVisible(False)
        
        # Ghost Indicator (Subtle line on the bar)
        self.ghost_line = QFrame(self.progress_bar)
        self.ghost_line.setObjectName("GhostLine")
        self.ghost_line.hide()
        
        self.progress_label = QLabel("")
        self.progress_label.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 11px;")
        self.progress_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        status_layout.addWidget(self.progress_label)
        status_layout.addWidget(self.progress_bar)

        # --- Challenge Area ---
        self.challenge_card = QFrame()
        self.challenge_card.setProperty("class", "card")
        self.challenge_card.setStyleSheet(f"background-color: #182218;") # Slightly darker/greener
        challenge_vbox = QVBoxLayout(self.challenge_card)
        challenge_vbox.setSpacing(10)
        challenge_vbox.setContentsMargins(20, 20, 20, 20)

        self.question_num_label = QLabel("")
        self.question_num_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.question_num_label.setStyleSheet(f"color: {ACCENT_COLOR}; font-size: 11px; font-weight: bold; letter-spacing: 1px;")
        challenge_vbox.addWidget(self.question_num_label)
        
        # Small timer display
        self.time_display_label = QLabel("⏱ 0.0s")
        self.time_display_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.time_display_label.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 10px; opacity: 0.7;")
        challenge_vbox.addWidget(self.time_display_label)



        self.question_label = QLabel("Ready?")
        self.question_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.question_label.setStyleSheet("font-size: 56px; font-weight: bold; color: white; background: transparent; border: none;")
        challenge_vbox.addWidget(self.question_label)

        self.answer_input = QLineEdit()
        self.answer_input.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.answer_input.setPlaceholderText("?")
        self.answer_input.returnPressed.connect(self.check_answer)
        self.answer_input.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.answer_input.setFocus()
        self.answer_input.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.answer_input.setMinimumHeight(80)
        challenge_vbox.addWidget(self.answer_input)

        # Feedback
        self.feedback_label = QLabel("Press Enter to Start")
        self.feedback_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.feedback_label.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 14px; background: transparent;")
        
        # --- Shortcut Hints ---
        self.hint_bar = QLabel("[M] Mode  [O] Op  [1-3] Digits  [S] Settings  [A] Awards  [P] Progress  [Esc] Clear  [Ctrl+Q] End Session")
        self.hint_bar.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.hint_bar.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 11px; margin-top: 5px;")

        main_layout.addLayout(header_layout)
        
        # Subtle Coach Info in Header (Instead of a big floating label)
        self.coach_label = QLabel("")
        self.coach_label.setStyleSheet(f"color: {MUTED_COLOR}; font-style: italic; font-size: 11px;")
        self.coach_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header_layout.insertWidget(1, self.coach_label)

        main_layout.addWidget(self.control_card)
        main_layout.addWidget(self.status_card)
        main_layout.addWidget(self.challenge_card)
        main_layout.addWidget(self.feedback_label)

        main_layout.addStretch()
        main_layout.addWidget(self.hint_bar)
        
        # Overlays
        self.flash_overlay = FlashOverlay(self)
        
        # Session Timer (for Sprint mode)
        self.session_timer = QTimer(self)
        self.session_timer.timeout.connect(self.check_session_end)
        self.session_timer.setInterval(1000)

        #short Keys
        self.award_shortcut = QShortcut(QKeySequence("A"), self)
        # This prevents it from triggering while typing or by accident
        self.award_shortcut.setContext(Qt.ShortcutContext.WidgetWithChildrenShortcut)
        self.award_shortcut.activated.connect(self.show_achievements)
        self.settings_shortcut = QShortcut(QKeySequence("S"), self)
        self.settings_shortcut.setContext(Qt.ShortcutContext.WidgetWithChildrenShortcut)
        self.settings_shortcut.activated.connect(self.show_settings)
        # Add a dedicated timer for the ⏱ display
        self.ui_tick_timer = QTimer(self)
        self.ui_tick_timer.timeout.connect(self.update_live_timer)
        self.ui_tick_timer.start(100) # Update every 100ms for smoothness

    def update_live_timer(self):
        if self.start_time:
            elapsed = time.time() - self.start_time
            self.time_display_label.setText(f"⏱ {elapsed:.1f}s")
        else:
            self.time_display_label.setText("⏱ 0.0s")

    def keyPressEvent(self, event):
        key = event.key()
        
        # Reset / Clear
        if key == Qt.Key.Key_Escape:
            self.answer_input.clear()
            if self.session_active:
                self.reset_session()
            return
            
        # End Session Early (Ctrl+Q)
        if event.modifiers() & Qt.KeyboardModifier.ControlModifier and key == Qt.Key.Key_Q:
            if self.session_active:
                self.end_session()
            return
            
        # Dialogs
        if key == Qt.Key.Key_S:
            self.show_settings()
        elif key == Qt.Key.Key_A:
            self.show_achievements()
        elif key == Qt.Key.Key_P:
            self.show_mastery()
            
        # Difficulty (Digits)
        elif key == Qt.Key.Key_1:
            self.digits_box.setCurrentIndex(0)
        elif key == Qt.Key.Key_2:
            self.digits_box.setCurrentIndex(1)
        elif key == Qt.Key.Key_3:
            self.digits_box.setCurrentIndex(2)
            
        # Toggle Mode
        elif key == Qt.Key.Key_M:
            idx = (self.mode_box.currentIndex() + 1) % self.mode_box.count()
            self.mode_box.setCurrentIndex(idx)
            
        # Toggle Operation
        elif key == Qt.Key.Key_O:
            idx = (self.operation_box.currentIndex() + 1) % self.operation_box.count()
            self.operation_box.setCurrentIndex(idx)
            
        super().keyPressEvent(event)

    def reset_session(self):
        self.session_attempts = []
        self.session_mistakes = []
        self.session_active = False
        self.session_start_time = None
        self.retake_active = False
        self.session_timer.stop()
        self.progress_bar.setValue(0)
        self.streak = 0
        self.streak_label.setText("🔥 0")
        self.start_time = None
        
        mode = self.mode_box.currentText()
        
        # Default State
        self.operation_box.setEnabled(True)
        self.digits_box.setEnabled(True)
        self.coach_label.hide()
        
        if mode == "Adaptive Coach":
            self.operation_box.setEnabled(False)
            self.digits_box.setEnabled(False)
            self.coach_label.show()
            self.coach_label.setText("Coach is analyzing your skills...")
        
        if "Drill" in mode:
            self.session_target = 20
            self.progress_bar.setMaximum(20)
            self.progress_bar.setVisible(True)
            self.progress_label.setText("0 / 20 Questions")
        elif "Sprint" in mode:
            self.session_target = 60
            self.progress_bar.setMaximum(60)
            self.progress_bar.setVisible(True)
            self.progress_label.setText("60s Remaining")
        else:
            self.session_target = 0
            self.progress_bar.setVisible(False)
            self.progress_label.setText("Free Play")
            
        self.question_label.setText("Ready?")
        self.feedback_label.setText("Press Enter to Start")
        self.answer_input.clear()


    def start_session_if_needed(self):
        if not self.session_active and self.mode_box.currentText() != "Free Play":
            self.session_active = True
            self.session_attempts = []
            self.session_mistakes = []
            self.session_start_time = datetime.now()
            
            if "Sprint" in self.mode_box.currentText():
                self.session_timer.start()
            
            # Fetch PB
            mode = self.mode_box.currentText()
            op = self.operation_box.currentText()
            dig = int(self.digits_box.currentText().split()[0])
            self.current_pb = get_personal_best(mode, op, dig)
            
            if self.current_pb:
                self.ghost_line.show()
                self.update_ghost_pos()
            else:
                self.ghost_line.hide()

    def check_session_end(self):
        mode = self.mode_box.currentText()
        if "Sprint" in mode and self.session_active:
             remaining = self.session_target - (datetime.now() - self.session_start_time).total_seconds()
             self.progress_bar.setValue(int(60 - remaining))
             self.progress_label.setText(f"{int(remaining)}s Remaining")
             self.update_ghost_pos()
             
             if remaining <= 0:
                 self.end_session()

    def end_session(self):
        self.session_active = False
        self.session_timer.stop()

        self.answer_input.setReadOnly(True)
        
        # Calculate Stats
        total = len(self.session_attempts)
        correct = sum(1 for a in self.session_attempts if a['correct'])
        # session_attempts is list of dicts: {'correct': bool, 'time': float}
        total_time = sum(a['time'] for a in self.session_attempts)
        avg_speed = total_time / total if total else 0
        
        # Log Session
        mode = self.mode_box.currentText()
        op = self.operation_box.currentText()
        dig = int(self.digits_box.currentText().split()[0])
        sid = log_session(mode, op, dig, self.session_target, total, correct, avg_speed)
        
        # Check Achievements
        session_data = {
            'mode': mode,
            'total': total,
            'correct': correct,
            'avg_speed': avg_speed,
            'total_time': total_time,
            'operation': self.operation_box.currentText()
        }
        new_badges = self.achievements.check_achievements(session_data)
        
        # Show Dialog
        data = {
            'total': total,
            'correct': correct,
            'avg_speed': avg_speed,
            'total_time': total_time,
            'mistakes': self.session_mistakes
        }
        dlg = ResultDialog(data, self)
        dlg.exec()
        
        if dlg.retake_requested:
            # Mistake review in ResultDialog: (question_label.text(), self.answer, user_text)
            # We want unique (question_label_text, true_answer)
            unique_mistakes = []
            seen = set()
            for m in self.session_mistakes:
                if m[0] not in seen:
                    unique_mistakes.append((m[0], m[1]))
                    seen.add(m[0])
            self.start_retake(unique_mistakes)
            return

        # Show Badges Overlay if any
        if new_badges:
            # Simple popup (or we could integrate into ResultDialog)
            # Let's verify by just printing or a simple toast.
            # Ideally we have a specific modal.
            self.show_achievement_toast(new_badges)
        
        self.reset_session()
        self.answer_input.setReadOnly(False)
        self.answer_input.setFocus()
        self.refresh_stats()

    def start_retake(self, mistakes):
        self.retake_active = True
        self.retake_queue = mistakes
        self.retake_mastery = {m[0]: 0 for m in mistakes}
        self.session_attempts = [] # Reset counters for retake session
        self.session_mistakes = []
        self.generate_question()

    def update_progress(self):
        mode = self.mode_box.currentText()
        count = len(self.session_attempts)
        
        if "Drill" in mode:
            self.progress_bar.setValue(count)
            self.progress_label.setText(f"{count} / {self.session_target}")
            self.update_ghost_pos()
            if count >= self.session_target:
                self.end_session()

    def generate_question(self):
        if not self.retake_active:
            self.start_session_if_needed()
        
        # Retake Logic
        if self.retake_active:
            if not self.retake_queue:
                # Finished retake!
                self.retake_active = False
                self.feedback_label.setText("🌟 MASTERY COMPLETE! 🌟")
                self.feedback_label.setStyleSheet(f"color: {ACCENT_COLOR}; font-weight: bold;")
                self.question_num_label.setText("ALL MISTAKES MASTERED")
                self.question_label.setText("Perfect!")
                return

            q_text, q_ans = self.retake_queue[0]
            self.answer = q_ans
            self.question_label.setText(q_text)
            
            # Subtitle for progress
            count = len(self.retake_queue)
            mastered = sum(1 for v in self.retake_mastery.values() if v >= 2)
            self.question_num_label.setText(f"RETAKE MODE: {count} Left ({mastered} Mastered)")
            
            self.answer_input.setReadOnly(False)
            self.answer_input.clear()
            self.answer_input.setFocus()
            self.feedback_label.setText("Get each right twice in a row!")
            

            self.start_time = time.time()
            return

        # Coach Override
        if self.mode_box.currentText() == "Adaptive Coach":
            coach = SmartCoach()
            target, reason = coach.get_recommendation()
            # target is (Op, Digits) e.g. ("Addition", 1)
            
            # Update UI visibly (disabled)
            self.operation_box.setCurrentText(target[0])
            idx = target[1] - 1
            if idx < 0: idx = 0
            if idx >= self.digits_box.count(): idx = self.digits_box.count() - 1
            self.digits_box.setCurrentIndex(idx)
            
            self.coach_label.setText(f"Coach: {target[0]} ({target[1]} digits) - {reason}")
        
        self.answer_input.setReadOnly(False)
        self.answer_input.clear()
        self.answer_input.setFocus()
        self.feedback_label.setText("")
        
        operation = self.operation_box.currentText()
        text = self.digits_box.currentText()
        digits = int(text.split()[0])
        
        if operation == "Mixed":
            # Pick random real operation
            operation = random.choice(["Addition", "Subtraction", "Multiplication", "Division"])
            # Visual hint? Maybe in the question label?
            # We don't change the box because that's the setting.
        
        low = 10 ** (digits - 1)
        if digits == 1: low = 2
        high = (10 ** digits) - 1
        
        if operation == "Division":
            b_low = 2
            b_high = 12 if digits == 1 else (10**(digits-1) -1 if digits > 2 else 20)
            if digits == 2: b_high = 20
            if digits == 3: b_high = 50
            self.b = random.randint(b_low, max(b_low+1, b_high))
            
            ans_low = 2 
            ans_high = high 
            if digits >= 2: ans_high = 20
            self.answer = random.randint(ans_low, ans_high)
            self.a = self.b * self.answer
            symbol = "÷"
        else:
            self.a = random.randint(low, high)
            self.b = random.randint(low, high)
            if operation == "Addition":
                self.answer = self.a + self.b
                symbol = "+"
            elif operation == "Subtraction":
                if self.a < self.b: self.a, self.b = self.b, self.a
                self.answer = self.a - self.b
                symbol = "−"
            elif operation == "Multiplication":
                self.answer = self.a * self.b
                symbol = "×"

        # Update Question Number
        count = len(self.session_attempts) + 1
        mode = self.mode_box.currentText()
        if "Drill" in mode:
            self.question_num_label.setText(f"QUESTION {count} OF {self.session_target}")
        elif "Sprint" in mode:
            self.question_num_label.setText(f"SPRINT MODE - Q#{count}")
        else:
            self.question_num_label.setText(f"QUESTION #{count}")

        self.question_label.setText(f"{self.a} {symbol} {self.b} =")
        
        self.start_time = time.time()
        
    def play_sound(self, success):
        if not self.settings_manager.sound_enabled:
            return
            
        def worker():
            try:
                if success:
                    winsound.Beep(1000, 100) # High pitch, short
                else:
                    winsound.Beep(400, 300)  # Low pitch, long
            except:
                pass 
        threading.Thread(target=worker, daemon=True).start()

    def show_achievement_toast(self, badges):
        # Quick modal
        dlg = QDialog(self)
        dlg.setWindowTitle("🏆 Achievement Unlocked!")
        dlg.setStyleSheet(STYLESHEET)
        lay = QVBoxLayout(dlg)
        for b in badges:
            lbl = QLabel(f"UNLOCKED: {b['name']}\n{b['desc']}")
            lbl.setStyleSheet(f"color: #e0af68; font-weight: bold; font-size: 16px; padding: 10px;")
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            lay.addWidget(lbl)
        btn = QPushButton("Awesome!")
        btn.clicked.connect(dlg.accept)
        lay.addWidget(btn)
        dlg.exec()

    def show_achievements(self):
        dlg = AchievementDialog(self.achievements, self)
        dlg.exec()

        self.answer_input.setFocus()
        
    def show_settings(self):
        dlg = SettingsDialog(self.settings_manager, self)
        dlg.exec()
        self.answer_input.setFocus()
        
    def check_answer(self):
        if self.start_time is None:
            self.generate_question()
            return

        user_text = self.answer_input.text().strip()
        if not user_text: return

        elapsed = time.time() - self.start_time
        try:
            val = float(user_text)
            correct = abs(val - self.answer) < 0.001
        except ValueError:
            correct = False
            
        # Log Attempt
        op = self.operation_box.currentText()
        dig = int(self.digits_box.currentText().split()[0])
        # TODO: Pass session_id if we had it easily accessible, or just rely on global tracking
        # For now we log to DB without session ID for individual attempts to avoid complexity
        # or we could fetch the last session ID. 
        # Actually, let's just log fully compliant data.
        log_attempt(op, dig, int(correct), elapsed) # We can add session_id later if needed
        
        # Track Session Data
        self.session_attempts.append({'correct': correct, 'time': elapsed})
        
        self.play_sound(correct)
        
        if correct:
            self.streak += 1
            self.feedback_label.setText(f"Correct! ({elapsed:.2f}s)")
            self.feedback_label.setStyleSheet(f"color: {SUCCESS_COLOR};")
            self.flash_overlay.flash(SUCCESS_COLOR)
            
            self.answer_input.setReadOnly(True)
            
            if self.retake_active:
                q_text = self.question_label.text()
                self.retake_mastery[q_text] += 1
                if self.retake_mastery[q_text] >= 2:
                    # Remove from queue
                    self.retake_queue.pop(0)
                    self.feedback_label.setText("✅ MASTERED!")
                else:
                    # Move to end of queue to rotate
                    item = self.retake_queue.pop(0)
                    self.retake_queue.append(item)
                    self.feedback_label.setText("1/2 - Keep going!")
                
                QTimer.singleShot(800, self.generate_question)
                return

            self.update_progress() # Check if session ended
            
            if self.session_active or self.mode_box.currentText() == "Free Play":
                # Only Auto-next if not ended
                # Hacky check: if reset_session called, session_attempts is empty
                if not self.session_attempts: return # Ended
                
                QTimer.singleShot(600, self.generate_question)
        else:
            self.streak = 0
            curr_q_text = self.question_label.text()
            self.session_mistakes.append((curr_q_text, self.answer, user_text))
            self.feedback_label.setText(f"Wrong. Answer: {self.answer}")
            self.feedback_label.setStyleSheet(f"color: {ERROR_COLOR};")
            self.flash_overlay.flash(ERROR_COLOR)
            self.shake_input()

            self.start_time = None
            self.answer_input.setText("") 
            
            if self.retake_active:
                # Reset mastery for this specific question
                self.retake_mastery[curr_q_text] = 0
                # Move to end of queue
                item = self.retake_queue.pop(0)
                self.retake_queue.append(item)
                QTimer.singleShot(1500, self.generate_question)
                return

            self.update_progress()

        self.streak_label.setText(f"🔥 {self.streak}")
        self.refresh_stats()

    def shake_input(self):
        orig_pos = self.answer_input.pos()
        anim = QSequentialAnimationGroup(self)
        for dx in [10, -10, 5, -5, 0]:
            a = QPropertyAnimation(self.answer_input, b"pos")
            a.setDuration(50)
            a.setStartValue(orig_pos)
            a.setEndValue(orig_pos + QPoint(dx, 0))
            anim.addAnimation(a)
        anim.start()
        
    def refresh_stats(self):
        """Update all stat displays: session, today, lifetime, and detailed stats."""
        # Session Count (current session)
        session_count = len(self.session_attempts)
        self.session_count_label.setText(str(session_count))
        
        # Today's Count
        today_count = get_today_attempts_count()
        self.today_count_label.setText(str(today_count))
        
        # Lifetime Count
        lifetime_count = get_total_attempts_count()
        self.lifetime_count_label.setText(str(lifetime_count))
        
        # Detailed Stats (accuracy and average speed for today)
        if today_count > 0:
            import sqlite3
            from .database import DB_NAME
            conn = sqlite3.connect(DB_NAME)
            c = conn.cursor()
            c.execute("SELECT COUNT(*), SUM(correct), SUM(time_taken) FROM attempts WHERE created = ?", (date.today().isoformat(),))
            total, correct, total_time = c.fetchone()
            conn.close()
            
            if total and total > 0:
                acc = (correct / total) * 100
                avg = total_time / total
                if total_time is None: total_time = 0
                self.stats_detail_label.setText(f"Today: {acc:.0f}% accuracy • {avg:.2f}s avg • {int(total_time)}s total")
            else:
                self.stats_detail_label.setText("Start answering to see stats")
        else:
            self.stats_detail_label.setText("Start answering to see stats")
        
    def show_mastery(self):
        dlg = MasteryDialog(self)
        dlg.exec()
        self.answer_input.setFocus()
        
    def resizeEvent(self, event):
        if hasattr(self, 'flash_overlay') and self.flash_overlay:
            self.flash_overlay.resize(self.size())
        super().resizeEvent(event)
        self.update_ghost_pos()

    def update_ghost_pos(self):
        if not hasattr(self, 'ghost_line') or self.ghost_line.isHidden():
            return
            
        if not self.current_pb or not self.session_start_time:
            return
            
        elapsed = (datetime.now() - self.session_start_time).total_seconds()
        mode = self.mode_box.currentText()
        
        progress = 0
        if "Drill" in mode:
            # PB is time. progress = elapsed / PB
            progress = elapsed / self.current_pb if self.current_pb > 0 else 0
        elif "Sprint" in mode:
            # PB is score. Ghost reaches 100% at 60s
            progress = elapsed / 60.0
            
        progress = min(1.0, progress)
        
        # Map to bar width
        bar_w = self.progress_bar.width()
        x = int(progress * bar_w)
        self.ghost_line.setGeometry(x, 0, 3, self.progress_bar.height())


# if __name__ == "__main__":
#     app = QApplication(sys.argv)
#     window = MathDrill()
#     window.show()
#     sys.exit(app.exec())
