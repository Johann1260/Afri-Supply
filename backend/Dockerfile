FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies if needed (optional for slowapi)
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Optional: Run as non-root user for security
# RUN useradd -m appuser && chown -R appuser /app
# USER appuser

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]