"""Read-only proof that no native credential can remain on the private bus."""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path


_APPARMOR_HELLO_DENIAL = (
    'An AppArmor policy prevents this sender from sending this message to this recipient; '
    'type="method_call", sender="(null)" (inactive) interface="org.freedesktop.DBus" member="Hello" '
    'error name="(unset)" requested_reply="0" destination="org.freedesktop.DBus" (bus)'
)


def _has_verified_apparmor_profile() -> bool:
    return (Path("/proc/self/attr/current").read_text(encoding="ascii").strip() == "docker-default (enforce)"
            and "NoNewPrivs:\t1" in Path("/proc/self/status").read_text(encoding="ascii").splitlines())


@asynccontextmanager
async def _open_private_router(socket: Path):
    from jeepney.auth import BEGIN, Authenticator
    from jeepney.io.asyncio import DBusConnection, DBusRouter

    # Own the writer explicitly, including authentication/Hello rejection.
    reader, writer = await asyncio.open_unix_connection(socket)
    try:
        authenticator = Authenticator()
        for greeting in authenticator:
            writer.write(greeting)
            await writer.drain()
            reply = await reader.read(1024)
            if not reply:
                raise ValueError("Private bus closed during authentication")
            authenticator.feed(reply)
        writer.write(BEGIN)
        await writer.drain()
        async with DBusRouter(DBusConnection(reader, writer)) as router:
            yield router
    finally:
        writer.close()
        await writer.wait_closed()


async def prove_empty_keyring(socket: Path, uid: int) -> tuple[str, str]:
    """Verify an empty Secret Service or a kernel-confined client with no bus access."""
    try:
        async with asyncio.timeout(1):
            return await _empty_keyring_identity(socket, uid)
    except Exception:
        # Transport failures can contain peer diagnostics. Preserve cancellation
        # while converting every failed proof to the same local category.
        raise ValueError("Secret Service proof unavailable") from None


async def _empty_keyring_identity(socket: Path, uid: int) -> tuple[str, str]:
    from jeepney import DBusAddress, HeaderFields, MessageType, new_method_call

    dbus = "org.freedesktop.DBus"
    dbus_address = DBusAddress("/org/freedesktop/DBus", bus_name=dbus, interface=dbus)
    secret_name = "org.freedesktop.secrets"
    secret_root = "/org/freedesktop/secrets"
    service_interface = "org.freedesktop.Secret.Service"
    collection_interface = "org.freedesktop.Secret.Collection"

    async with _open_private_router(socket) as router:
        def result(reply, sender, expected):
            if (reply.header.message_type != MessageType.method_return
                    or reply.header.fields.get(HeaderFields.signature) != expected
                    or reply.header.fields.get(HeaderFields.sender) != sender
                    or len(reply.body) != 1):
                raise ValueError("Invalid Secret Service reply")
            return reply.body[0]

        hello = await router.send_and_get_reply(new_method_call(dbus_address, "Hello"))
        if (hello.header.message_type == MessageType.error
                and hello.header.fields.get(HeaderFields.sender) == dbus
                and hello.header.fields.get(HeaderFields.error_name) == f"{dbus}.Error.AccessDenied"
                and hello.body == (_APPARMOR_HELLO_DENIAL,)
                and _has_verified_apparmor_profile()):
            return "apparmor-hello-denied", "docker-default"
        if not result(hello, dbus, "s").startswith(":"):
            raise ValueError("Private bus client identity unavailable")

        async def call(address, method, signature, *arguments, expected):
            message = new_method_call(address, method, signature, arguments)
            reply = await router.send_and_get_reply(message)
            return result(reply, address.bus_name, expected)

        bus_id = await call(dbus_address, "GetId", "", expected="s")
        owner = await call(dbus_address, "GetNameOwner", "s", secret_name, expected="s")
        if not bus_id or not owner.startswith(":"):
            raise ValueError("Secret Service owner unavailable")
        if await call(dbus_address, "GetConnectionUnixUser", "s", owner, expected="u") != uid:
            raise ValueError("Secret Service belongs to another user")

        async def get_property(path, interface, name, expected):
            address = DBusAddress(path, bus_name=owner, interface=f"{dbus}.Properties")
            signature, value = await call(address, "Get", "ss", interface, name, expected="v")
            if signature != expected:
                raise ValueError("Unknown Secret Service property")
            return value

        collections = await get_property(secret_root, service_interface, "Collections", "ao")
        if not 1 <= len(collections) <= 16 or len(set(collections)) != len(collections):
            raise ValueError("Secret Service collections unavailable")
        for collection in collections:
            if (not collection.startswith(f"{secret_root}/collection/")
                    or await get_property(collection, collection_interface, "Locked", "b")
                    or await get_property(collection, collection_interface, "Items", "ao")):
                raise ValueError("Secret Service is locked or contains entries")
        if await call(dbus_address, "GetNameOwner", "s", secret_name, expected="s") != owner:
            raise ValueError("Secret Service owner changed")
    return bus_id, owner
