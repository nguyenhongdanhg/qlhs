import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// VAPID public key - for web push
// This is a demo key - in production, generate your own at https://web-push-codelab.glitch.me/
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user, currentSchool } = useAuth();
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check existing subscription
  useEffect(() => {
    async function checkSubscription() {
      if (!isSupported || !user) {
        setIsLoading(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setIsLoading(false);
      }
    }

    checkSubscription();
  }, [isSupported, user]);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
      }
    }
    throw new Error('Service Worker not supported');
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user || !currentSchool) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng đăng nhập để bật thông báo',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission !== 'granted') {
        toast({
          title: 'Không được phép',
          description: 'Bạn cần cho phép thông báo trong trình duyệt',
          variant: 'destructive',
        });
        setIsLoading(false);
        return false;
      }

      // Register service worker
      const registration = await registerServiceWorker();

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save subscription to database
      const subscriptionJSON = subscription.toJSON();
      
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          school_id: currentSchool.id,
          endpoint: subscriptionJSON.endpoint,
          p256dh: subscriptionJSON.keys?.p256dh,
          auth: subscriptionJSON.keys?.auth,
          is_active: true,
        }, {
          onConflict: 'user_id,school_id',
        });

      if (error) throw error;

      setIsSubscribed(true);
      toast({
        title: 'Thành công',
        description: 'Đã bật thông báo nhắc nhở báo cơm',
      });
      return true;
    } catch (error: any) {
      console.error('Error subscribing to push:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể bật thông báo',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, currentSchool, registerServiceWorker, toast]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user || !currentSchool) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      // Update database
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('school_id', currentSchool.id);

      if (error) throw error;

      setIsSubscribed(false);
      toast({
        title: 'Thành công',
        description: 'Đã tắt thông báo nhắc nhở',
      });
      return true;
    } catch (error: any) {
      console.error('Error unsubscribing:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tắt thông báo',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, currentSchool, toast]);

  // Toggle subscription
  const toggle = useCallback(async () => {
    if (isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [isSubscribed, subscribe, unsubscribe]);

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    if (!isSubscribed) {
      toast({
        title: 'Lỗi',
        description: 'Bạn cần bật thông báo trước',
        variant: 'destructive',
      });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Thử nghiệm thông báo', {
        body: 'Thông báo hoạt động tốt! 🎉',
        icon: '/favicon.ico',
        tag: 'test-notification',
      });
      
      toast({
        title: 'Đã gửi',
        description: 'Kiểm tra thông báo trên thiết bị',
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }, [isSubscribed, toast]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    toggle,
    sendTestNotification,
  };
}
