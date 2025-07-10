import httpBridge from 'react-native-http-bridge';
import NetInfo from '@react-native-community/netinfo';

const PORT = 12346;

const getRemotePageHTML = () => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>OrionTV Remote</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #121212; color: white; }
      h3 { color: #eee; }
      #container { display: flex; flex-direction: column; align-items: center; width: 90%; max-width: 400px; }
      #text { width: 100%; padding: 15px; font-size: 16px; border-radius: 8px; border: 1px solid #333; background-color: #2a2a2a; color: white; margin-bottom: 20px; box-sizing: border-box; }
      button { width: 100%; padding: 15px; font-size: 18px; font-weight: bold; border: none; border-radius: 8px; background-color: #007AFF; color: white; cursor: pointer; }
      button:active { background-color: #0056b3; }
    </style>
  </head>
  <body>
    <div id="container">
      <h3>Send a message to TV</h3>
      <input id="text" placeholder="Type here..." />
      <button onclick="send()">Send</button>
    </div>
    <script>
      window.addEventListener('DOMContentLoaded', () => {
        fetch('/handshake', { method: 'POST' }).catch(console.error);
      });
      function send() {
        const input = document.getElementById("text");
        const value = input.value;
        if (value) {
          fetch("/message", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: value })
          })
          .catch(err => console.error(err));
          input.value = '';
        }
      }
    </script>
  </body>
  </html>
  `;
};

class RemoteControlService {
  private isRunning = false;
  private onMessage: (message: string) => void = () => {};
  private onHandshake: () => void = () => {};

  public init(actions: { onMessage: (message: string) => void; onHandshake: () => void }) {
    this.onMessage = actions.onMessage;
    this.onHandshake = actions.onHandshake;
  }

  public async startServer(): Promise<string> {
    console.log('[RemoteControl] Attempting to start server...');
    if (this.isRunning) {
      console.log('[RemoteControl] Server is already running.');
      throw new Error('Server is already running.');
    }

    const netState = await NetInfo.fetch();
    console.log('[RemoteControl] NetInfo state:', JSON.stringify(netState, null, 2));
    let ipAddress: string | null = null;
    if (netState.type === 'wifi' || netState.type === 'ethernet') {
      ipAddress = (netState.details as any)?.ipAddress ?? null;
    }

    if (!ipAddress) {
      console.error('[RemoteControl] Could not get IP address.');
      throw new Error('无法获取IP地址，请确认设备已连接到WiFi或以太网。');
    }
    console.log(`[RemoteControl] Got IP address: ${ipAddress}`);

    try {
      // The third argument to start() is the request handler, not a startup callback.
      httpBridge.start(
        PORT,
        'OrionTVRemoteService',
        (request: { url: string; type: string; requestId: string; postData: string }) => {
          const { url, type: method, requestId, postData: body } = request;

          if (method === 'GET' && url === '/') {
            const html = getRemotePageHTML();
            httpBridge.respond(requestId, 200, 'text/html', html);
          } else if (method === 'POST' && url === '/message') {
            try {
              const parsedBody = JSON.parse(body);
              const message = parsedBody.message;
              if (message) {
                this.onMessage(message);
              }
              httpBridge.respond(requestId, 200, 'application/json', JSON.stringify({ status: 'ok' }));
            } catch (e) {
              httpBridge.respond(requestId, 400, 'application/json', JSON.stringify({ error: 'Bad Request' }));
            }
          } else if (method === 'POST' && url === '/handshake') {
            this.onHandshake();
            httpBridge.respond(requestId, 200, 'application/json', JSON.stringify({ status: 'ok' }));
          } else {
            httpBridge.respond(requestId, 404, 'text/plain', 'Not Found');
          }
        }
      );

      console.log('[RemoteControl] http-bridge start command issued.');
      this.isRunning = true;
      const url = `http://${ipAddress}:${PORT}`;
      console.log(`[RemoteControl] Server should be running at: ${url}`);
      return url;
    } catch (error) {
      console.error('[RemoteControl] Failed to issue start command to http-bridge.', error);
      this.isRunning = false;
      throw new Error(error instanceof Error ? error.message : 'Failed to start server');
    }
  }

  public stopServer() {
    if (this.isRunning) {
      httpBridge.stop();
      this.isRunning = false;
    }
  }
}

export const remoteControlService = new RemoteControlService();