from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
import os

router = APIRouter()

LOG_FILE_PATH = "app.log"

@router.get("/logs", response_class=PlainTextResponse)
async def get_system_logs(lines: int = Query(100, description="Number of lines to return")):
    """
    Get the last N lines of the server log file.
    """
    if not os.path.exists(LOG_FILE_PATH):
        return "Log file not found."
    
    try:
        # Read the file
        # Efficiently read last N lines is tricky without reading whole file
        # But for 100-1000 lines, reading whole file is usually fine for small logs.
        # Ideally use `deque` or seek from end.
        
        with open(LOG_FILE_PATH, "r", encoding="utf-8") as f:
            # Simple approach: read all lines and slice
            # Limit file size check? If > 10MB, maybe just read last chunk.
            
            file_size = os.path.getsize(LOG_FILE_PATH)
            if file_size > 5 * 1024 * 1024: # 5MB
                # Seek to end and read backwards approximation
                f.seek(file_size - 100000) # Read last 100KB
                content = f.read()
                return "\n".join(content.splitlines()[-lines:])
            
            all_lines = f.readlines()
            return "".join(all_lines[-lines:])
            
    except Exception as e:
        return f"Error reading logs: {str(e)}"
