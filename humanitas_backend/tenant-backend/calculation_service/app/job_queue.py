# Simple PostgreSQL Job Queue
import psycopg2
import json
from datetime import datetime
from typing import Optional
from app.config import get_settings

class PostgresJobQueue:
    """
    Simple PostgreSQL-based job queue with:
    - Persistent jobs (survive restarts)
    - Automatic retries
    - Separate worker process
    """
    
    def __init__(self):
        settings = get_settings()
        self.db_url = settings.admin_database_url
        if self.db_url:
            self.db_url = self.db_url.replace("postgresql+asyncpg://", "postgresql://")
        self._conn = None
    
    def _get_connection(self):
        if not self._conn or self._conn.closed:
            self._conn = psycopg2.connect(self.db_url)
            self._conn.autocommit = True
        return self._conn
    
    def init_schema(self):
        """Create the jobs table if it doesn't exist"""
        conn = self._get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS calculation_jobs (
                    id SERIAL PRIMARY KEY,
                    task_name VARCHAR(100) NOT NULL,
                    payload JSONB NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    attempts INTEGER DEFAULT 0,
                    max_attempts INTEGER DEFAULT 3,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    scheduled_for TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_jobs_status ON calculation_jobs(status);
                CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON calculation_jobs(scheduled_for);
            """)
            print("[JobQueue] Schema initialized")
    
    def enqueue(self, task_name: str, payload: dict) -> int:
        """Add a job to the queue"""
        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO calculation_jobs (task_name, payload)
                    VALUES (%s, %s)
                    RETURNING id
                """, (task_name, json.dumps(payload)))
                job_id = cur.fetchone()[0]
                print(f"[JobQueue] Enqueued job {job_id}: {task_name}")
                return job_id
        except Exception as e:
            # Catch any connection-related error (OperationalError, InterfaceError, etc.)
            print(f"[JobQueue] Error enqueuing job (attempt 1): {e}")
            print("[JobQueue] Database connection likely lost, reconnecting...")
            self._conn = None
            try:
                conn = self._get_connection()
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO calculation_jobs (task_name, payload)
                        VALUES (%s, %s)
                        RETURNING id
                    """, (task_name, json.dumps(payload)))
                    job_id = cur.fetchone()[0]
                    print(f"[JobQueue] Enqueued job {job_id} after reconnect: {task_name}")
                    return job_id
            except Exception as e2:
                print(f"[JobQueue] FATAL: Error enqueuing job after reconnect: {e2}")
                raise e2
    
    def fetch_pending_job(self) -> Optional[dict]:
        """Fetch the next pending job (atomic with locking)"""
        conn = self._get_connection()
        with conn.cursor() as cur:
            # Use FOR UPDATE SKIP LOCKED for concurrent workers
            cur.execute("""
                UPDATE calculation_jobs 
                SET status = 'processing', started_at = NOW(), attempts = attempts + 1
                WHERE id = (
                    SELECT id FROM calculation_jobs 
                    WHERE status = 'pending' AND scheduled_for <= NOW()
                    ORDER BY created_at 
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                RETURNING id, task_name, payload, attempts, max_attempts
            """)
            row = cur.fetchone()
            if row:
                return {
                    "id": row[0],
                    "task_name": row[1],
                    "payload": row[2],
                    "attempts": row[3],
                    "max_attempts": row[4]
                }
            return None
    
    def mark_completed(self, job_id: int, result: dict = None):
        """Mark a job as completed"""
        conn = self._get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE calculation_jobs 
                SET status = 'completed', completed_at = NOW()
                WHERE id = %s
            """, (job_id,))
            print(f"[JobQueue] Job {job_id} completed")
    
    def mark_failed(self, job_id: int, error: str, can_retry: bool):
        """Mark a job as failed, optionally scheduling retry"""
        conn = self._get_connection()
        with conn.cursor() as cur:
            if can_retry:
                # Schedule retry in 60 seconds
                cur.execute("""
                    UPDATE calculation_jobs 
                    SET status = 'pending', error = %s, 
                        scheduled_for = NOW() + INTERVAL '60 seconds'
                    WHERE id = %s
                """, (error, job_id))
                print(f"[JobQueue] Job {job_id} failed, scheduled retry")
            else:
                cur.execute("""
                    UPDATE calculation_jobs 
                    SET status = 'failed', error = %s, completed_at = NOW()
                    WHERE id = %s
                """, (error, job_id))
                print(f"[JobQueue] Job {job_id} failed permanently")

# Global instance
job_queue = PostgresJobQueue()
