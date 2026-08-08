import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import { languages } from '@/i18n/languages';
import { useLanguageStore } from '@/store/language';

export function LanguagePicker({ label }: { label: string }) {
  const theme = useAppTheme();
  const locale = useLanguageStore((state) => state.locale);
  const setLocale = useLanguageStore((state) => state.setLocale);
  const [open, setOpen] = useState(false);
  const current = languages.find((language) => language.code === locale) ?? languages[0];

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => undefined, 0);
    return () => clearTimeout(timeout);
  }, [open]);

  return (
    <>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppIcon name="globe" color={theme.primary} size={18} />
        <Text style={[styles.code, { color: theme.text }]}>{current.code.toUpperCase()}</Text>
      </ScalePressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.title, { color: theme.text }]}>{label}</Text>
            {languages.map((language) => {
              const selected = language.code === locale;
              return (
                <ScalePressable
                  key={language.code}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={async () => {
                    await setLocale(language.code);
                    setOpen(false);
                  }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? theme.primarySoft : theme.surfaceSecondary,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}>
                  <Text style={styles.flag}>{language.flag}</Text>
                  <View style={styles.copy}>
                    <Text style={[styles.native, { color: theme.text }]}>{language.nativeLabel}</Text>
                    <Text style={[styles.meta, { color: theme.muted }]}>{language.label}</Text>
                  </View>
                  {selected ? <AppIcon name="checkmark" color={theme.primary} size={18} /> : null}
                </ScalePressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  code: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  option: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flag: { fontSize: 24 },
  copy: { flex: 1, gap: 2 },
  native: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12 },
});
