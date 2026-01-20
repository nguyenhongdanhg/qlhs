import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Loader2, Eye, EyeOff, Phone, Lock, User, Building2, ChevronDown } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface School {
  id: string;
  name: string;
  code: string;
}

// Helper to convert phone to email format for Supabase auth
const phoneToEmail = (phone: string) => {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@phone.local`;
};

const loginSchema = z.object({
  phone: z.string().min(9, 'Số điện thoại phải có ít nhất 9 số').regex(/^[0-9\s\-+()]+$/, 'Số điện thoại không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  schoolId: z.string().min(1, 'Vui lòng chọn trường'),
});

const signupSchema = z.object({
  phone: z.string().min(9, 'Số điện thoại phải có ít nhất 9 số').regex(/^[0-9\s\-+()]+$/, 'Số điện thoại không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
});

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user, selectSchool } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Schools list
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  // Signup form state
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');

  // Fetch schools list
  useEffect(() => {
    const fetchSchools = async () => {
      setIsLoadingSchools(true);
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        setSchools(data);
        // Auto-select if only one school
        if (data.length === 1) {
          setSelectedSchoolId(data[0].id);
        }
      }
      setIsLoadingSchools(false);
    };
    
    fetchSchools();
  }, []);

  // Redirect if already logged in
  if (user) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      loginSchema.parse({ phone: loginPhone, password: loginPassword, schoolId: selectedSchoolId });
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
    // Convert phone to email format for Supabase auth
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

    // Set the selected school after login
    const selectedSchool = schools.find(s => s.id === selectedSchoolId);
    if (selectedSchool) {
      selectSchool(selectedSchool as any);
    }

    toast({
      title: 'Đăng nhập thành công',
      description: 'Chào mừng bạn quay trở lại!',
    });

    navigate('/dashboard', { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
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
    // Convert phone to email format for Supabase auth
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
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-lg mb-4">
            <GraduationCap className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Quản lý Nội trú</h1>
        </div>

        {/* Tab Switcher */}
        <div className="w-full max-w-sm mb-6">
          <div className="flex rounded-full bg-white shadow-sm p-1">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={cn(
                'flex-1 py-2.5 rounded-full text-sm font-medium transition-all',
                activeTab === 'login'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('signup')}
              className={cn(
                'flex-1 py-2.5 rounded-full text-sm font-medium transition-all',
                activeTab === 'signup'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Đăng ký
            </button>
          </div>
        </div>

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 animate-fade-in">
            {/* School Selection */}
            <div className="space-y-2">
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                <Select
                  value={selectedSchoolId}
                  onValueChange={setSelectedSchoolId}
                  disabled={isLoading || isLoadingSchools}
                >
                  <SelectTrigger className="pl-12 h-12 rounded-xl bg-white border-0 shadow-sm">
                    <SelectValue placeholder={isLoadingSchools ? "Đang tải..." : "Chọn trường"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="Số điện thoại"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 h-12 rounded-xl bg-white border-0 shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mật khẩu"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 pr-12 h-12 rounded-xl bg-white border-0 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base font-semibold shadow-lg" 
              disabled={isLoading || !selectedSchoolId}
            >
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Đăng nhập
            </Button>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
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
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Họ và tên"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 h-12 rounded-xl bg-white border-0 shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="Số điện thoại"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 h-12 rounded-xl bg-white border-0 shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mật khẩu"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-12 pr-12 h-12 rounded-xl bg-white border-0 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base font-semibold shadow-lg" 
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Đăng ký
            </Button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <a 
          href="https://zalo.me/0888770699" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          Thiết kế bởi <span className="font-semibold text-primary">Thầy giáo Nguyễn Hồng Dân</span> - Zalo: 0888 770 699
        </a>
      </div>
    </div>
  );
}
