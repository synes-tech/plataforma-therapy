# Cloud Run — Unithery API (Deno router + PostgREST sidecar-local)
# DENO_DIR sob /app (requisito Cloud Run / denoland)
FROM postgrest/postgrest:v12.2.8 AS pgrst
FROM denoland/deno:2.1.4 AS deno

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deno /bin/deno /usr/local/bin/deno
COPY --from=pgrst /bin/postgrest /usr/local/bin/postgrest

WORKDIR /app
ENV DENO_DIR=/app/.deno_cache
ENV PORT=8080
ENV PGRST_SERVER_PORT=3001

COPY supabase/functions /app/supabase/functions
COPY cloud-run/api /app/cloud-run/api

WORKDIR /app/cloud-run/api
RUN chmod +x entrypoint.sh \
  && deno cache --import-map=import_map.json main.ts

EXPOSE 8080
CMD ["./entrypoint.sh"]
