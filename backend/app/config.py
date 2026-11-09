from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="FPL_")

    fpl_api_base: str = "https://fantasy.premierleague.com/api"
    fpl_max_concurrency: int = 5
    max_league_size: int = 50
    # Points deducted per extra transfer. Not exposed by the FPL API.
    hit_cost: int = 4
    # Until the database lands, league overviews are cached in memory this long.
    league_cache_seconds: int = 3600
    # Data for finished gameweeks never changes, so it can be kept much longer.
    finished_gameweek_cache_seconds: int = 86400
    # Points for a gameweek still in progress.
    live_cache_seconds: int = 300
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
