from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from passlib.context import CryptContext

from database import init_db, async_session_factory
from models.settings import AppSettings
from config import settings
from routers import auth, providers, logs, analytics, settings_router, proxy, tokens
from sqlalchemy import select


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_defaults():
    async with async_session_factory() as session:
        result = await session.execute(select(AppSettings).where(AppSettings.id == 1))
        existing = result.scalar_one_or_none()
        if not existing:
            app_settings = AppSettings(
                id=1,
                admin_username=settings.admin_username,
                admin_password_hash=pwd_context.hash(settings.admin_password),
            )
            session.add(app_settings)
            await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_defaults()
    yield


app = FastAPI(title="LLMeter", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(providers.router)
app.include_router(logs.router)
app.include_router(analytics.router)
app.include_router(settings_router.router)
app.include_router(tokens.router)
app.include_router(proxy.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
