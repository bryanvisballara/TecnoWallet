import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, Pill, useAppTheme } from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';
import type { CollaborationResourceInvite } from '@/services/collaboration-api';

export function CollaborationInvitesList({
  invites,
  emptyLabel = 'Aún no hay invitaciones en este recurso.',
  onCancelPending,
}: {
  invites: CollaborationResourceInvite[];
  emptyLabel?: string;
  onCancelPending?: (invite: CollaborationResourceInvite) => void;
}) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const roleLabels: Record<CollaborationResourceInvite['role'], string> = {
    member: copy.sharing.roleMember,
    editor: copy.sharing.roleEditor,
    viewer: copy.sharing.roleViewer,
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text }]}>{copy.sharing.invitations}</Text>
      {invites.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>{emptyLabel}</Text>
      ) : (
        invites.map((invite) => {
          const accepted = invite.status === 'accepted';
          return (
            <View key={invite.id} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: theme.surfaceSecondary }]}>
                <AppIcon
                  name={accepted ? 'checkmark.circle.fill' : 'envelope.fill'}
                  color={accepted ? theme.success : theme.warning}
                />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.email, { color: theme.text }]} numberOfLines={1}>
                  {invite.email}
                </Text>
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {roleLabels[invite.role]}
                </Text>
              </View>
              {!accepted && onCancelPending ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Cancelar invitación a ${invite.email}`}
                  onPress={() => onCancelPending(invite)}
                  hitSlop={8}
                  style={styles.cancelBtn}>
                  <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 13 }}>
                    {copy.common.cancel}
                  </Text>
                </Pressable>
              ) : (
                <Pill tone={accepted ? 'green' : 'orange'}>
                  {accepted ? copy.sharing.accepted : copy.sharing.pending}
                </Pill>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 4 },
  title: { fontSize: 14, fontWeight: '700' },
  empty: { fontSize: 13, lineHeight: 18 },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  email: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 11 },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 6 },
});
