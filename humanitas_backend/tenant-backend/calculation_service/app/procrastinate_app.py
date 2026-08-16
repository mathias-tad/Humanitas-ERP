# Procrastinate App Configuration
from procrastinate import App
from procrastinate.contrib.psycopg2 import Psycopg2Connector
from app.config import get_settings

settings = get_settings()

# Convert asyncpg URL format to standard psycopg format
db_url = settings.admin_database_url
if db_url:
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

# Create the Procrastinate app instance
# Using Psycopg2Connector for sync PostgreSQL operations
procrast_app = App(
    connector=Psycopg2Connector(conninfo=db_url) if db_url else None,
    import_paths=["app.tasks"],
)
