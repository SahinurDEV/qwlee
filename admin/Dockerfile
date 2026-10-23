FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# VITE_* values are inlined into the bundle at build time.
ARG VITE_API_BASE_URL=http://localhost:7171
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_FRONTEND_URL=http://localhost:8000
ENV VITE_FRONTEND_URL=$VITE_FRONTEND_URL
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
