import type {
  EvalActionSpec,
  EvalTask
} from "./types.js";

const CANONICAL_ORIGIN =
  "http://eval.fixture.local";

function action(
  method: EvalActionSpec["method"],
  selector: string,
  description: string,
  args?: string[]
): EvalActionSpec {
  return {
    selector,
    description,
    method,
    ...(args === undefined
      ? {}
      : {
          arguments: args
        })
  };
}

export const EVAL_TASKS: EvalTask[] = [
  {
    id: "single-click",
    version: 1,
    category: "button",
    startUrl: `${CANONICAL_ORIGIN}/button`,
    goal: "Click the Complete task button.",
    expected: {
      type: "state",
      value: { complete: true }
    },
    maxSteps: 2,
    timeoutMs: 10_000,
    contractActions: [
      action(
        "click",
        "#complete",
        "Click Complete task"
      )
    ]
  },
  {
    id: "two-step-navigation",
    version: 1,
    category: "multi-step-navigation",
    startUrl: `${CANONICAL_ORIGIN}/two-step`,
    goal:
      "Open the next page, then finish the task.",
    expected: {
      type: "state",
      value: { complete: true }
    },
    maxSteps: 4,
    timeoutMs: 15_000,
    contractActions: [
      action(
        "click",
        "#next",
        "Open the next page"
      ),
      action(
        "click",
        "#finish",
        "Finish the task"
      )
    ]
  },
  {
    id: "form-input",
    version: 1,
    category: "form",
    startUrl: `${CANONICAL_ORIGIN}/form`,
    goal:
      "Enter the requested name and email, then submit.",
    expected: {
      type: "state",
      value: { complete: true }
    },
    maxSteps: 5,
    timeoutMs: 15_000,
    contractActions: [
      action(
        "fill",
        "#name",
        "Enter the name",
        ["Astra"]
      ),
      action(
        "fill",
        "#email",
        "Enter the email",
        ["astra@example.test"]
      ),
      action(
        "click",
        "#submit",
        "Submit the form"
      )
    ]
  },
  {
    id: "validation-recovery",
    version: 1,
    category: "validation",
    startUrl: `${CANONICAL_ORIGIN}/validation`,
    goal:
      "Submit, fix the required code error with OK, and submit again.",
    expected: {
      type: "state",
      value: { complete: true }
    },
    maxSteps: 5,
    timeoutMs: 15_000,
    contractActions: [
      action(
        "click",
        "#submit",
        "Submit the empty form"
      ),
      action(
        "fill",
        "#code",
        "Enter the required code",
        ["OK"]
      ),
      action(
        "click",
        "#submit",
        "Submit the corrected form"
      )
    ]
  },
  {
    id: "dropdown-selection",
    version: 1,
    category: "dropdown",
    startUrl: `${CANONICAL_ORIGIN}/dropdown`,
    goal: "Select Beta from the dropdown.",
    expected: {
      type: "state",
      value: {
        complete: true,
        choice: "beta"
      }
    },
    maxSteps: 2,
    timeoutMs: 10_000,
    contractActions: [
      action(
        "select",
        "#choice",
        "Select Beta",
        ["beta"]
      )
    ]
  },
  {
    id: "search-result",
    version: 1,
    category: "search",
    startUrl: `${CANONICAL_ORIGIN}/search`,
    goal:
      "Search for astra and open the matching result.",
    expected: {
      type: "state",
      value: { complete: true }
    },
    maxSteps: 5,
    timeoutMs: 15_000,
    contractActions: [
      action(
        "fill",
        "#query",
        "Enter the search query",
        ["astra"]
      ),
      action(
        "click",
        "#search",
        "Run the search"
      ),
      action(
        "click",
        "#result",
        "Open the matching result"
      )
    ]
  },
  {
    id: "modal-confirm",
    version: 1,
    category: "modal",
    startUrl: `${CANONICAL_ORIGIN}/modal`,
    goal: "Open the modal and confirm it.",
    expected: {
      type: "state",
      value: { complete: true }
    },
    maxSteps: 4,
    timeoutMs: 15_000,
    contractActions: [
      action(
        "click",
        "#open-modal",
        "Open the modal"
      ),
      action(
        "click",
        "#confirm-modal",
        "Confirm the modal"
      )
    ]
  },
  {
    id: "new-tab",
    version: 1,
    category: "new-tab",
    startUrl: `${CANONICAL_ORIGIN}/new-tab`,
    goal:
      "Open the target in a new tab and finish there.",
    expected: {
      type: "state",
      value: { complete: true }
    },
    maxSteps: 4,
    timeoutMs: 15_000,
    contractActions: [
      action(
        "click-new-page",
        "#open-target",
        "Open the target in a new tab"
      ),
      action(
        "click",
        "#finish",
        "Finish in the new tab"
      )
    ]
  },
  {
    id: "iframe-button",
    version: 1,
    category: "iframe",
    startUrl: `${CANONICAL_ORIGIN}/iframe`,
    goal: "Click the button inside the iframe.",
    expected: {
      type: "state",
      value: { complete: true }
    },
    maxSteps: 3,
    timeoutMs: 15_000,
    contractActions: [
      action(
        "frame-click",
        "#task-frame",
        "Click the iframe button",
        ["#inside"]
      )
    ]
  },
  {
    id: "table-row",
    version: 1,
    category: "table",
    startUrl: `${CANONICAL_ORIGIN}/table`,
    goal: "Select row B from the table.",
    expected: {
      type: "state",
      value: {
        complete: true,
        selected: "B"
      }
    },
    maxSteps: 2,
    timeoutMs: 10_000,
    contractActions: [
      action(
        "click",
        "#select-b",
        "Select row B"
      )
    ]
  },
  {
    id: "delayed-content",
    version: 1,
    category: "loading-delay",
    startUrl: `${CANONICAL_ORIGIN}/delay`,
    goal:
      "Load the delayed control, then click it.",
    expected: {
      type: "state",
      value: { complete: true }
    },
    maxSteps: 5,
    timeoutMs: 15_000,
    contractActions: [
      action(
        "click",
        "#load",
        "Load the delayed control"
      ),
      action(
        "click",
        "#delayed",
        "Click the delayed control"
      )
    ]
  },
  {
    id: "cart-selection",
    version: 1,
    category: "cart",
    startUrl: `${CANONICAL_ORIGIN}/cart`,
    goal:
      "Choose red and add the widget to the cart.",
    expected: {
      type: "state",
      value: {
        complete: true,
        cartCount: 1
      }
    },
    maxSteps: 4,
    timeoutMs: 15_000,
    contractActions: [
      action(
        "select",
        "#color",
        "Choose red",
        ["red"]
      ),
      action(
        "click",
        "#add",
        "Add the widget to the cart"
      )
    ]
  },
  {
    id: "session-state",
    version: 1,
    category: "cookie-session",
    startUrl: `${CANONICAL_ORIGIN}/session`,
    goal:
      "Create the fixture session and persist it in browser storage.",
    expected: {
      type: "state",
      value: {
        complete: true,
        session: "active"
      }
    },
    maxSteps: 2,
    timeoutMs: 10_000,
    contractActions: [
      action(
        "click",
        "#login",
        "Create the fixture session"
      )
    ]
  }
];

export function resolveTaskStartUrl(
  task: EvalTask,
  baseUrl: string
): string {
  const canonical = new URL(task.startUrl);
  return new URL(
    `${canonical.pathname}${canonical.search}`,
    baseUrl.endsWith("/")
      ? baseUrl
      : `${baseUrl}/`
  ).toString();
}
