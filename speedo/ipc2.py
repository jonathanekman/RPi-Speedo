# from multiprocessing.connection import Listener

# address = ('localhost', 5000)     # family is deduced to be 'AF_INET'
# listener = Listener(address, authkey=b'secret password')
# conn = listener.accept()
# print 'connection accepted from', listener.last_accepted
# while True:
#     msg = conn.recv()
#     # do something with msg
#     if msg == 'close':
#         conn.close()
#         break
# listener.close()

import socket
 
# IPC parameters
HOST = '0.0.0.0' # The server's hostname or IP address
PORT = 5000 # The port used by the server
 
# Create socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((HOST, PORT))
 
# Send 'request'
s.sendall(b'Hello, world')
 
# Wait for 'response'
data = s.recv(1024)
print(f"Received data: {repr(data)}")