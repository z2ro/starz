FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json tsconfig.json vite.config.ts ./
RUN npm ci --ignore-scripts
COPY frontend ./frontend
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY pyproject.toml alembic.ini ./
COPY starz ./starz
COPY migrations ./migrations
COPY game_data ./game_data
COPY --from=frontend /build/frontend ./frontend
RUN useradd --uid 10001 --create-home starz
USER starz
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn starz.api:app --host 0.0.0.0 --port 8000"]
