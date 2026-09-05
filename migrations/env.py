from alembic import context

from starz.db.models import Base
from starz.db.store import database_engine
from starz.settings import Settings

config = context.config
target_metadata = Base.metadata


def migrate(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    context.configure(url=Settings.from_env().database_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
elif config.attributes.get('connection') is not None:
    migrate(config.attributes['connection'])
else:
    engine = database_engine(Settings.from_env().database_url)
    try:
        with engine.connect() as connection:
            migrate(connection)
    finally:
        engine.dispose()
