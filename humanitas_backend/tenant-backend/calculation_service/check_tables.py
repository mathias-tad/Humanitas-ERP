import asyncio
from sqlalchemy import text
from app.database import db_manager
from app.config import get_settings

async def check_tables():
    settings = get_settings()
    await db_manager.init_admin_connection(settings.admin_database_url)
    
    tenant_slug = "math" 
    print(f"Connecting to tenant: {tenant_slug}...")
    
    # Get session (will fallback to public likely)
    session = await db_manager.get_tenant_session(tenant_slug)
    
    print("\n--- Listing ALL Tables in Database ---")
    async with session:
        # Query pg_catalog directly
        res = await session.execute(text("""
            SELECT schemaname, tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename;
        """))
        
        rows = res.fetchall()
        for row in rows:
            print(f"{row.schemaname}.{row.tablename}")
            
    print("\n--- End of List ---")

if __name__ == "__main__":
    asyncio.run(check_tables())
