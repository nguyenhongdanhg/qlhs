import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (icon: string) => void;
}

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Thường dùng': [
    '📋', '✅', '❌', '⚠️', '💡', '📌', '🔑', '🔒', '🔓', '👤', '👥', '🏫', '📚',
    '✏️', '📝', '📊', '📈', '📉', '🗓️', '⏰', '🔔', '📢', '💬', '📩', '📱', '💻',
    '🖥️', '⚙️', '🔧', '🛠️', '🎯', '🏆', '⭐', '🌟', '❤️', '👍', '👎', '🤝', '💪',
  ],
  'Giáo dục': [
    '📖', '📕', '📗', '📘', '📙', '🎓', '🏫', '🧑‍🏫', '👨‍🎓', '👩‍🎓', '📐', '📏',
    '🧮', '🔬', '🔭', '🎨', '🎵', '⚽', '🏀', '🏐', '🏸', '🏊', '🏃', '🧑‍💻',
  ],
  'Bữa ăn': [
    '🍚', '🍜', '🍲', '🥗', '🍖', '🐟', '🥩', '🍳', '🥚', '🧈', '🥛', '🍞',
    '🥕', '🥬', '🍅', '🧅', '🧄', '🌶️', '🍎', '🍌', '🍊', '☕', '🫖', '🥤',
  ],
  'Y tế': [
    '🏥', '💊', '🩺', '🩹', '🌡️', '🧪', '🩸', '💉', '🦷', '👁️', '🧠', '❤️‍🩹',
    '🚑', '🏨', '🧑‍⚕️', '👨‍⚕️', '👩‍⚕️', '♿', '🆘', '📞',
  ],
  'Mũi tên & Ký hiệu': [
    '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '🔄', '🔃',
    '▶️', '◀️', '🔼', '🔽', '⏩', '⏪', '⏫', '⏬',
    '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
    '🅰️', '🅱️', '🆎', '🆑', '🆒', '🆓', '🆔', '🆕', '🆖', '🆗', '🆘', '🆙', '🆚',
  ],
};

export function IconPickerDialog({ open, onOpenChange, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(Object.keys(EMOJI_CATEGORIES)[0]);

  const allEmojis = useMemo(() => Object.values(EMOJI_CATEGORIES).flat(), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    // Simple search: just show all emojis (emoji search by text isn't great, but it's a fallback)
    return allEmojis;
  }, [search, allEmojis]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onOpenChange(false);
  };

  const renderGrid = (emojis: string[]) => (
    <div className="grid grid-cols-10 gap-1">
      {emojis.map((emoji, i) => (
        <Button
          key={`${emoji}-${i}`}
          variant="ghost"
          className="h-10 w-10 text-xl p-0 hover:bg-primary/10"
          onClick={() => handleSelect(emoji)}
        >
          {emoji}
        </Button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chèn biểu tượng</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Tìm biểu tượng..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2"
        />
        {filtered ? (
          <ScrollArea className="h-64">
            {renderGrid(filtered)}
          </ScrollArea>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full flex-wrap h-auto gap-1">
              {Object.keys(EMOJI_CATEGORIES).map(cat => (
                <TabsTrigger key={cat} value={cat} className="text-xs px-2 py-1">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
            {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => (
              <TabsContent key={cat} value={cat}>
                <ScrollArea className="h-56">
                  {renderGrid(emojis)}
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
