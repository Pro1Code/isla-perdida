"""Isla Perdida - Servidor LAN.

Sirve los archivos del juego por HTTP y reenvía los mensajes entre jugadores
por WebSocket (ruta /ws). Solo usa la biblioteca estándar de Python 3.8+.

Uso:  python servidor.py [puerto]      (por defecto 8080)
"""
import asyncio
import base64
import hashlib
import json
import os
import socket
import struct
import sys
import urllib.parse
import webbrowser

ROOT = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
    '.mp3': 'audio/mpeg', '.webp': 'image/webp',
}

clients = {}
next_id = 1
host_id = None


class Client:
    def __init__(self, cid, writer):
        self.id = cid
        self.writer = writer
        self.info = {}
        self.lock = asyncio.Lock()

    async def send(self, text):
        data = text.encode('utf-8')
        n = len(data)
        if n < 126:
            head = struct.pack('!BB', 0x81, n)
        elif n < 65536:
            head = struct.pack('!BBH', 0x81, 126, n)
        else:
            head = struct.pack('!BBQ', 0x81, 127, n)
        async with self.lock:
            try:
                self.writer.write(head + data)
                await self.writer.drain()
            except Exception:
                pass


def send_to(client, obj):
    asyncio.ensure_future(client.send(json.dumps(obj, separators=(',', ':'))))


def broadcast(obj, exclude=None):
    text = json.dumps(obj, separators=(',', ':'))
    for c in list(clients.values()):
        if c.id != exclude:
            asyncio.ensure_future(c.send(text))


async def read_message(reader):
    """Lee un mensaje WebSocket completo (une fragmentos). Devuelve (opcode, bytes)."""
    buf, first_op = b'', None
    while True:
        b1, b2 = await reader.readexactly(2)
        fin, op = b1 & 0x80, b1 & 0x0F
        n = b2 & 0x7F
        if n == 126:
            n = struct.unpack('!H', await reader.readexactly(2))[0]
        elif n == 127:
            n = struct.unpack('!Q', await reader.readexactly(8))[0]
        mask = await reader.readexactly(4) if b2 & 0x80 else None
        data = await reader.readexactly(n)
        if mask and n:
            m = (mask * (n // 4 + 1))[:n]
            data = (int.from_bytes(data, 'big') ^ int.from_bytes(m, 'big')).to_bytes(n, 'big')
        if op >= 8:  # control: close / ping / pong
            return op, data
        if first_op is None:
            first_op = op
        buf += data
        if fin:
            return first_op, buf


async def ws_session(reader, writer):
    global next_id, host_id
    cid = next_id
    next_id += 1
    c = Client(cid, writer)
    clients[cid] = c
    if host_id not in clients:
        host_id = cid
    players = [{'id': o.id, **o.info} for o in clients.values() if o.id != cid]
    send_to(c, {'t': 'welcome', 'id': cid, 'host': host_id == cid, 'hostId': host_id, 'players': players})
    print(f'  + Jugador #{cid} conectado ({len(clients)} en línea)' + ('  [anfitrión]' if host_id == cid else ''))
    try:
        while True:
            op, data = await read_message(reader)
            if op == 8:
                break
            if op == 9:
                async with c.lock:
                    writer.write(struct.pack('!BB', 0x8A, len(data[:125])) + data[:125])
                continue
            if op != 1:
                continue
            try:
                msg = json.loads(data.decode('utf-8'))
            except Exception:
                continue
            if not isinstance(msg, dict):
                continue
            msg['from'] = cid
            if msg.get('t') == 'hello':
                c.info = {'name': str(msg.get('name', ''))[:16], 'color': str(msg.get('color', '#ccc'))[:9], 'ver': str(msg.get('ver', ''))[:12]}
                print(f'    #{cid} se llama "{c.info["name"]}"')
            to = msg.get('to')
            if to is not None:
                target = clients.get(to)
                if target:
                    send_to(target, msg)
            else:
                broadcast(msg, exclude=cid)
    except (asyncio.IncompleteReadError, ConnectionError, OSError):
        pass
    finally:
        clients.pop(cid, None)
        try:
            writer.close()
        except Exception:
            pass
        name = c.info.get('name', f'#{cid}')
        print(f'  - {name} se desconectó ({len(clients)} en línea)')
        if host_id == cid:
            host_id = next(iter(clients), None)
            if host_id is not None:
                print(f'    Nuevo anfitrión: #{host_id}')
                broadcast({'t': 'hostChanged', 'id': host_id})
        broadcast({'t': 'leave', 'id': cid})


async def serve_file(path, writer):
    path = urllib.parse.unquote(path.split('?', 1)[0].split('#', 1)[0])
    if path.endswith('/'):
        path += 'index.html'
    full = os.path.realpath(os.path.join(ROOT, path.lstrip('/')))
    inside = os.path.normcase(full).startswith(os.path.normcase(ROOT) + os.sep)
    if not inside or not os.path.isfile(full):
        body = b'404 - No encontrado'
        writer.write(b'HTTP/1.1 404 Not Found\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: '
                     + str(len(body)).encode() + b'\r\nConnection: close\r\n\r\n' + body)
    else:
        with open(full, 'rb') as f:
            body = f.read()
        ctype = TYPES.get(os.path.splitext(full)[1].lower(), 'application/octet-stream')
        writer.write(f'HTTP/1.1 200 OK\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\n'
                     f'Cache-Control: no-cache\r\nConnection: close\r\n\r\n'.encode() + body)
    await writer.drain()
    writer.close()


async def handle(reader, writer):
    try:
        req = await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'), 15)
    except Exception:
        writer.close()
        return
    lines = req.decode('latin-1').split('\r\n')
    try:
        method, path, _ = lines[0].split(' ', 2)
    except ValueError:
        writer.close()
        return
    headers = {}
    for line in lines[1:]:
        if ':' in line:
            k, v = line.split(':', 1)
            headers[k.strip().lower()] = v.strip()
    if path.startswith('/lan-info'):
        body = json.dumps({'ips': lan_ips(), 'port': PORT}).encode()
        head = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-cache\r\nContent-Length: %d\r\nConnection: close\r\n\r\n' % len(body)
        writer.write(head.encode() + body)
        await writer.drain()
        writer.close()
        return
    if path.startswith('/ws') and 'websocket' in headers.get('upgrade', '').lower():
        key = headers.get('sec-websocket-key', '')
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                      f'Sec-WebSocket-Accept: {accept}\r\n\r\n').encode())
        await writer.drain()
        await ws_session(reader, writer)
    else:
        try:
            await serve_file(path, writer)
        except Exception:
            writer.close()


def lan_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except Exception:
        pass
    return sorted(ip for ip in ips if not ip.startswith('127.') and not ip.startswith('169.254.'))


async def main():
    try:
        server = await asyncio.start_server(handle, '0.0.0.0', PORT)
    except OSError:
        print(f'\n  ERROR: el puerto {PORT} ya está en uso.')
        print(f'  ¿Ya hay otro servidor abierto? Ciérralo o usa otro puerto: python servidor.py 8081\n')
        return
    print()
    print('  ==============================================')
    print('        ISLA PERDIDA  -  Servidor LAN')
    print('  ==============================================')
    print(f'\n  Tú (anfitrión) abre:   http://localhost:{PORT}')
    ips = lan_ips()
    if ips:
        print('  Tus amigos abren:      ' + '   o   '.join(f'http://{ip}:{PORT}' for ip in ips))
    else:
        print('  (No se encontró una IP de red local. ¿Estás conectado al wifi?)')
    print('\n  Todos deben estar en la misma red (wifi o cable).')
    print('  Si Windows pregunta por el firewall, permite el acceso en "Redes privadas".')
    print('  Deja esta ventana abierta mientras juegan. Ctrl+C para cerrar.\n')
    if '--no-browser' not in sys.argv:
        try:
            webbrowser.open(f'http://localhost:{PORT}')
        except Exception:
            pass
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\n  Servidor cerrado.')
