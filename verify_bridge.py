import json
import os
import sys
from unittest.mock import MagicMock, patch

print("Starting verification script...")

# Mock decorators
def mock_decorator(*args, **kwargs):
    def wrapper(f):
        return f
    return wrapper

class QObject:
    def __init__(self, *args, **kwargs):
        pass

mock_aqt_qt = MagicMock()
mock_aqt_qt.pyqtSlot = mock_decorator
mock_aqt_qt.pyqtSignal = MagicMock
mock_aqt_qt.QObject = QObject
mock_aqt_qt.QWebChannel = MagicMock

sys.modules['aqt'] = MagicMock()
sys.modules['aqt.qt'] = mock_aqt_qt
sys.modules['aqt.utils'] = MagicMock()

print("Mocks set up. Importing Bridge...")

try:
    from bridge import Bridge
    print(f"Bridge imported successfully from {Bridge.__module__}")
except Exception as e:
    print(f"Failed to import Bridge: {e}")
    sys.exit(1)

def test():
    print("Initializing Bridge...")
    bridge = Bridge()
    # Create a fresh mock for the signal on the instance
    bridge.messageReceived = MagicMock()
    
    print(f"Bridge.import_data is: {bridge.import_data}")
    
    payload = json.dumps({
        "type": "import_data",
        "payload": {"data": {"test.json": {"val": 1}}}
    })
    
    print("Calling bridge.import_data...")
    with patch('os.path.exists', return_value=True), \
         patch('os.makedirs'), \
         patch('builtins.open', MagicMock()), \
         patch('json.dump'), \
         patch('shutil.copy2'):
        
        bridge.import_data(payload)
    
    print("Call finished.")
    print(f"Emitted calls: {bridge.messageReceived.emit.call_args_list}")

def test_export():
    print("\nTesting export_data...")
    bridge = Bridge()
    bridge.messageReceived = MagicMock()
    
    # Mock QFileDialog.getSaveFileName
    mock_save_file = "/tmp/test_export.json"
    
    # Need to patch where Bridge.export_data imports it from
    with patch('aqt.qt.QFileDialog.getSaveFileName', return_value=(mock_save_file, "JSON Files (*.json)")), \
         patch('os.path.exists', return_value=True), \
         patch('os.listdir', return_value=['attempts.json']), \
         patch('builtins.open', MagicMock()), \
         patch('json.load', return_value={"test": 1}), \
         patch('json.dump') as mock_dump:
        
        bridge.export_data()
        
    print(f"Emitted calls: {bridge.messageReceived.emit.call_args_list}")
    
    # Verify success message
    calls = bridge.messageReceived.emit.call_args_list
    if calls:
        msg = json.loads(calls[0][0][0])
        if msg['type'] == 'export_data_response' and msg['payload']['success']:
            print("Success: export_data logic verified.")
        else:
            print(f"Failure: export_data response: {msg}")
    else:
        print("Failure: No message emitted for export_data")

if __name__ == "__main__":
    test()
    test_export()
