export interface MappedAuthError {
  kind:
    | 'duplicate_email'
    | 'weak_password'
    | 'email_not_confirmed'
    | 'invalid_credentials'
    | 'smtp'
    | 'rate_limited'
    | 'network'
    | 'generic'
  message: string
  action: 'signin' | 'resend' | 'reset' | 'retry' | null
}

export function mapAuthError(error: unknown): MappedAuthError

export type SignUpInterpretation = { kind: 'ok'; needsVerification: boolean } | MappedAuthError

export function interpretSignUp(result: { data?: unknown; error?: unknown }): SignUpInterpretation
