from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from typing import Dict
import asyncpg


class DatabaseManager:
    def __init__(self):
        self._admin_engine = None
        self._admin_url = None
        self._tenant_engines: Dict[str, any] = {}
    
    async def init_admin_connection(self, database_url: str):
        """Initialize connection to admin database"""
        # [FIX] Ensure asyncpg driver
        if database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            
        print(f"[DB] Initializing admin connection with URL: {database_url[:40]}...{database_url[-20:]}")
        self._admin_url = database_url
        self._admin_engine = create_async_engine(database_url, echo=False)
    
    async def get_admin_session(self) -> AsyncSession:
        """Get admin database session"""
        async_session = async_sessionmaker(self._admin_engine, expire_on_commit=False)
        return async_session()
    
    async def get_redis_settings(self) -> dict | None:
        """Fetch Redis/Upstash settings from admin database"""
        async with await self.get_admin_session() as session:
            result = await session.execute(
                text("SELECT settings FROM tenants WHERE id = (SELECT id FROM tenants LIMIT 1)")
            )
            row = result.fetchone()
            if row and row[0]:
                settings = row[0]
                return settings.get("redis", None)
        return None
    
    def format_tenant_url(self, url: str, database_name: str) -> str:
        """Replace database name in connection URL using string manipulation"""
        try:
            # [FIX] Ensure asyncpg for tenant URLs too (if base url was fixed, this might be redundant but safe)
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

            # URL format: postgresql+asyncpg://user:pass@host:port/dbname?params
            # Split at last / before ? to isolate dbname
            if '?' in url:
                base, params = url.rsplit('?', 1)
                # Replace database name (last path segment)
                parts = base.rsplit('/', 1)
                new_url = f"{parts[0]}/{database_name}?{params}"
            else:
                # No query params
                parts = url.rsplit('/', 1)
                new_url = f"{parts[0]}/{database_name}"
            
            # Ensure SSL for Render
            if 'render.com' in url and 'ssl=' not in new_url:
                if '?' in new_url:
                    new_url += '&ssl=require'
                else:
                    new_url += '?ssl=require'
            
            return new_url
        except Exception as e:
            print(f"[DB] Error formatting URL: {e}")
            return url

    async def get_tenant_connection_string(self, tenant_id: str) -> str | None:
        """Get tenant database connection string from admin database (supports UUID or slug)"""
        print(f"[DB] get_tenant_connection_string called for: {tenant_id}")
        try:
            async with await self.get_admin_session() as session:
                print("[DB] Got admin session, executing query...")
                # Just verify the tenant exists
                result = await session.execute(
                    text("""
                        SELECT id, slug, database_name 
                        FROM tenants 
                        WHERE id::text = :tenant_id OR slug = :tenant_id
                    """),
                    {"tenant_id": tenant_id}
                )
                row = result.fetchone()
                if row:
                    tid, slug, db_name = row
                    print(f"[DB] Found tenant: id={tid}, slug={slug}, database_name={db_name}")
                    
                    # Use tenant-specific database name
                    # This matches NestJS behavior: database: databaseName
                    tenant_url = self.format_tenant_url(self._admin_url, db_name)
                    
                    print(f"[DB] Using dedicated database URL: {tenant_url.split('@')[-1]} (password preserved)")
                    return tenant_url
                else:
                    print(f"[DB] No tenant found for: {tenant_id}")
        except Exception as e:
            print(f"[DB] Error in get_tenant_connection_string: {e}")
        return None
    
    async def get_tenant_engine(self, tenant_id: str):
        """Get or create tenant database engine"""
        if tenant_id not in self._tenant_engines:
            conn_str = await self.get_tenant_connection_string(tenant_id)
            if conn_str:
                self._tenant_engines[tenant_id] = create_async_engine(conn_str, echo=False)
        return self._tenant_engines.get(tenant_id)
    
    async def get_tenant_session(self, tenant_id: str) -> AsyncSession:
        """Get tenant database session"""
        print(f"[DB] get_tenant_session for {tenant_id}")
        
        engine = await self.get_tenant_engine(tenant_id)
        if not engine:
            raise ValueError(f"No database connection for tenant: {tenant_id}")
        
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        session = async_session()
        
        # [FIX] No schema switching needed - we use dedicated databases per tenant
        # The connection is already to the correct database (tenant_xxx)
        # Just use the default 'public' schema which is where tables are created
        print(f"[DB] Using tenant database (dedicated DB mode - no schema switch needed)")
        
        return session
    
    async def close(self):
        """Close all connections"""
        if self._admin_engine:
            await self._admin_engine.dispose()
        for engine in self._tenant_engines.values():
            await engine.dispose()


db_manager = DatabaseManager()
