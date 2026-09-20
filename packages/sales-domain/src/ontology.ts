import type {
  TransformationArea
} from "./schemas.js";

export interface TransformationAreaDefinition {
  id: TransformationArea;
  label: string;
  diagnosticQuestion: string;
  exampleSignals: readonly string[];
}

export const TRANSFORMATION_ONTOLOGY_V1:
  readonly TransformationAreaDefinition[] =
  [
    {
      id: "workflow_redesign",
      label: "Workflow redesign",
      diagnosticQuestion:
        "Which end-to-end workflow creates the most friction or delay today?",
      exampleSignals: [
        "many handoffs",
        "manual re-entry",
        "slow approvals",
        "fragmented ownership"
      ]
    },
    {
      id: "employee_augmentation",
      label: "Employee augmentation",
      diagnosticQuestion:
        "Which recurring parts of employee work consume time without requiring the full judgment of the role?",
      exampleSignals: [
        "repetitive drafting",
        "manual research",
        "routine summarization",
        "high context switching"
      ]
    },
    {
      id: "agentic_automation",
      label: "AI workers and agents",
      diagnosticQuestion:
        "Which multi-step workflow could be delegated if every action were observable and governed?",
      exampleSignals: [
        "repeatable multi-step work",
        "queue backlogs",
        "operator bottlenecks",
        "cross-system tasks"
      ]
    },
    {
      id: "knowledge_work",
      label: "Knowledge work",
      diagnosticQuestion:
        "Where do teams repeatedly search, synthesize, or recreate knowledge?",
      exampleSignals: [
        "document search",
        "expert bottlenecks",
        "duplicated analysis",
        "slow onboarding"
      ]
    },
    {
      id: "customer_operations",
      label: "Customer operations",
      diagnosticQuestion:
        "Where do customer-facing teams lose time or consistency across service, sales, or support?",
      exampleSignals: [
        "slow response",
        "manual triage",
        "inconsistent follow-up",
        "context gaps"
      ]
    },
    {
      id: "backoffice_operations",
      label: "Back-office operations",
      diagnosticQuestion:
        "Which internal operations are high-volume, rules-heavy, or exception-driven?",
      exampleSignals: [
        "manual reconciliation",
        "document handling",
        "data entry",
        "routine compliance checks"
      ]
    },
    {
      id: "decision_support",
      label: "Decision support",
      diagnosticQuestion:
        "Which decisions are slowed by collecting and reconciling information from many sources?",
      exampleSignals: [
        "manual reporting",
        "slow analysis",
        "inconsistent inputs",
        "decision latency"
      ]
    },
    {
      id: "data_knowledge_foundation",
      label: "Data and knowledge foundation",
      diagnosticQuestion:
        "What data or knowledge constraints prevent reliable AI use today?",
      exampleSignals: [
        "poor data quality",
        "unclear access",
        "fragmented systems",
        "missing provenance"
      ]
    },
    {
      id: "ai_governance_operating_model",
      label: "AI governance and operating model",
      diagnosticQuestion:
        "How are AI use cases prioritized, governed, measured, and owned across the company?",
      exampleSignals: [
        "isolated pilots",
        "unclear ownership",
        "no evaluation standard",
        "shadow AI"
      ]
    },
    {
      id: "workforce_enablement_change",
      label: "Workforce enablement and change",
      diagnosticQuestion:
        "What would employees need in order to trust, adopt, and work effectively with AI?",
      exampleSignals: [
        "change fatigue",
        "skills gap",
        "job anxiety",
        "low adoption"
      ]
    }
  ] as const;
