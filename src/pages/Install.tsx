import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Smartphone, Monitor, Share, MoreVertical, PlusSquare } from 'lucide-react';

export default function Install() {
  return (
    <div className="content-wrapper animate-fade-in">
      <div className="page-header text-center">
        <h1 className="page-title flex items-center justify-center gap-2">
          <Download className="h-7 w-7 text-primary" />
          Cài đặt ứng dụng
        </h1>
        <p className="page-description">
          Cài đặt EduBoard trên thiết bị của bạn để truy cập nhanh hơn
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <Tabs defaultValue="ios" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ios" className="gap-2">
              <Smartphone className="h-4 w-4" />
              iPhone
            </TabsTrigger>
            <TabsTrigger value="android" className="gap-2">
              <Smartphone className="h-4 w-4" />
              Android
            </TabsTrigger>
            <TabsTrigger value="desktop" className="gap-2">
              <Monitor className="h-4 w-4" />
              Máy tính
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ios" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cài đặt trên iPhone / iPad</CardTitle>
                <CardDescription>Sử dụng Safari để cài đặt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="font-medium">Mở Safari</h3>
                    <p className="text-sm text-muted-foreground">
                      Truy cập trang <a href="https://noitrubantru.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline">noitrubantru.com</a> bằng trình duyệt Safari (không phải Chrome hay Firefox)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      Nhấn nút Chia sẻ
                      <Share className="h-5 w-5 text-info" />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Nhấn vào biểu tượng chia sẻ ở thanh điều hướng dưới cùng
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    3
                  </div>
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      Chọn "Thêm vào Màn hình chính"
                      <PlusSquare className="h-5 w-5 text-info" />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Cuộn xuống và chọn "Add to Home Screen" hoặc "Thêm vào Màn hình chính"
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    4
                  </div>
                  <div>
                    <h3 className="font-medium">Xác nhận</h3>
                    <p className="text-sm text-muted-foreground">
                      Nhấn "Thêm" ở góc trên bên phải để hoàn tất cài đặt
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="android" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cài đặt trên Android</CardTitle>
                <CardDescription>Sử dụng Chrome để cài đặt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="font-medium">Mở Chrome</h3>
                    <p className="text-sm text-muted-foreground">
                      Truy cập trang <a href="https://noitrubantru.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline">noitrubantru.com</a> bằng trình duyệt Chrome
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      Nhấn menu
                      <MoreVertical className="h-5 w-5 text-info" />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Nhấn vào biểu tượng 3 chấm ở góc trên bên phải
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    3
                  </div>
                  <div>
                    <h3 className="font-medium">Chọn "Cài đặt ứng dụng"</h3>
                    <p className="text-sm text-muted-foreground">
                      Hoặc "Install app" / "Add to Home screen"
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    4
                  </div>
                  <div>
                    <h3 className="font-medium">Xác nhận</h3>
                    <p className="text-sm text-muted-foreground">
                      Nhấn "Cài đặt" để hoàn tất
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="desktop" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cài đặt trên máy tính</CardTitle>
                <CardDescription>Sử dụng Chrome hoặc Edge</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="font-medium">Mở Chrome hoặc Edge</h3>
                    <p className="text-sm text-muted-foreground">
                      Truy cập trang web này bằng Chrome hoặc Microsoft Edge
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="font-medium">Tìm biểu tượng cài đặt</h3>
                    <p className="text-sm text-muted-foreground">
                      Nhấn vào biểu tượng cài đặt ở thanh địa chỉ (thường ở bên phải)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    3
                  </div>
                  <div>
                    <h3 className="font-medium">Xác nhận cài đặt</h3>
                    <p className="text-sm text-muted-foreground">
                      Nhấn "Install" trong hộp thoại xuất hiện
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Lợi ích khi cài đặt</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                Truy cập nhanh hơn từ màn hình chính
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                Hoạt động offline (một số tính năng)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                Nhận thông báo đẩy (sắp có)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                Giao diện toàn màn hình như ứng dụng gốc
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
