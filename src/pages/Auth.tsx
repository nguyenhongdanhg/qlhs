import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Loader2, Eye, EyeOff, Phone, Lock, User, Sparkles, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { cn } from '@/lib/utils';


import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';

// Helper to convert phone to email format for Supabase auth
const phoneToEmail = (phone: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@phone.local`;
};



const signupSchema = z.object({
  phone: z.string().min(9, 'Số điện thoại phải có ít nhất 9 số').regex(/^[0-9\s\-+()]+$/, 'Số điện thoại không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
});

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, location.state, navigate]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanPhone = loginPhone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      toast({
        title: 'Lỗi',
        description: 'Số điện thoại phải có ít nhất 9 số',
        variant: 'destructive',
      });
      return;
    }

    if (loginPassword.length < 6) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu phải có ít nhất 6 ký tự',
        variant: 'destructive',
      });
      return;
    }


    setIsLoading(true);
    const email = phoneToEmail(loginPhone);
    const { error } = await signIn(email, loginPassword);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Đăng nhập thất bại',
        description: error.message === 'Invalid login credentials'
          ? 'Số điện thoại hoặc mật khẩu không đúng'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Đăng nhập thành công',
      description: 'Chào mừng bạn quay trở lại!',
    });

    // AuthContext will handle school selection (auto-select if 1, redirect to select-school if multiple)
    navigate('/', { replace: true });
  }, [loginPhone, loginPassword, signIn, navigate, toast]);

  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      signupSchema.parse({ phone: signupPhone, password: signupPassword, fullName: signupFullName });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Lỗi',
          description: error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    const email = phoneToEmail(signupPhone);
    const { error } = await signUp(email, signupPassword, signupFullName);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Đăng ký thất bại',
        description: error.message === 'User already registered'
          ? 'Số điện thoại này đã được đăng ký'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Đăng ký thành công',
      description: 'Tài khoản của bạn đã được tạo. Vui lòng liên hệ quản trị viên để được thêm vào trường.',
    });
  }, [signupPhone, signupPassword, signupFullName, signUp, toast]);

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-200/20 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center animate-fade-in">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent shadow-xl shadow-primary/25 mb-4">
              <GraduationCap className="h-12 w-12 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-warning shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            QUẢN LÝ NỘI TRÚ/BÁN TRÚ
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Ứng dụng quản lý nội trú/bán trú</p>
        </div>

        {/* Tab Switcher */}
        <div className="w-full max-w-sm mb-6">
          <div className="flex rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg shadow-black/5 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300',
                activeTab === 'login'
                  ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('signup')}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300',
                activeTab === 'signup'
                  ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Đăng ký
            </button>
          </div>
        </div>

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 animate-fade-in">
            {/* Phone Input First */}
            <div className="space-y-2">
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="tel"
                  placeholder="Số điện thoại"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 h-14 rounded-2xl bg-white/90 backdrop-blur-sm border-0 shadow-lg shadow-black/5 text-base focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>


            <div className="space-y-2">
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mật khẩu"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 pr-12 h-14 rounded-2xl bg-white/90 backdrop-blur-sm border-0 shadow-lg shadow-black/5 text-base focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all duration-300" 
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Đăng nhập
            </Button>

            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              Quên mật khẩu?
            </button>
          </form>
        )}

        <ForgotPasswordDialog 
          open={showForgotPassword} 
          onOpenChange={setShowForgotPassword} 
        />

        {/* Signup Form */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignup} className="w-full max-w-sm space-y-4 animate-fade-in">
            <div className="space-y-2">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder="Họ và tên"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 h-14 rounded-2xl bg-white/90 backdrop-blur-sm border-0 shadow-lg shadow-black/5 text-base focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="tel"
                  placeholder="Số điện thoại"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 h-14 rounded-2xl bg-white/90 backdrop-blur-sm border-0 shadow-lg shadow-black/5 text-base focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mật khẩu"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 pr-12 h-14 rounded-2xl bg-white/90 backdrop-blur-sm border-0 shadow-lg shadow-black/5 text-base focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all duration-300" 
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Đăng ký tài khoản
            </Button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 text-center relative z-10 space-y-3">
        <Link
          to="/docs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-4 py-2 rounded-full"
        >
          <BookOpen className="h-4 w-4" />
          Hướng dẫn sử dụng
        </Link>
        <div>
          <a 
            href="https://zalo.me/0888770699" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <span>Thiết kế bởi</span>
            <span className="font-bold text-primary">Thầy Nguyễn Hồng Dân</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Zalo: 0888 770 699</span>
          </a>
        </div>
      </div>
    </div>
  );
}