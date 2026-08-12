import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import { displayLedgerName, useAppCopy } from '@/i18n/app-copy';
import { isSelfOwner } from '@/lib/collaboration-roles';
import { createAccessRequest } from '@/services/collaboration-api';
import { useLanguageStore } from '@/store/language';
import { useLedgerStore } from '@/store/ledger';
import {
  usePlusStore,
  hasPaidPlan,
  isPlusRequiredError,
  plusReasonFromError,
  paywallPlanFromError,
} from '@/store/plus';

type Props = {
  compact?: boolean;
};

export function LedgerSwitcher({ compact = false }: Props) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const insets = useSafeAreaInsets();
  const ledgers = useLedgerStore((state) => state.ledgers);
  const activeLedgerId = useLedgerStore((state) => state.activeLedgerId);
  const setActiveLedger = useLedgerStore((state) => state.setActiveLedger);
  const createLedger = useLedgerStore((state) => state.createLedger);
  const hydrateLedgers = useLedgerStore((state) => state.hydrate);
  const plusAccess = usePlusStore((state) => state.access);
  const openPaywall = usePlusStore((state) => state.openPaywall);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joiningBusy, setJoiningBusy] = useState(false);
  const active = ledgers.find((item) => item.id === activeLedgerId) ?? ledgers[0];
  const activeName = active ? displayLedgerName(active.name, locale) : copy.ledger.fallback;

  const close = () => {
    setOpen(false);
    setCreating(false);
    setJoining(false);
    setNewName('');
    setJoinCode('');
    setJoiningBusy(false);
  };

  const onCreate = async () => {
    if (!newName.trim()) return;
    if (!hasPaidPlan(plusAccess) && ledgers.length >= 1) {
      close();
      openPaywall('BOOK_LIMIT');
      return;
    }
    await createLedger(newName.trim());
    close();
  };

  const onRequestJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 6) {
      Alert.alert('ID inválido', 'Revisa el código del libro e inténtalo de nuevo.');
      return;
    }
    setJoiningBusy(true);
    try {
      const result = await createAccessRequest(code);
      close();
      Alert.alert(
        'Solicitud enviada',
        `Pediste unirte a "${result.workspaceName}". El dueño verá tu solicitud para aceptarla.`,
      );
    } catch (error) {
      if (isPlusRequiredError(error)) {
        close();
        openPaywall(plusReasonFromError(error), {
          plan: paywallPlanFromError(error),
        });
        return;
      }
      Alert.alert(
        'No se pudo solicitar',
        error instanceof Error ? error.message : 'Revisa el ID e inténtalo de nuevo.',
      );
    } finally {
      setJoiningBusy(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.ledger.activeA11y(activeName)}
        accessibilityHint={copy.ledger.openHint}
        onPress={() => {
          setOpen(true);
          void hydrateLedgers();
        }}
        style={({ pressed }) => [
          styles.trigger,
          compact && styles.triggerCompactPad,
          {
            backgroundColor: pressed ? theme.surfaceSecondary : `${theme.surfaceSecondary}99`,
          },
        ]}>
        <Text
          numberOfLines={1}
          style={[
            compact ? styles.triggerCompact : styles.triggerTitle,
            { color: theme.text },
          ]}>
          {activeName}
        </Text>
        <AppIcon name="chevron.down" color={theme.muted} size={compact ? 12 : 13} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          style={[styles.backdrop, { paddingTop: Math.max(insets.top, 12) + 52 }]}
          onPress={close}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: theme.muted }]}>{copy.ledger.sheetTitle}</Text>

            {ledgers.map((ledger) => {
              const selected = ledger.id === activeLedgerId;
              const name = displayLedgerName(ledger.name, locale);
              const count = ledger.members.length;
              return (
                <View
                  key={ledger.id}
                  style={[
                    styles.row,
                    selected && { backgroundColor: theme.primarySoft },
                  ]}>
                  {selected ? <View style={[styles.activeBar, { backgroundColor: theme.success }]} /> : <View style={styles.activeBarSpacer} />}
                  <ScalePressable
                    style={styles.rowMain}
                    onPress={async () => {
                      await setActiveLedger(ledger.id);
                      close();
                    }}>
                    <View style={[styles.icon, { backgroundColor: `${ledger.color}22` }]}>
                      <AppIcon name={ledger.icon} color={ledger.color} size={18} />
                    </View>
                    <View style={styles.copy}>
                      <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
                      <Text style={[styles.meta, { color: theme.muted }]}>
                        {count > 1
                          ? copy.calendar.sharedMeta(count)
                          : copy.common.personal}
                      </Text>
                    </View>
                  </ScalePressable>
                  <ScalePressable
                    accessibilityLabel={copy.ledger.shareA11y(name)}
                    onPress={() => {
                      close();
                      if (!isSelfOwner(ledger.members)) {
                        Alert.alert(
                          'Solo el organizador',
                          'En un libro compartido solo el organizador puede invitar a más personas.',
                        );
                        return;
                      }
                      if (!hasPaidPlan(plusAccess)) {
                        openPaywall('SHARING_REQUIRED');
                        return;
                      }
                      router.push({ pathname: '/(tabs)/ledgers', params: { focus: ledger.id, tab: 'share' } });
                    }}
                    style={styles.iconBtn}>
                    <AppIcon name="person.2.fill" color={theme.muted} size={18} />
                  </ScalePressable>
                  <ScalePressable
                    accessibilityLabel={`${copy.tabs.mas} ${name}`}
                    onPress={() => {
                      close();
                      router.push({ pathname: '/(tabs)/ledgers', params: { focus: ledger.id } });
                    }}
                    style={styles.iconBtn}>
                    <AppIcon name="gearshape.fill" color={theme.muted} size={18} />
                  </ScalePressable>
                </View>
              );
            })}

            {creating ? (
              <View style={styles.createBox}>
                <TextInput
                  autoFocus
                  value={newName}
                  onChangeText={setNewName}
                  placeholder={copy.ledger.namePlaceholder}
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
                  onSubmitEditing={() => void onCreate()}
                />
                <View style={styles.createActions}>
                  <Pressable onPress={() => setCreating(false)}>
                    <Text style={{ color: theme.muted, fontWeight: '600' }}>{copy.common.cancel}</Text>
                  </Pressable>
                  <Pressable onPress={() => void onCreate()}>
                    <Text style={{ color: theme.primary, fontWeight: '700' }}>{copy.common.create}</Text>
                  </Pressable>
                </View>
              </View>
            ) : joining ? (
              <View style={styles.createBox}>
                <Text style={[styles.joinHint, { color: theme.muted }]}>
                  Escribe el ID del libro (ej. TW8F3K2M1Q) para solicitar ingreso.
                </Text>
                <TextInput
                  autoFocus
                  autoCapitalize="characters"
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="TWXXXXXXXX"
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
                  onSubmitEditing={() => void onRequestJoin()}
                />
                <View style={styles.createActions}>
                  <Pressable onPress={() => setJoining(false)} disabled={joiningBusy}>
                    <Text style={{ color: theme.muted, fontWeight: '600' }}>{copy.common.cancel}</Text>
                  </Pressable>
                  <Pressable onPress={() => void onRequestJoin()} disabled={joiningBusy}>
                    <Text style={{ color: theme.primary, fontWeight: '700' }}>
                      {joiningBusy ? 'Enviando…' : 'Solicitar ingreso'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <ScalePressable
                  onPress={() => {
                    if (!hasPaidPlan(plusAccess) && ledgers.length >= 1) {
                      close();
                      openPaywall('BOOK_LIMIT');
                      return;
                    }
                    setCreating(true);
                  }}
                  style={[styles.addRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.addText, { color: theme.primary }]}>{copy.ledger.addBook}</Text>
                  <AppIcon name="plus" color={theme.primary} size={20} />
                </ScalePressable>
                <ScalePressable
                  onPress={() => setJoining(true)}
                  style={[styles.addRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.addText, { color: theme.text }]}>Unirse con ID</Text>
                  <AppIcon name="person.badge.plus" color={theme.success} size={20} />
                </ScalePressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 240,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  triggerCompactPad: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  triggerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  triggerCompact: { fontSize: 15, fontWeight: '700' },
  backdrop: {
    flex: 1,
    backgroundColor: '#0B1D3A55',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
  },
  sheet: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#0B1D3A',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingRight: 8 },
  activeBar: { width: 4, alignSelf: 'stretch', borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  activeBarSpacer: { width: 4 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 10 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 11 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addText: { fontSize: 15, fontWeight: '700' },
  createBox: { padding: 14, gap: 10 },
  joinHint: { fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
});
