export {
  ApprovedClaimEvidenceSchema,
  BuyerSchema,
  DecisionClaimSchema,
  EVIDENCE_KINDS,
  EvidenceSchema,
  HypothesisEvidenceSchema,
  NEXT_ACTION_KINDS,
  NextActionSchema,
  ObservedEvidenceSchema,
  OPPORTUNITY_STAGES,
  OpportunitySchema,
  OutcomeSchema,
  PROSPECT_FITS,
  ProspectSchema,
  PublicProofClaimSchema,
  PublicProofSchema,
  QUALIFICATION_DIMENSIONS,
  QualificationDimensionSchema,
  QualificationStateSchema,
  SALES_SIGNALS,
  SalesDecisionSchema,
  ServiceClaimSchema,
  ServiceOfferSchema,
  UnknownEvidenceSchema,
  emptyQualificationState,
  validateDecisionEvidence,
  validatePublicProofEvidence
} from "./contracts.js";

export type {
  Buyer,
  Evidence,
  NextAction,
  NextActionKind,
  Opportunity,
  Outcome,
  Prospect,
  PublicProof,
  QualificationDimensionKey,
  QualificationState,
  SalesDecision,
  SalesSignal,
  ServiceOffer
} from "./contracts.js";

export { ASTRA_SERVICE_OFFER_V1 } from "./service-offer.js";
export { AI_NATIVE_TRANSFORMATION_ONTOLOGY_V1 } from "./ontology.js";

export {
  selectConsultativeBaseline
} from "./policy.js";

export type {
  ConsultativePolicyInput
} from "./policy.js";
