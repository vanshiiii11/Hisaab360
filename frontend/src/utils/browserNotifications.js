/**
 * Browser Notification Helper using standard HTML5 Notification API
 * No Firebase or third-party service required.
 */

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Browser does not support desktop notifications');
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return 'denied';
    }
  }

  return Notification.permission;
}

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function showDesktopNotification(title, options = {}) {
  if (!isNotificationSupported()) return null;

  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        icon: '/vite.svg',
        badge: '/vite.svg',
        silent: false,
        ...options
      });

      // Optional click handler
      if (options.onClick) {
        notif.onclick = () => {
          window.focus();
          options.onClick();
        };
      }

      return notif;
    } catch (err) {
      console.error('Error creating Notification instance:', err);
    }
  }
  return null;
}
