import os
import shutil
import zipfile
from datetime import datetime

class BackupManager:
    def __init__(self, addon_folder):
        self.addon_folder = addon_folder
        self.user_data_dir = os.path.join(addon_folder, "data", "user")
        self.backup_dir = os.path.join(addon_folder, "data", "backups")
        
        # Ensure backup directory exists
        if not os.path.exists(self.backup_dir):
            try:
                os.makedirs(self.backup_dir)
            except Exception as e:
                print(f"Error creating backup directory: {e}")

    def perform_backup(self, max_backups=5):
        """Creates a timestamped zip of the user data directory."""
        if not os.path.exists(self.user_data_dir):
            return False, "User data directory not found."

        # Filter out temporary or non-essential files if any
        # For now, we backup everything in data/user
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup_{timestamp}.zip"
        backup_path = os.path.join(self.backup_dir, backup_filename)

        try:
            with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(self.user_data_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Add file to zip, preserving relative path from user_data_dir
                        arcname = os.path.relpath(file_path, self.user_data_dir)
                        zipf.write(file_path, arcname)
            
            # Rotate backups
            self._rotate_backups(max_backups)
            print(f"Backup created: {backup_path}")
            return True, backup_path
        except Exception as e:
            print(f"Backup failed: {e}")
            return False, str(e)

    def _rotate_backups(self, max_backups):
        """Removes old backups to maintain the maximum number allowed."""
        try:
            files = [f for f in os.listdir(self.backup_dir) if f.startswith("backup_") and f.endswith(".zip")]
            files.sort() # Sort by timestamp (since it's YYYYMMDD_HHMMSS)

            while len(files) > max_backups:
                oldest_file = files.pop(0)
                os.remove(os.path.join(self.backup_dir, oldest_file))
        except Exception as e:
            print(f"Error rotating backups: {e}")

    def get_backup_info(self):
        """Returns information about existing backups."""
        try:
            files = [f for f in os.listdir(self.backup_dir) if f.startswith("backup_") and f.endswith(".zip")]
            files.sort(reverse=True)
            return {
                "count": len(files),
                "latest": files[0] if files else None,
                "backups": files
            }
        except:
            return {"count": 0, "latest": None, "backups": []}
