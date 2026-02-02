import { memo } from 'react';
import { MessageCircle } from 'lucide-react';

export const Footer = memo(function Footer() {
  return (
    <footer className="py-3 px-4 text-center border-t border-border/30 bg-muted/30">
      <a
        href="https://zalo.me/0888770699"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <MessageCircle className="h-3 w-3" />
        <span>Thiết kế bởi thầy giáo Nguyễn Hồng Dân - Zalo: 0888770699</span>
      </a>
    </footer>
  );
});
