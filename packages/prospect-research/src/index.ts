export {
  ApprovedResearchTargetSchema,
  CompletedProspectResearchAttemptSchema,
  FailedProspectResearchAttemptSchema,
  GroundedResearchValueSchema,
  HypothesisResearchClaimSchema,
  LIVE_RESEARCH_FAILURE_CODES,
  ObservedResearchClaimSchema,
  ProspectResearchAttemptSchema,
  ProspectResearchClaimSchema,
  ProspectResearchEvidenceResultSchema,
  ProspectResearchEvidenceSchema,
  ProspectResearchFailureSchema,
  ProspectResearchReportSchema,
  ProspectResearchResultSchema,
  ProspectResearchUnknownSchema,
  RESEARCH_UNCERTAINTY,
  ResearchApprovalSchema,
  ResearchDomainSchema
} from "./schema.js";

export type {
  ApprovedResearchTarget,
  CompletedProspectResearchAttempt,
  FailedProspectResearchAttempt,
  GroundedResearchValue,
  HypothesisResearchClaim,
  LiveResearchFailureCode,
  ObservedResearchClaim,
  ProspectResearchAttempt,
  ProspectResearchClaim,
  ProspectResearchEvidence,
  ProspectResearchEvidenceResult,
  ProspectResearchFailure,
  ProspectResearchReport,
  ProspectResearchResult,
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

export type {
  ProspectResearchRunReader,
  RecordCompletedProspectResearchInput,
  RecordFailedProspectResearchInput
} from "./service.js";

export {
  buildCompletedProspectResearchAttempt,
  hostnameWithinApprovedDomain,
  isApprovedResearchUrl,
  researchNetworkPolicyOptions,
  sameApprovedResearchTarget,
  toSalesEvidence,
  validateProspectResearch,
  validateProspectResearchResult
} from "./validation.js";

export type {
  BuildCompletedProspectResearchAttemptInput
} from "./validation.js";
