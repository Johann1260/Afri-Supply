FROM python:3.12-slim

WORKDIR /app

# Python deps (build tools purgés après install pour réduire l'image)
COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends gcc libffi-dev \
    && pip install --no-cache-dir -r requirements.txt gunicorn \
    && apt-get purge -y gcc libffi-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# App
COPY . .

# Upload dirs
RUN mkdir -p uploads/products uploads/documents uploads/blog

EXPOSE 8000

CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", "--timeout", "120", "--access-logfile", "-"]