# STEP37CG LOOP REGISTRY MIRRORS

- ArtNet master mirror: config refresh/pending continuation registered through runtime loop registry.
- Live serial app mirror: config refresh registered through runtime loop registry.
- Output runner heartbeat: registered and throttled while live/hidden.
- Live input/status refresh: registered and throttled.
- Settings serial/health polling: registered and hidden-page gated.
- Physical output scheduler and worker hot send path intentionally left untouched.
