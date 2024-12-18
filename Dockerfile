# Stage 1: Build
FROM --platform=linux/amd64 node:18 AS builder

WORKDIR /app

# Install dependencies and build the application
COPY package.json ./
COPY yarn.lock ./
COPY prisma ./prisma/

RUN yarn
COPY . .
RUN yarn run build

# Stage 2: Runtime
FROM --platform=linux/amd64 node:18 AS runtime

WORKDIR /app

# Install required runtime dependencies
RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 ghostscript \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Copy necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./ 

EXPOSE 3001
CMD ["yarn", "start:prod"]
