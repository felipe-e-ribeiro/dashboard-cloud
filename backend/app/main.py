from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import SessionLocal
from .routers import auth, costs, settings as settings_router
from .seed import seed_admin_user
from .services.fx import sync_fx_rates
from .services.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        seed_admin_user(db)
        sync_fx_rates(db)
    finally:
        db.close()
    start_scheduler()
    yield


app = FastAPI(title="Cloud Cost Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(costs.router)
app.include_router(settings_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
