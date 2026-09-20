export {
  ApprovedResearchTargetSchema,
  CompletedProspectResearchAttemptSchema,
  FailedProspectResearchAttemptSchema,
  HypothesisResearchClaimSchema,
  LIVE_RESEARCH_FAILURE_CODES,
  ObservedResearchClaimSchema,
  ProspectResearchAttemptSchema,
  ProspectResearchClaimSchema,
  ProspectResearchEvidenceSchema,
  ProspectResearchFailureSchema,
  ProspectResearchReportSchema,
  ProspectResearchUnknownSchema,
  RESEARCH_UNCERTAINTY,
  ResearchApprovalSchema,
  ResearchDomainSchema
} from "./schema.js";

export type {
  ApprovedResearchTarget,
  CompletedProspectResearchAttempt,
  FailedProspectResearchAttempt,
  HypothesisResearchClaim,
  ObservedResearchClaim,
  ProspectResearchAttempt,
  ProspectResearchClaim,
  ProspectResearchEvidence,
  ProspectResearchFailure,
  ProspectResearchReport,
  ProspectResearchUnknown
} from "./schema.js";

export {
  InMemoryProspectResearchRepository
} from "./repository.js";

export type {
  ProspectResearchRepository
} from "./repository.js";

export {
  ProspectResearchService,
  ProspectResearchValidationError
} from "./service.js";

export {
  hostnameWithinApprovedDomain,
  isApprovedResearchUrl,
  researchNetworkPolicyOptions,
  sameApprovedResearchTarget,
  toSalesEvidence,
  validateProspectResearch
} from "./validation.js";
