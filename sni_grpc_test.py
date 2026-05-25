"""Test SNI gRPC-web connection from Python to debug the proto format."""
import urllib.request
import struct

GRPC_WEB_URL = "http://localhost:8190/sni.Devices/ListDevices"

# Build gRPC frame: flag(1) + length(4) + payload
# Empty DevicesRequest = 0 bytes payload
payload = b""
frame = struct.pack(">BI", 0x00, len(payload)) + payload

req = urllib.request.Request(
    GRPC_WEB_URL,
    data=frame,
    headers={
        "Content-Type": "application/grpc-web+proto",
        "X-Grpc-Web": "1",
        "Accept": "application/grpc-web+proto",
    },
    method="POST",
)

print(f"POST {GRPC_WEB_URL}")
print(f"Request frame: {frame.hex()}")
print()

try:
    with urllib.request.urlopen(req) as resp:
        print(f"Status: {resp.status}")
        print(f"Headers: {dict(resp.headers)}")
        print()

        data = resp.read()
        print(f"Response ({len(data)} bytes): {data.hex()}")
        print(f"Response raw: {data!r}")
        print()

        # Parse gRPC frames
        pos = 0
        frame_idx = 0
        while pos < len(data):
            if pos + 5 > len(data):
                print(f"Truncated at pos {pos}")
                break
            flags = data[pos]
            length = struct.unpack(">I", data[pos+1:pos+5])[0]
            pos += 5
            frame_data = data[pos:pos+length]
            pos += length

            print(f"--- Frame {frame_idx} ---")
            print(f"  Flags: 0x{flags:02x} ({'trailers' if flags & 0x80 else 'data'})")
            print(f"  Length: {length}")

            if flags & 0x80:
                print(f"  Trailers: {frame_data.decode('utf-8', errors='replace')}")
            else:
                print(f"  Hex: {frame_data.hex()}")
                # Try to decode protobuf fields
                decode_proto(frame_data, indent=2)

            frame_idx += 1
            print()

except Exception as e:
    print(f"Error: {e}")


def decode_proto(data, indent=0):
    """Recursively decode and print protobuf fields."""
    pad = " " * indent
    pos = 0
    while pos < len(data):
        byte = data[pos]
        tag = byte >> 3
        wire = byte & 0x7
        pos += 1

        # Handle multi-byte varint tags
        if byte & 0x80:
            tag_val = byte & 0x7f
            shift = 7
            while pos < len(data) and data[pos] & 0x80:
                tag_val |= (data[pos] & 0x7f) << shift
                shift += 7
                pos += 1
            if pos < len(data):
                tag_val |= (data[pos] & 0x7f) << shift
                pos += 1
            tag = tag_val >> 3
            wire = tag_val & 0x7

        if wire == 0:  # varint
            val, pos = read_varint(data, pos)
            print(f"{pad}field {tag} (varint): {val}")
        elif wire == 1:  # 64-bit
            val = data[pos:pos+8]
            pos += 8
            print(f"{pad}field {tag} (64-bit): {val.hex()}")
        elif wire == 2:  # length-delimited
            length, pos = read_varint(data, pos)
            val = data[pos:pos+length]
            pos += length
            # Try as UTF-8 string
            try:
                s = val.decode("utf-8")
                if all(32 <= ord(c) < 127 or c in "\n\r\t" for c in s):
                    print(f"{pad}field {tag} (string): {s!r}")
                else:
                    raise ValueError
            except (ValueError, UnicodeDecodeError):
                print(f"{pad}field {tag} (bytes, {length}b): {val.hex()}")
                # Try as nested message
                try:
                    print(f"{pad}  [as nested message:]")
                    decode_proto(val, indent + 4)
                except Exception:
                    pass
        elif wire == 5:  # 32-bit
            val = data[pos:pos+4]
            pos += 4
            print(f"{pad}field {tag} (32-bit): {val.hex()}")
        else:
            print(f"{pad}field {tag} (unknown wire {wire}) - stopping")
            break


def read_varint(data, pos):
    result = 0
    shift = 0
    while pos < len(data):
        byte = data[pos]
        pos += 1
        result |= (byte & 0x7f) << shift
        if not (byte & 0x80):
            break
        shift += 7
    return result, pos


# Re-run decode since function was defined after first use
print("=== Re-parsing response ===")
try:
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
        pos = 0
        while pos < len(data):
            flags = data[pos]
            length = struct.unpack(">I", data[pos+1:pos+5])[0]
            pos += 5
            frame_data = data[pos:pos+length]
            pos += length
            if not (flags & 0x80):
                print(f"\nData frame ({len(frame_data)} bytes):")
                decode_proto(frame_data)
            else:
                print(f"\nTrailers: {frame_data.decode('utf-8', errors='replace')}")
except Exception as e:
    print(f"Error: {e}")
