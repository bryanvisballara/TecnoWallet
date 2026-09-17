import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TutorialVideoPlayer } from '@/components/tutorial-video-player';
import { AppIcon, BackIconButton, Card, Screen, useAppTheme } from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';
import {
  TUTORIAL_MODULES,
  type TutorialLocale,
  type TutorialModule,
} from '@/lib/tutorial-modules';
import { resolveTutorialVideoUrl } from '@/lib/tutorial-video';
import { useAppTutorialStore } from '@/store/app-tutorial';

function ModuleRow({
  index,
  module,
  locale,
  expanded,
  onToggle,
}: {
  index: number;
  module: TutorialModule;
  locale: TutorialLocale;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const videoUrl = resolveTutorialVideoUrl(locale, module.videoKey);

  return (
    <View
      style={[
        styles.module,
        {
          borderColor: theme.border,
          backgroundColor: expanded ? theme.primarySoft : theme.surface,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.moduleHeader}>
        <View style={[styles.indexBadge, { backgroundColor: theme.surfaceSecondary }]}>
          <Text style={[styles.indexText, { color: theme.text }]}>{index + 1}</Text>
        </View>
        <Text style={[styles.moduleTitle, { color: theme.text }]}>
          {module.title[locale]}
        </Text>
        <AppIcon
          name={expanded ? 'chevron.up' : 'chevron.down'}
          color={theme.muted}
          size={16}
        />
      </Pressable>
      {expanded ? (
        <View style={styles.moduleBody}>
          <TutorialVideoPlayer
            url={videoUrl}
            title={module.title[locale]}
            missingLabel={copy.tutorial.videoMissing}
          />
        </View>
      ) : null}
    </View>
  );
}

function LanguageCard({
  locale,
  expanded,
  expandedModuleId,
  onToggleLocale,
  onToggleModule,
}: {
  locale: TutorialLocale;
  expanded: boolean;
  expandedModuleId: string | null;
  onToggleLocale: () => void;
  onToggleModule: (moduleId: string) => void;
}) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const label = locale === 'es' ? copy.tutorial.sectionSpanish : copy.tutorial.sectionEnglish;

  return (
    <Card style={styles.languageCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggleLocale}
        style={[
          styles.languageHeader,
          expanded && { backgroundColor: theme.primarySoft, borderRadius: 14 },
        ]}>
        <View style={[styles.languageIcon, { backgroundColor: `${theme.primary}1A` }]}>
          <AppIcon
            name={locale === 'es' ? 'book.fill' : 'globe'}
            color={theme.primary}
            size={20}
          />
        </View>
        <View style={styles.languageCopy}>
          <Text style={[styles.languageTitle, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.languageSubtitle, { color: theme.muted }]}>
            {copy.tutorial.moduleCount}
          </Text>
        </View>
        <AppIcon
          name={expanded ? 'chevron.up' : 'chevron.down'}
          color={theme.muted}
          size={18}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.moduleList}>
          {TUTORIAL_MODULES.map((module, index) => (
            <ModuleRow
              key={module.id}
              index={index}
              module={module}
              locale={locale}
              expanded={expandedModuleId === module.id}
              onToggle={() => onToggleModule(module.id)}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export default function VideoTutorialScreen() {
  const copy = useAppCopy();
  const [expandedLocale, setExpandedLocale] = useState<TutorialLocale | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      useAppTutorialStore.setState({ visible: false });
    }, []),
  );

  const toggleLocale = (locale: TutorialLocale) => {
    setExpandedLocale((current) => {
      if (current === locale) {
        setExpandedModuleId(null);
        return null;
      }
      setExpandedModuleId(null);
      return locale;
    });
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModuleId((current) => (current === moduleId ? null : moduleId));
  };

  return (
    <Screen
      title={copy.tutorial.guideTitle}
      subtitle={copy.tutorial.guideSubtitle}
      right={<BackIconButton fallback="/(tabs)/mas" />}>
      <IntroText text={copy.tutorial.guideIntro} />
      <LanguageCard
        locale="es"
        expanded={expandedLocale === 'es'}
        expandedModuleId={expandedLocale === 'es' ? expandedModuleId : null}
        onToggleLocale={() => toggleLocale('es')}
        onToggleModule={toggleModule}
      />
      <LanguageCard
        locale="en"
        expanded={expandedLocale === 'en'}
        expandedModuleId={expandedLocale === 'en' ? expandedModuleId : null}
        onToggleLocale={() => toggleLocale('en')}
        onToggleModule={toggleModule}
      />
    </Screen>
  );
}

function IntroText({ text }: { text: string }) {
  const theme = useAppTheme();
  return <Text style={[styles.intro, { color: theme.muted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  intro: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  languageCard: {
    gap: 12,
    padding: 0,
    overflow: 'hidden',
  },
  languageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  languageIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageCopy: {
    flex: 1,
    gap: 2,
  },
  languageTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  languageSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  moduleList: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  module: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: 'hidden',
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 13,
    fontWeight: '800',
  },
  moduleTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  moduleBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
