# Centrifugo with the repo's namespace config baked in. Secrets (HMAC key,
# API key, Redis address) come from Railway env vars, which override the file.
FROM centrifugo/centrifugo:v6

COPY config.json /centrifugo/config.json

CMD ["centrifugo", "-c", "/centrifugo/config.json"]
