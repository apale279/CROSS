import type { UserProfile } from '@pma/types/userProfile'

/** Etichetta staff per medico/infermiere di riferimento (nome operatore). */
export function staffSoftRefFromUser(
  user: Pick<UserProfile, 'nome' | 'nomeUtente'> | null | undefined,
): string {
  if (!user) return ''
  const nome = String(user.nome ?? '').trim()
  if (nome) return nome
  return String(user.nomeUtente ?? '').trim()
}
