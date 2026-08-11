/**
 * Filenames must match the wav assets bundled in the iOS/Android app
 * (expo-notifications plugin → TecnoWallet/*.wav). APNS/Expo use these
 * names so locked-phone alerts play the same sounds as in-app local pushes.
 */
export const PUSH_SOUND = {
  income: 'ingreso.wav',
  expense: 'gasto.wav',
  calendar: 'calendario.wav',
  recaudo: 'sobres.wav',
  create: 'sobres.wav',
} as const;

export type PushSoundFile = (typeof PUSH_SOUND)[keyof typeof PUSH_SOUND];

export function pushSoundForKind(
  kind: string | undefined,
  fallback: PushSoundFile = PUSH_SOUND.create,
): PushSoundFile {
  const value = (kind || '').toLowerCase();
  if (value === 'income' || value === 'ingreso') return PUSH_SOUND.income;
  if (value === 'expense' || value === 'gasto') return PUSH_SOUND.expense;
  if (value === 'calendar' || value === 'calendario') return PUSH_SOUND.calendar;
  if (
    value === 'recaudo' ||
    value === 'aporte' ||
    value === 'withdrawal' ||
    value === 'retiro' ||
    value === 'sobres' ||
    value === 'envelope' ||
    value === 'account' ||
    value === 'goal' ||
    value === 'planning' ||
    value === 'create' ||
    value === 'invite' ||
    value === 'access_request'
  ) {
    return PUSH_SOUND.recaudo;
  }
  return fallback;
}
