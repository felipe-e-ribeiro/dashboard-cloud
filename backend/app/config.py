from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    admin_username: str
    admin_password: str

    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str = "us-east-1"

    oci_tenancy_ocid: str | None = None
    oci_user_ocid: str | None = None
    oci_fingerprint: str | None = None
    oci_region: str | None = None
    oci_key_file_path: str | None = None

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()
