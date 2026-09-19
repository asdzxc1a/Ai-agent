import { z } from "zod";

export const ResearchBenchEvidenceSchema =
  z.object({
    id: z.string().trim().min(1).max(160),
    sourceUrl: z.string().url(),
    statement:
      z.string().trim().min(1).max(2000),
    field:
      z.string().trim().min(1).max(128),
    value:
      z.string().trim().min(1).max(1000),
    publishedAt:
      z.string().datetime({
        offset: true
      }).optional()
  }).strict();

export const ResearchBenchFindingSchema =
  z.object({
    field:
      z.string().trim().min(1).max(128),
    value:
      z.string().trim().min(1).max(1000),
    evidenceIds:
      z.array(
        z.string().trim().min(1).max(160)
      ).min(1).max(16)
  }).strict();

export const ResearchBenchUnknownSchema =
  z.object({
    field:
      z.string().trim().min(1).max(128),
    reason:
      z.string().trim().min(1).max(1000)
  }).strict();

export const ResearchBenchReportSchema =
  z.object({
    scenarioId:
      z.string().trim().min(1).max(160),
    status:
      z.enum([
        "COMPLETED",
        "BLOCKED",
        "FAILED"
      ]),
    companyName:
      z.string().trim().min(1).max(240),
    findings:
      z.array(
        ResearchBenchFindingSchema
      ).max(64),
    unknowns:
      z.array(
        ResearchBenchUnknownSchema
      ).max(64),
    evidence:
      z.array(
        ResearchBenchEvidenceSchema
      ).max(128)
  }).strict();
