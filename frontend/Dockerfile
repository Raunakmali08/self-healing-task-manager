# --- Build stage: node:20-alpine — WHY alpine + slim toolchain in final image is nginx-only ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY index.html vite.config.js ./
COPY src ./src

RUN npm run build

# --- Runtime: nginx:alpine — WHY: tiny static file server; not running Node in prod frontend. ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
