# Python Calculation Service Dockerfile (Lightweight & Fast)
FROM python:3.11-slim

WORKDIR /app

# Set environment variables for clean python execution
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Copy requirements file first for layer caching
COPY requirements.txt .

# Install Python dependencies (all packages use pre-compiled wheels)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port 8000 for FastAPI
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["python", "run.py"]
