FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 3000
CMD ["bun", "run", "--hostname", "0.0.0.0", "--port", "3000", "./server/index.js"]