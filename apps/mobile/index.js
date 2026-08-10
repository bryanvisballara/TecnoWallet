// Must be first so Fast Refresh / HMR works on Expo web (Metro).
import '@expo/metro-runtime';
import { LogBox } from 'react-native';

// Hide the floating "Open debugger to view warnings" banner in dev.
LogBox.ignoreAllLogs(true);

import 'expo-router/entry';
