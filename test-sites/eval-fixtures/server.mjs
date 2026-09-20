import { createServer } from "node:http";
import { URL } from "node:url";

const host =
  process.env.EVAL_FIXTURE_HOST ??
  "0.0.0.0";
const port = Number(
  process.env.EVAL_FIXTURE_PORT ??
  "4174"
);
const fixtureVersion = "gate8-v1";

function page(
  title,
  body,
  script = ""
) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <title>${title}</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      ${body}
      <pre id="eval-result"></pre>
    </main>
    <script>
      const astraEvalState = {
        complete: false
      };
      const astraEvalResult =
        document.querySelector("#eval-result");

      window.__ASTRA_SET_EVAL__ = (patch) => {
        Object.assign(
          astraEvalState,
          patch
        );
        astraEvalResult.textContent =
          JSON.stringify(astraEvalState);
      };

      window.__ASTRA_SET_EVAL__({});
      ${script}
    </script>
  </body>
</html>`;
}

function route(pathname) {
  switch (pathname) {
    case "/button":
      return page(
        "Single click",
        `<button id="complete">
          Complete task
        </button>`,
        `
          document
            .querySelector("#complete")
            .addEventListener(
              "click",
              () => {
                window.__ASTRA_SET_EVAL__({
                  complete: true
                });
              }
            );
        `
      );

    case "/two-step":
      return page(
        "Two step navigation",
        `<a id="next" href="/two-step/next">
          Open next page
        </a>`
      );

    case "/two-step/next":
      return page(
        "Two step finish",
        `<button id="finish">
          Finish task
        </button>`,
        `
          document
            .querySelector("#finish")
            .addEventListener(
              "click",
              () => {
                window.__ASTRA_SET_EVAL__({
                  complete: true
                });
              }
            );
        `
      );

    case "/form":
      return page(
        "Form input",
        `<form id="task-form">
          <label>
            Name
            <input id="name" />
          </label>
          <label>
            Email
            <input id="email" />
          </label>
          <button id="submit" type="submit">
            Submit
          </button>
        </form>`,
        `
          document
            .querySelector("#task-form")
            .addEventListener(
              "submit",
              (event) => {
                event.preventDefault();
                const name =
                  document.querySelector(
                    "#name"
                  ).value;
                const email =
                  document.querySelector(
                    "#email"
                  ).value;

                window.__ASTRA_SET_EVAL__({
                  complete:
                    name === "Astra" &&
                    email ===
                      "astra@example.test"
                });
              }
            );
        `
      );

    case "/validation":
      return page(
        "Validation recovery",
        `<form id="validation-form">
          <label>
            Code
            <input id="code" />
          </label>
          <button id="submit" type="submit">
            Submit
          </button>
          <p id="error"></p>
        </form>`,
        `
          document
            .querySelector(
              "#validation-form"
            )
            .addEventListener(
              "submit",
              (event) => {
                event.preventDefault();
                const code =
                  document.querySelector(
                    "#code"
                  ).value;

                if (code !== "OK") {
                  document
                    .querySelector("#error")
                    .textContent =
                      "Code is required";
                  window.__ASTRA_SET_EVAL__({
                    complete: false,
                    error: "required"
                  });
                  return;
                }

                document
                  .querySelector("#error")
                  .textContent = "";
                window.__ASTRA_SET_EVAL__({
                  complete: true,
                  error: null
                });
              }
            );
        `
      );

    case "/dropdown":
      return page(
        "Dropdown selection",
        `<label>
          Choice
          <select id="choice">
            <option value="alpha">Alpha</option>
            <option value="beta">Beta</option>
          </select>
        </label>`,
        `
          document
            .querySelector("#choice")
            .addEventListener(
              "change",
              (event) => {
                const choice =
                  event.target.value;
                window.__ASTRA_SET_EVAL__({
                  complete:
                    choice === "beta",
                  choice
                });
              }
            );
        `
      );

    case "/search":
      return page(
        "Search results",
        `<label>
          Search
          <input id="query" />
        </label>
        <button id="search">Search</button>
        <button id="result" hidden>
          Astra result
        </button>`,
        `
          const result =
            document.querySelector(
              "#result"
            );

          document
            .querySelector("#search")
            .addEventListener(
              "click",
              () => {
                const query =
                  document.querySelector(
                    "#query"
                  ).value;
                result.hidden =
                  query !== "astra";
              }
            );

          result.addEventListener(
            "click",
            () => {
              window.__ASTRA_SET_EVAL__({
                complete: true
              });
            }
          );
        `
      );

    case "/modal":
      return page(
        "Modal confirmation",
        `<button id="open-modal">
          Open modal
        </button>
        <dialog id="task-modal">
          <p>Confirm this task.</p>
          <button id="confirm-modal">
            Confirm
          </button>
        </dialog>`,
        `
          const dialog =
            document.querySelector(
              "#task-modal"
            );

          document
            .querySelector(
              "#open-modal"
            )
            .addEventListener(
              "click",
              () => dialog.showModal()
            );

          document
            .querySelector(
              "#confirm-modal"
            )
            .addEventListener(
              "click",
              () => {
                dialog.close();
                window.__ASTRA_SET_EVAL__({
                  complete: true
                });
              }
            );
        `
      );

    case "/new-tab":
      return page(
        "New tab",
        `<a
          id="open-target"
          href="/new-tab/target"
          target="_blank"
        >
          Open target
        </a>`
      );

    case "/new-tab/target":
      return page(
        "New tab target",
        `<button id="finish">
          Finish in new tab
        </button>`,
        `
          document
            .querySelector("#finish")
            .addEventListener(
              "click",
              () => {
                window.__ASTRA_SET_EVAL__({
                  complete: true
                });
              }
            );
        `
      );

    case "/iframe":
      return page(
        "Iframe task",
        `<iframe
          id="task-frame"
          src="/iframe/content"
          title="Task frame"
        ></iframe>`
      );

    case "/iframe/content":
      return page(
        "Iframe content",
        `<button id="inside">
          Complete iframe task
        </button>`,
        `
          document
            .querySelector("#inside")
            .addEventListener(
              "click",
              () => {
                window.parent
                  .__ASTRA_SET_EVAL__({
                    complete: true
                  });
              }
            );
        `
      );

    case "/table":
      return page(
        "Table selection",
        `<table>
          <tbody>
            <tr>
              <td>A</td>
              <td>
                <button id="select-a">
                  Select A
                </button>
              </td>
            </tr>
            <tr>
              <td>B</td>
              <td>
                <button id="select-b">
                  Select B
                </button>
              </td>
            </tr>
          </tbody>
        </table>`,
        `
          document
            .querySelector("#select-b")
            .addEventListener(
              "click",
              () => {
                window.__ASTRA_SET_EVAL__({
                  complete: true,
                  selected: "B"
                });
              }
            );
        `
      );

    case "/delay":
      return page(
        "Delayed content",
        `<button id="load">
          Load delayed control
        </button>
        <div id="container"></div>`,
        `
          document
            .querySelector("#load")
            .addEventListener(
              "click",
              () => {
                setTimeout(() => {
                  const button =
                    document.createElement(
                      "button"
                    );
                  button.id = "delayed";
                  button.textContent =
                    "Complete delayed task";
                  button.addEventListener(
                    "click",
                    () => {
                      window
                        .__ASTRA_SET_EVAL__({
                          complete: true
                        });
                    }
                  );
                  document
                    .querySelector(
                      "#container"
                    )
                    .append(button);
                }, 75);
              }
            );
        `
      );

    case "/cart":
      return page(
        "Cart selection",
        `<label>
          Color
          <select id="color">
            <option value="blue">Blue</option>
            <option value="red">Red</option>
          </select>
        </label>
        <button id="add">Add widget</button>`,
        `
          document
            .querySelector("#add")
            .addEventListener(
              "click",
              () => {
                const color =
                  document.querySelector(
                    "#color"
                  ).value;
                window.__ASTRA_SET_EVAL__({
                  complete:
                    color === "red",
                  cartCount:
                    color === "red"
                      ? 1
                      : 0
                });
              }
            );
        `
      );

    case "/session":
      return page(
        "Session state",
        `<button id="login">
          Create session
        </button>`,
        `
          document
            .querySelector("#login")
            .addEventListener(
              "click",
              () => {
                localStorage.setItem(
                  "astra-session",
                  "active"
                );
                document.cookie =
                  "astra_session=active; SameSite=Lax";
                window.__ASTRA_SET_EVAL__({
                  complete: true,
                  session:
                    localStorage.getItem(
                      "astra-session"
                    )
                });
              }
            );
        `
      );

    default:
      return undefined;
  }
}

const server = createServer(
  (request, response) => {
    const requestUrl = new URL(
      request.url ?? "/",
      "http://eval.fixture.local"
    );

    if (
      requestUrl.pathname === "/health"
    ) {
      response.writeHead(200, {
        "content-type":
          "application/json",
        "cache-control": "no-store"
      });
      response.end(
        JSON.stringify({
          status: "ok",
          fixtureVersion
        })
      );
      return;
    }

    const html = route(
      requestUrl.pathname
    );

    if (html === undefined) {
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
    response.end(html);
  }
);

server.listen(port, host, () => {
  console.log(
    `Eval fixture listening on http://${host}:${port}`
  );
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
