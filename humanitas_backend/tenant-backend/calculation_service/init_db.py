import asyncio
from sqlalchemy import text
from app.database import db_manager
from app.config import get_settings

async def init_tables():
    settings = get_settings()
    await db_manager.init_admin_connection(settings.admin_database_url)
    
    tenant_slug = "math" 
    
    print(f"Connecting to tenant: {tenant_slug}...")
    try:
        session = await db_manager.get_tenant_session(tenant_slug)
    except Exception as e:
        print(f"Failed to get session: {e}")
        return

    async with session:
        try:
            print("Checking schema...")
            # Verify we are in the right place
            res = await session.execute(text("SHOW search_path"))
            print(f"Current search_path: {res.scalar()}")

            print("Listing tables in tenant_math:")
            tables_res = await session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'tenant_math'
            """))
            for row in tables_res:
                print(f" [tenant_math] {row[0]}")

            print("Listing tables in public:")
            public_res = await session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            for row in public_res:
                print(f" [public] {row[0]}")
            
            print("Checking direct access to attendance_records...")
            try:
                # Force public schema
                await session.execute(text("SET search_path TO public"))
                att_res = await session.execute(text("SELECT count(*) FROM attendance_records"))
                count = att_res.scalar()
                print(f"Found attendance_records! Count: {count}")
                
                if count > 0:
                    latest_res = await session.execute(text("SELECT date FROM attendance_records ORDER BY date DESC LIMIT 1"))
                    latest = latest_res.scalar()
                    print(f"Latest attendance date: {latest}")
            except Exception as e:
                print(f"Failed to query attendance_records: {e}")

            print("Creating overtime_entries table...")
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS overtime_entries (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    date DATE NOT NULL,
                    attendance_id UUID,
                    normal_ot_hours NUMERIC(10, 2) DEFAULT 0,
                    night_ot_hours NUMERIC(10, 2) DEFAULT 0,
                    holiday_ot_hours NUMERIC(10, 2) DEFAULT 0,
                    dayoff_ot_hours NUMERIC(10, 2) DEFAULT 0,
                    total_amount NUMERIC(10, 2) DEFAULT 0,
                    status VARCHAR(50) DEFAULT 'Pending',
                    is_manual BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT unique_user_date UNIQUE (user_id, date)
                );
            """))
            print("Table created successfully!")
            await session.commit()
        except Exception as e:
            print(f"Error creating table: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(init_tables())
