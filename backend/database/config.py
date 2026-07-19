from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
import os

load_dotenv()

_DEV_SECRET_KEY = "argus_dev_secret_key"

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql://argus:argus_password@localhost:5432/argus_db"
    CHROMADB_HOST: str = "localhost"
    CHROMADB_PORT: int = 8001
    SECRET_KEY: str = _DEV_SECRET_KEY
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    LLM_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 50
    DEMO_SEED_DATA: bool = True
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()

# Refuse to start in production with the known dev secret key baked into source control.
# Falling through here would let anyone forge valid JWTs using a publicly-known signing key.
if settings.ENVIRONMENT.lower() in ("production", "prod") and settings.SECRET_KEY == _DEV_SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is not set (or still the default dev value) while ENVIRONMENT=production. "
        "Set a strong, unique SECRET_KEY via environment variable/.env before starting the app."
    )

# Refuse to start in production with demo seeding left on: it creates known
# credentials (admin@argus.demo / admin123) in whatever database it finds.
if settings.ENVIRONMENT.lower() in ("production", "prod") and settings.DEMO_SEED_DATA:
    raise RuntimeError(
        "DEMO_SEED_DATA is still true while ENVIRONMENT=production. "
        "Set DEMO_SEED_DATA=False before starting the app in production."
    )

DATABASE_URL = settings.DATABASE_URL
SECRET_KEY = settings.SECRET_KEY
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
GEMINI_API_KEY = settings.GEMINI_API_KEY
