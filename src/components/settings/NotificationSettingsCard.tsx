import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, BellRing, Loader2, Smartphone, AlertTriangle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function NotificationSettingsCard() {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    toggle,
    sendTestNotification,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Thông báo đẩy
          </CardTitle>
          <CardDescription>
            Nhận thông báo nhắc nhở trước deadline báo cơm
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Trình duyệt của bạn không hỗ trợ thông báo đẩy. Vui lòng sử dụng Chrome, Firefox, Edge hoặc Safari phiên bản mới.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Thông báo nhắc nhở
        </CardTitle>
        <CardDescription>
          Nhận thông báo nhắc nhở 30 phút trước deadline báo cơm
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Permission denied warning */}
        {permission === 'denied' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Bạn đã chặn thông báo trong trình duyệt. Vui lòng vào Cài đặt trình duyệt để cho phép thông báo từ trang này.
            </AlertDescription>
          </Alert>
        )}

        {/* Main toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${isSubscribed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {isSubscribed ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </div>
            <div>
              <Label htmlFor="push-toggle" className="text-base font-medium cursor-pointer">
                Bật thông báo đẩy
              </Label>
              <p className="text-sm text-muted-foreground">
                {isSubscribed 
                  ? 'Bạn sẽ nhận thông báo nhắc nhở trước deadline' 
                  : 'Bật để nhận nhắc nhở báo cơm'}
              </p>
            </div>
          </div>
          <Switch
            id="push-toggle"
            checked={isSubscribed}
            onCheckedChange={toggle}
            disabled={isLoading || permission === 'denied'}
          />
        </div>

        {/* Info about notifications */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Smartphone className="h-4 w-4" />
            Thông báo sẽ nhắc nhở bạn:
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
            <li>30 phút trước deadline Bữa sáng</li>
            <li>30 phút trước deadline Bữa trưa</li>
            <li>30 phút trước deadline Bữa tối</li>
          </ul>
        </div>

        {/* Test notification button */}
        {isSubscribed && (
          <Button 
            variant="outline" 
            onClick={sendTestNotification}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bell className="mr-2 h-4 w-4" />
            )}
            Gửi thông báo thử
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
