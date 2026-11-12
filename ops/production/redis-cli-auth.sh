#!/bin/sh
# Credential stays inside the container; never pass it as a CLI argument.
set -eu
REDISCLI_AUTH=$(sed -n 's/^requirepass //p' /usr/local/etc/redis/redis.conf)
test -n "$REDISCLI_AUTH"
export REDISCLI_AUTH
exec redis-cli -e --no-auth-warning "$@"
