import { StyleSheet, Text, View } from 'react-native';

import { AppIcon, Pill, useAppTheme } from '@/components/ui';
import type { CollaborationResourceInvite } from '@/services/collaboration-api';

const roleLabels: Record<CollaborationResourceInvite['role'], string> = {
  member: 'Miembro',
  editor: 'Puede editar',
  viewer: 'Solo ver',
};

export function CollaborationInvitesList({
  invites,
  emptyLabel = 'Aún no hay invitaciones en este recurso.',
}: {
  invites: CollaborationResourceInvite[];
  emptyLabel?: string;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text }]}>Invitaciones</Text>
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
              <Pill tone={accepted ? 'green' : 'orange'}>
                {accepted ? 'Aceptado' : 'Pendiente'}
              </Pill>
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
});
