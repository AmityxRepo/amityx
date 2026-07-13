import type {
  CrmOnboardingStage,
  CrmSubscriptionStatus,
  CrmPriority,
  CrmCommType,
  CrmFollowup,
  CrmHubListItem,
} from '../../repository/schema'

export const ONBOARDING_STAGES: CrmOnboardingStage[]
export const ONBOARDING_STAGE_LABELS: Record<CrmOnboardingStage, string>
export const SUBSCRIPTION_STATUSES: CrmSubscriptionStatus[]
export const SUBSCRIPTION_STATUS_LABELS: Record<CrmSubscriptionStatus, string>
export const PRIORITY_LABELS: Record<CrmPriority, string>
export const COMM_TYPE_LABELS: Record<CrmCommType, string>

export function summarizeBySubscriptionStatus(
  hubs: Pick<CrmHubListItem, 'subscription_status'>[],
): Record<CrmSubscriptionStatus, number>

export function summarizeByOnboardingStage(
  hubs: Pick<CrmHubListItem, 'onboarding_stage'>[],
): Record<CrmOnboardingStage, number>

export function isOverdue(followup: Pick<CrmFollowup, 'status' | 'due_date'>, today?: Date | string): boolean
export function isDueToday(followup: Pick<CrmFollowup, 'status' | 'due_date'>, today?: Date | string): boolean
export function followupUrgency(
  followup: Pick<CrmFollowup, 'status' | 'due_date'>,
  today?: Date | string,
): 'overdue' | 'due_today' | 'upcoming'
export function sortOpenFollowups<T extends Pick<CrmFollowup, 'status' | 'due_date'>>(followups: T[]): T[]
export function countOverdue(followups: Pick<CrmFollowup, 'status' | 'due_date'>[], today?: Date | string): number

export function filterHubs(
  hubs: CrmHubListItem[],
  opts?: { search?: string; status?: CrmSubscriptionStatus | 'all' },
): CrmHubListItem[]

export function archiveConsequenceCopy(hubName: string | null | undefined, archived: boolean): string
