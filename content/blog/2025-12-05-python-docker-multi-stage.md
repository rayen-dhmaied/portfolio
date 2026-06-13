---
slug: python-docker-multi-stage
title: Splitting a Python Dockerfile into Build and Runtime Stages
authors: [rayen-dhmaied]
tags: [docker, python, ci, kubernetes]
---

I shipped a Flask backend for a quiz platform. The first time CI tried to push the production image to GitHub Container Registry, it died midway:

```text
#15 pushing layer dc355e6e88a5 145.61MB / 673.11MB 9.0s done
#15 ERROR: unknown blob
```

The image was around 700 MB. One layer on its own was 673 MB. Every Pod cold-start was pulling that off the registry, and pushes kept timing out because the single big layer took too long to upload in one shot.

<!-- truncate -->

The Dockerfile was short and looked fine until you stared at it:

```dockerfile
FROM python:3.12-alpine

RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    openssl-dev \
    postgresql-dev

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

RUN adduser -D quizship && chown -R quizship /app
USER quizship

CMD ["gunicorn", "app:app", "--config", "gunicorn.conf.py"]
```

<!-- truncate -->
---

## Why the Image Is So Big

A Docker image is a stack of read-only layers. Once a file lands in a layer it's there for good. You can `rm` it in a later layer and the merged filesystem will hide it, but the bytes are still sitting in the previous layer and they still get pushed.

The line that does most of the damage is `apk add gcc musl-dev libffi-dev openssl-dev postgresql-dev`. That's a build toolchain. I needed it in the next step so `pip install` could compile the C bits of `cryptography`, `psycopg2`, and `bcrypt`. After that, gcc never runs again. But because everything happened in the same image, gcc is still sitting in the runtime image, doing nothing.

In my case, that toolchain plus its `-dev` headers added around 650 MB. The Python interpreter, the app code, and the installed wheels came in under 100 MB combined. The compiler was bigger than the thing it was there to compile.

The way out: do the build in one image and the install in another, then copy only what the runtime needs.

---

## Two Stages, One Image

A Dockerfile can have more than one `FROM`. Each one starts a brand new stage with its own layer history, and only the last stage actually becomes the image you push. You can name a stage with `AS something` and then pull specific files out of it from a later stage.

```dockerfile
FROM python:3.12-alpine AS builder
# install toolchain, compile things

FROM python:3.12-alpine
COPY --from=builder /wheels /wheels
# only this stage's layers end up in the published image
```

Only the last `FROM` becomes the published image. Everything in the `builder` stage gets thrown away once the build is done. The toolchain, the build directory, whatever source tarballs `pip` pulled down: none of it ships.

For Python the split is straightforward: compile in one stage, install in the other. The build stage turns every dependency into a wheel. The runtime stage installs those wheels without ever needing a compiler.

---

## What a Wheel Is

A wheel is a `.whl` file. Rename it to `.zip` and you can unzip it. Inside are the package's Python files, and for packages with C parts, already-compiled `.so` binaries for one specific Python + OS + CPU combination.

When you run `pip install psycopg2`, pip picks one of two paths:

1. Grab a matching wheel and unzip it into `site-packages`. No compiler involved.
2. Grab an sdist (the source tarball), find a compiler, build the C code, install. Slower, and it needs gcc plus the dev headers.

If PyPI has a wheel that matches your Python, OS, and architecture, pip uses it. If not (musl-based Alpine hits this sometimes because most projects publish glibc wheels only), pip falls back to the sdist and starts compiling.

Wheel filenames encode the compatibility info:

```text
psycopg2_binary-2.9.11-cp312-cp312-musllinux_1_2_x86_64.whl
└─────────────┘ └─────┘ └───┘ └───┘ └──────────────────────┘
   package      version  py   abi   platform
```

Pip walks the available files and picks the one whose tags match the host it's running on.

The two-stage Dockerfile uses two pip commands:

1. `pip wheel -r requirements.txt --wheel-dir /wheels`. Runs in the builder, where gcc is available. Produces a wheel for every package, including the ones that had to be compiled.
2. `pip install --no-index --find-links=/wheels -r requirements.txt`. Runs in the runtime, where gcc is not available. `--no-index` keeps pip away from PyPI so it only uses the wheels we just built.

The compiler and dev headers stay in the builder stage. Only the wheels (plus the small `.so` libraries they need at runtime) cross over to the runtime stage.

---

## The New Dockerfile

```dockerfile
# Build stage: compile wheels with the full toolchain.
FROM python:3.12-alpine AS builder

RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    openssl-dev \
    postgresql-dev

WORKDIR /build
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# Runtime stage: only the wheels + the .so libraries they link against.
FROM python:3.12-alpine

RUN apk add --no-cache \
    libpq \
    libffi \
    openssl

WORKDIR /app

COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

COPY . .

RUN adduser -D quizship && chown -R quizship /app
USER quizship

ENV FLASK_APP=app:app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["gunicorn", "app:app", "--config", "gunicorn.conf.py"]
```

Two things worth pointing out.

The builder uses `gcc musl-dev libffi-dev openssl-dev postgresql-dev`. The runtime uses `libpq libffi openssl`. Same packages with the `-dev` dropped. The `-dev` versions carry headers and `.a` archives that gcc links against; the plain versions are the shared libraries that the compiled code actually calls at runtime. Debian uses the same pattern, just with different names: `libpq-dev` to build, `libpq5` to run.

The runtime stage installs with `--no-index --find-links=/wheels`, so pip never talks to PyPI. After the install I `rm -rf /wheels` because the staging copy isn't doing anything useful sitting on disk. The final layer ends up being the installed Python packages and nothing else.

---

## What I Got Wrong on the First Try

I forgot to put `libpq` in the runtime stage. Build went green, container started, first DB call blew up:

```text
ImportError: libpq.so.5: cannot open shared object file: No such file or directory
```

Wheels with C extensions don't bundle the C library they call into. They ship the Python binding and `.so` glue, and at runtime that glue does a normal dynamic-library lookup. `psycopg2` looks for libpq, `cryptography` looks for libssl, and so on. The builder had all of those (they came with the `-dev` packages, which is why `pip wheel` worked). The runtime stage had none of them.

Same fix every time: for every `*-dev` package in the builder, drop the suffix and `apk add` the runtime version. Sometimes the runtime package has a different name than you'd guess (Debian uses `libfoo5`, Alpine usually just keeps `libfoo`), so when something fails to import after a build, check the Alpine package index first before going looking for anything more exotic.

---

## Layer Cache Order Matters

There's a reason `COPY requirements.txt .` shows up before `COPY . .`. Docker invalidates a layer's cache when its inputs change, and "inputs" includes anything copied in. If you `COPY . .` before installing dependencies, every code edit busts the wheel cache and CI recompiles `cryptography` from scratch on every push.

With the order I went with:

1. Only `requirements.txt` gets copied. Cache key is small and rarely changes.
2. `pip wheel` runs against it. Cached unless `requirements.txt` itself changed.
3. `pip install` runs against the wheels. Cached if `/wheels` didn't change.
4. Finally `COPY . .` brings in the source. Change this all you want; the wheel layers above stay warm.

Touch the app code and you only rebuild from step 4. Touch `requirements.txt` and you rebuild from step 2. The slow steps stay cached until their inputs actually change.

---

## How It Played Out

The image dropped from around 700 MB to around 150 MB. The biggest layer in the runtime image is now ~110 MB, mostly the Python interpreter plus the installed wheels. Before, that one layer was 673 MB on its own.

The GHCR push that failed on `unknown blob` went through on the next pipeline run. Pod cold-starts on fresh nodes used to take 30+ seconds; now they finish in a few.

CI took about as long as before. We still compile every wheel that needs compiling. The difference is that the compiler stays in the builder stage and never reaches the final image.

---

## Sniff Tests for Other Projects

A few signs an image needs this treatment:

- `python:3.12-alpine` is around 50 MB. If your image is over 200 MB, something else got in.
- You installed anything with `-dev`, `-devel`, `gcc`, `g++`, `make`, `cargo`, `go`, or `node-gyp`.
- A registry push stalls or fails on one fat layer.
- Pods take a long time to start on nodes that have not pulled the image before.

The same split works for Go and Rust, and the gap is even bigger there because their build toolchains weigh more than Alpine + gcc. Build the binary in stage one, copy it into a `scratch` or `distroless` base in stage two.

The first deploy gives you a smaller image. After that you get faster pulls when a Pod lands on a cold node, faster CI on cached layers, and less surface area in production if a container ever gets compromised.
