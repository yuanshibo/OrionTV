import TCPHttpServer from "./tcpHttpServer";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('RemoteControl');

const getRemotePageHTML = () => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>OrionTV 远程输入</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <style>
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; margin: 0; padding: 24px 16px; background-color: #121212; color: #fff; }
      h2 { color: #fff; margin: 10px 0 4px; font-size: 22px; }
      p.subtitle { color: #888; margin: 0 0 20px; font-size: 13px; text-align: center; }
      #container { width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 14px; }
      .card { background: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 16px; }
      .card-title { font-size: 14px; font-weight: 600; color: #aaa; margin-bottom: 8px; }
      input, textarea { width: 100%; padding: 12px 14px; font-size: 15px; border-radius: 8px; border: 1px solid #444; background-color: #2a2a2a; color: white; margin-bottom: 10px; outline: none; }
      input:focus, textarea:focus { border-color: #007AFF; }
      .btn-row { display: flex; gap: 8px; }
      button { flex: 1; padding: 12px; font-size: 15px; font-weight: 600; border: none; border-radius: 8px; background-color: #007AFF; color: white; cursor: pointer; transition: background-color 0.2s; }
      button:active { background-color: #0056b3; }
      button.secondary { background-color: #333; color: #ccc; }
      button.secondary:active { background-color: #444; }
      #toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #28a745; color: #fff; padding: 10px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: none; z-index: 100; }
    </style>
  </head>
  <body>
    <div id="toast"></div>
    <h2>OrionTV 远程输入</h2>
    <p class="subtitle">在手机上输入内容，一键同步到电视</p>
    <div id="container">
      <div class="card">
        <div class="card-title">🚀 设置 API 服务器地址</div>
        <input id="apiUrl" type="url" placeholder="如: http://192.168.1.100:8080" />
        <button onclick="sendTargeted('api', 'apiUrl')">发送到电视 API 设置</button>
      </div>

      <div class="card">
        <div class="card-title">📺 设置 M3U 直播源地址</div>
        <input id="m3uUrl" type="url" placeholder="如: http://example.com/live.m3u" />
        <button onclick="sendTargeted('m3u', 'm3uUrl')">发送到电视直播源设置</button>
      </div>

      <div class="card">
        <div class="card-title">🔍 搜索影视 / 通用文本</div>
        <input id="generalText" placeholder="输入影视名称或任意文本..." />
        <div class="btn-row">
          <button onclick="sendTargeted('search', 'generalText')">搜索影视</button>
          <button class="secondary" onclick="sendTargeted('text', 'generalText')">普通输入</button>
        </div>
      </div>
    </div>
    <script>
      function showToast(msg, isError) {
        const t = document.getElementById("toast");
        t.innerText = msg;
        t.style.backgroundColor = isError ? "#dc3545" : "#28a745";
        t.style.display = "block";
        setTimeout(() => { t.style.display = "none"; }, 2500);
      }

      window.addEventListener('DOMContentLoaded', () => {
        fetch('/handshake', { method: 'POST' }).catch(() => {});
      });

      function sendTargeted(type, inputId) {
        const input = document.getElementById(inputId);
        const val = input.value.trim();
        if (!val) {
          showToast("请输入内容后再发送", true);
          return;
        }
        fetch("/message", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: type + ":" + val })
        })
        .then(() => {
          showToast("✅ 已成功发送到电视！");
        })
        .catch(err => {
          showToast("❌ 发送失败，请检查网络", true);
        });
      }
    </script>
  </body>
  </html>
  `;
};

class RemoteControlService {
  private httpServer: TCPHttpServer;
  private onMessage: (message: string) => void = () => {};
  private onHandshake: () => void = () => {};

  constructor() {
    this.httpServer = new TCPHttpServer();
    this.setupRequestHandler();
  }

  private setupRequestHandler() {
    this.httpServer.setRequestHandler((request) => {
      logger.debug("[RemoteControl] Received request:", request.method, request.url);

      try {
        if (request.method === "GET" && request.url === "/") {
          return {
            statusCode: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
            body: getRemotePageHTML(),
          };
        } else if (request.method === "POST" && request.url === "/message") {
          try {
            const parsedBody = JSON.parse(request.body || "{}");
            const message = parsedBody.message;
            if (message) {
              this.onMessage(message);
            }
            return {
              statusCode: 200,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "ok" }),
            };
          } catch (parseError) {
            logger.info("[RemoteControl] Failed to parse message body:", parseError);
            return {
              statusCode: 400,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ error: "Invalid JSON" }),
            };
          }
        } else if (request.method === "POST" && request.url === "/handshake") {
          this.onHandshake();
          return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ok" }),
          };
        } else {
          return {
            statusCode: 404,
            headers: { "Content-Type": "text/plain" },
            body: "Not Found",
          };
        }
      } catch (error) {
        logger.info("[RemoteControl] Request handler error:", error);
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Internal Server Error" }),
        };
      }
    });
  }

  public init(actions: { onMessage: (message: string) => void; onHandshake: () => void }) {
    this.onMessage = actions.onMessage;
    this.onHandshake = actions.onHandshake;
  }

  public async startServer(): Promise<string> {
    logger.debug("[RemoteControl] Attempting to start server...");

    try {
      const url = await this.httpServer.start();
      logger.debug(`[RemoteControl] Server started successfully at: ${url}`);
      return url;
    } catch (error) {
      logger.info("[RemoteControl] Failed to start server:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to start server");
    }
  }

  public stopServer() {
    logger.debug("[RemoteControl] Stopping server...");
    this.httpServer.stop();
  }

  public isRunning(): boolean {
    return this.httpServer.getIsRunning();
  }
}

export const remoteControlService = new RemoteControlService();
