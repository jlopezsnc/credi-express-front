# syntax=docker/dockerfile:1

# ---------- Etapa de build ----------
FROM node:24.22.1-alpine3.24 AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .

# Configuración pública de Firebase (no son secretos: van en el bundle del navegador).
ARG NG_APP_API_BASE_URL=/api
ARG NG_APP_FIREBASE_API_KEY
ARG NG_APP_FIREBASE_AUTH_DOMAIN
ARG NG_APP_FIREBASE_PROJECT_ID
ARG NG_APP_FIREBASE_APP_ID
ENV NG_APP_API_BASE_URL=$NG_APP_API_BASE_URL \
    NG_APP_FIREBASE_API_KEY=$NG_APP_FIREBASE_API_KEY \
    NG_APP_FIREBASE_AUTH_DOMAIN=$NG_APP_FIREBASE_AUTH_DOMAIN \
    NG_APP_FIREBASE_PROJECT_ID=$NG_APP_FIREBASE_PROJECT_ID \
    NG_APP_FIREBASE_APP_ID=$NG_APP_FIREBASE_APP_ID

RUN npm run build

# ---------- Etapa final: nginx sin privilegios (UID 101, puerto 8080) ----------
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24-slim

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

USER 101
EXPOSE 8080
