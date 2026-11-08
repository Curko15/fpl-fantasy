from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="FPL_")

    fpl_api_base: str = "https://fantasy.premierleague.com/api"
    max_league_size: int = 50
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
