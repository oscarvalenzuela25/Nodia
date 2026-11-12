FROM nodia-updater-systemd-fixture:20261112-r01
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends sudo openssh-server openssh-client nginx openssl && rm -rf /var/lib/apt/lists/*
