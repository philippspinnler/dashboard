# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
# Use `npm install` (not `npm ci`): @nuxt/cli pulls @bomb.sh/tab, whose optional
# `commander` peer trips npm ci's strict resolver, and install also reliably
# fetches the platform-specific native bindings (rolldown) for Alpine/musl.
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Nitro node-server honours HOST/PORT
ENV HOST=0.0.0.0
ENV PORT=3000

# Only the build output is needed at runtime (server + client assets bundled in)
COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
