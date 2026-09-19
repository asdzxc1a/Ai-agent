import type { ServiceOffer } from "./contracts.js";

export const ASTRA_SERVICE_OFFER_V1: ServiceOffer = {
  id: "ai-native-transformation-v1",
  name: "AI-native company and workforce transformation",
  summary:
    "Consultative work to help organizations identify, design, implement, and operationalize bounded workflows where employees and reliable AI systems work together.",
  approvedClaims: [
    {
      id: "workflow-assessment",
      text:
        "We can assess existing workflows to identify bounded work where AI can augment employees or automate repeatable steps.",
      evidenceRequirement: "operator_approved",
      notes: null
    },
    {
      id: "agent-workflow-design",
      text:
        "We can design AI-agent and AI-worker workflows with explicit human, tool, data, and authorization boundaries.",
      evidenceRequirement: "operator_approved",
      notes: null
    },
    {
      id: "implementation-support",
      text:
        "We can support implementation and integration of approved AI workflows into existing operating processes.",
      evidenceRequirement: "operator_approved",
      notes: null
    },
    {
      id: "evaluation-and-reliability",
      text:
        "We can define evaluation, evidence, and reliability gates for AI workflows before expanding autonomy.",
      evidenceRequirement: "operator_approved",
      notes: null
    }
  ],
  prohibitedClaims: [
    "guaranteed cost savings",
    "guaranteed revenue increase",
    "guaranteed headcount reduction",
    "guaranteed deployment timeline",
    "guaranteed legal or regulatory compliance",
    "named customer results without approved evidence",
    "pricing or discounts not explicitly approved",
    "a claim that an external action happened before a verified receipt exists"
  ],
  unknowns: [
    "default pricing and commercial packaging",
    "standard implementation timeline",
    "approved named customer references",
    "approved quantified ROI claims",
    "industry-specific legal or compliance guarantees"
  ]
};
