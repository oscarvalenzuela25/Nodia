FROM node:24.22.2-bookworm AS node
FROM ubuntu:26.04
ENV DEBIAN_FRONTEND=noninteractive container=docker
RUN apt-get update && apt-get install -y --no-install-recommends systemd systemd-sysv dbus python3 libstdc++6 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
