from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="FPL_")

    fpl_api_base: str = "https://fantasy.premierleague.com/api"
    fpl_max_concurrency: int = 5
    max_league_size: int = 50
    # Until the database lands, league overviews are cached in memory this long.
    league_cache_seconds: int = 3600
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
