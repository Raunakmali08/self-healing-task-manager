# node:20-alpine — WHY alpine: small image, faster pulls, smaller attack surface for demos.
FROM node:20-alpine

WORKDIR /app

# Copy manifest first — WHY: better layer cache when only source code changes.
COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY server.js db.js ./

# Non-root user — WHY: follows container best practice (minimal privileges).
RUN addgroup -g 1001 -S nodeapp && adduser -S nodeapp -u 1001 -G nodeapp \
  && chown -R nodeapp:nodeapp /app
USER nodeapp

EXPOSE 3000

CMD ["node", "server.js"]
