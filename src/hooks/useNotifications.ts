// Notificações locais e agendamento — desabilitado em Expo Go.
// Para notificações push remotas, é necessário um development build.
// Este módulo só registra permissões básicas (não push).

import { Platform } from 'react-native';
import { Task } from '../db';

export async function requestNotificationPermission(): Promise<boolean> {
  // Em Expo Go, notificações locais funcionam sem permissão extra.
  return true;
}

export async function scheduleTaskNotification(task: Task): Promise<void> {
  // Stub — implementar com expo-notifications em dev build
  if (task.task_type !== 'rec' || !task.time_from) return;
}

export async function cancelTaskNotification(taskId: string): Promise<void> {
  // Stub
}

export async function updateBadge(count: number): Promise<void> {
  // Badge só funciona em dev build no iOS
  if (Platform.OS === 'ios') {
    // TODO: Notifications.setBadgeCountAsync em dev build
  }
}
