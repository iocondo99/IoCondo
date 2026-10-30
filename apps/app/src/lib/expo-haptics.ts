export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export async function impactAsync(
  style: ImpactFeedbackStyle = ImpactFeedbackStyle.Medium
): Promise<void> {
  try {
    const dynamicRequire = Function('m', 'return require(m)') as (m: string) => {
      impactAsync?: (s: ImpactFeedbackStyle) => Promise<void>;
    };
    const mod = dynamicRequire('expo-haptics');
    if (mod?.impactAsync) {
      await mod.impactAsync(style);
    }
  } catch {
    // Dispositivo senza motore aptico
  }
}

export async function notificationAsync(
  type: NotificationFeedbackType = NotificationFeedbackType.Success
): Promise<void> {
  try {
    const dynamicRequire = Function('m', 'return require(m)') as (m: string) => {
      notificationAsync?: (t: NotificationFeedbackType) => Promise<void>;
    };
    const mod = dynamicRequire('expo-haptics');
    if (mod?.notificationAsync) {
      await mod.notificationAsync(type);
    }
  } catch {
    // Dispositivo senza motore aptico
  }
}
