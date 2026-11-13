FROM ubuntu:26.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-dbus dbus gnome-keyring libsecret-tools systemd passwd \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 900 nodia \
    && useradd --uid 900 --gid 900 --no-create-home --home-dir /var/lib/nodia/home --shell /usr/sbin/nologin nodia
WORKDIR /source
COPY codex* /source/
ENV NODIA_ISOLATED_CODEX_KEYRING_TEST=1
ENV container=docker
STOPSIGNAL SIGRTMIN+3
CMD ["python3", "-I", "/source/codex-tests.py"]
