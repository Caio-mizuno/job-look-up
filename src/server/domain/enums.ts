import { z } from "zod";

export const WorkModelEnum = z.enum(["remote", "hybrid", "onsite"]);
export const ContractEnum = z.enum(["clt", "pj", "other"]);
export const SeniorityEnum = z.enum(["junior", "pleno", "senior", "especialista", "lead"]);

export type WorkModel = z.infer<typeof WorkModelEnum>;
export type Contract = z.infer<typeof ContractEnum>;
export type Seniority = z.infer<typeof SeniorityEnum>;
