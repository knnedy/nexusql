"""Imports an exported models.py, configures its mappers and creates its schema.

python check.py <postgres|mysql|sqlite> <uri> <models.py>
"""

import importlib.util
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import configure_mappers


def url(dialect: str, uri: str) -> str:
    if dialect == "postgres":
        return "postgresql+psycopg://" + uri.split("://", 1)[1]
    if dialect == "mysql":
        return "mysql+pymysql://" + uri.split("://", 1)[1]
    if dialect == "sqlite":
        return "sqlite:///" + uri.removeprefix("sqlite://")
    raise SystemExit(f"unknown dialect {dialect!r}")


def main() -> None:
    dialect, uri, path = sys.argv[1:]
    spec = importlib.util.spec_from_file_location("models", path)
    models = importlib.util.module_from_spec(spec)
    sys.modules["models"] = models
    spec.loader.exec_module(models)
    configure_mappers()
    engine = create_engine(url(dialect, uri))
    models.Base.metadata.create_all(engine)
    engine.dispose()


if __name__ == "__main__":
    main()
