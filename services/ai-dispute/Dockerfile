FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV PORT=7190
EXPOSE 7190
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7190"]
