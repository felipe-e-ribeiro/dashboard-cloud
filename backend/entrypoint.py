from alembic.config import main as alembic_main
import uvicorn

alembic_main(argv=["upgrade", "head"])
uvicorn.run("app.main:app", host="0.0.0.0", port=8000)
