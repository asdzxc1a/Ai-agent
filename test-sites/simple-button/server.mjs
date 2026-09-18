import { createServer } from "node:http";

const host = process.env.FIXTURE_HOST ?? "0.0.0.0";
const port = Number(process.env.FIXTURE_PORT ?? "4173");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Astra Gate 1 Fixture</title>
  </head>
  <body>
    <main>
      <h1>Steel deterministic fixture</h1>
      <button id="increment" type="button">Increment count</button>
      <p id="status" data-state="idle">
        Count: <span id="count">0</span>
      </p>
    </main>
    <script>
      const button = document.querySelector("#increment");
      const count = document.querySelector("#count");
      const status = document.querySelector("#status");

      button.addEventListener("click", () => {
        count.textContent = String(Number(count.textContent) + 1);
        status.dataset.state = "clicked";
      });
    </script>
  </body>
</html>`;

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, {
      "content-type": "application/json"
    });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
});

server.listen(port, host, () => {
  console.log(`Fixture listening on http://${host}:${port}`);
});

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
