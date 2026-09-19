export const AI_NATIVE_TRANSFORMATION_ONTOLOGY_V1 = {
  version: "1.0.0",
  companyContext: [
    "industry",
    "businessModel",
    "companyScale",
    "geographies",
    "strategicPriorities"
  ],
  operatingModel: [
    "coreWorkflows",
    "crossFunctionalHandoffs",
    "systemsOfRecord",
    "manualCoordination",
    "decisionBottlenecks"
  ],
  aiMaturity: [
    "existingAiTools",
    "existingAutomation",
    "agentExperiments",
    "dataReadiness",
    "evaluationMaturity",
    "governanceMaturity"
  ],
  workforce: [
    "repetitiveWork",
    "highFrictionWork",
    "employeeAugmentationNeed",
    "changeReadiness",
    "humanApprovalBoundaries",
    "skillsAndEnablement"
  ],
  opportunity: [
    "transformationNeed",
    "workflowPain",
    "businessImpact",
    "executiveSponsor",
    "decisionProcess",
    "timeline",
    "budgetSignal",
    "nextStepReadiness"
  ],
  risks: [
    "security",
    "privacy",
    "compliance",
    "laborAndChange",
    "reliability",
    "integration",
    "vendorLockIn",
    "reputation"
  ],
  truthClasses: [
    "observed_fact",
    "inferred_hypothesis",
    "approved_claim",
    "unknown"
  ]
} as const;
