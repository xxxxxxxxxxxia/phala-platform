import { useEffect, useState, useMemo, useCallback } from 'react';

// 优化：限制最大字符数，防止内存溢出
const MAX_CHARS = 100000;

export default function CharByCharPre({ text, delay = 30 }: { text: string; delay?: number }) {
  const [visible, setVisible] = useState('');

  // 优化：处理文本编码问题
  const limitedText = useMemo(() => {
    if (!text) return '';
    // 移除替换字符，处理编码问题
    const cleanText = text.replace(/\uFFFD/g, '');
    return cleanText.length > MAX_CHARS ? cleanText.slice(0, MAX_CHARS) + '...' : cleanText;
  }, [text]);

  // 优化：使用requestAnimationFrame替代setInterval
  useEffect(() => {
    if (!limitedText) return;
    
    let pos = 0;
    let animationId: number;

    const animate = () => {
      if (pos < limitedText.length) {
        setVisible(limitedText.slice(0, pos + 1));
        pos++;
        animationId = requestAnimationFrame(animate);
      }
    };

    // 使用requestAnimationFrame优化动画
    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [limitedText, delay]);

  return (
    <pre
      style={{
        margin: 0,
        padding: '16px 18px',
        background: '#f8fafc', // 更柔和的背景
        color: '#0f172a', // 深色文本，易读
        fontSize: 14,
        lineHeight: '1.4',
        fontFamily: `'Consolas','Monaco','Courier New',monospace`,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        border: '1px solid #e6edf3',
        borderRadius: 10,
        maxHeight: '56vh', // 响应式高度
        overflowY: 'auto',
        boxSizing: 'border-box',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        tabSize: 2,
      }}
    >
      {visible}
    </pre>
  );
}