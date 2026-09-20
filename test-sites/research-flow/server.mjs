import { createServer } from "node:http";

const host =
  process.env.RESEARCH_FIXTURE_HOST ??
  "0.0.0.0";
const port = Number(
  process.env.RESEARCH_FIXTURE_PORT ??
  "4174"
);

function html(
  title,
  body
) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    "    <title>" +
      title +
      "</title>",
    "  </head>",
    "  <body>",
    "    <main>",
    "      <h1>" +
      title +
      "</h1>",
    body,
    "    </main>",
    "  </body>",
    "</html>"
  ].join("\n");
}

const pages = new Map([
  [
    "/research",
    html(
      "Acme prospect research",
      [
        '      <p>Start the approved deterministic research flow.</p>',
        '      <a id="company-profile" href="/research/company">',
        "        Open company profile",
        "      </a>"
      ].join("\n")
    )
  ],
  [
    "/research/company",
    html(
      "Acme company profile",
      [
        "      <p>COMPANY name=Acme industry=manufacturing</p>",
        '      <a id="operations-evidence" href="/research/operations">',
        "        Open operations evidence",
        "      </a>"
      ].join("\n")
    )
  ],
  [
    "/research/operations",
    html(
      "Acme operations evidence",
      [
        "      <p>OPERATIONS workflow=manual-handoffs</p>",
        '      <a id="finish-research" href="/research/complete">',
        "        Finish research",
        "      </a>"
      ].join("\n")
    )
  ],
  [
    "/research/complete",
    html(
      "Research complete",
      '      <p id="research-result">RESEARCH_RESULT company=Acme workflow=manual-handoffs status=complete</p>'
    )
  ]
]);

const server = createServer(
  (request, response) => {
    if (
      request.url ===
      "/health"
    ) {
      response.writeHead(200, {
        "content-type":
          "application/json"
      });
      response.end(
        JSON.stringify({
          status: "ok"
        })
      );
      return;
    }

    const page =
      request.url === undefined
        ? undefined
        : pages.get(
            request.url
          );

    if (page === undefined) {
      response.writeHead(404, {
        "content-type":
          "text/plain; charset=utf-8"
      });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type":
        "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(page);
  }
);

server.listen(
  port,
  host,
  () => {
    console.log(
      "Research fixture listening on http://" +
        host +
        ":" +
        String(port)
    );
  }
);

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
