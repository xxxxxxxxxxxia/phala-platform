import { useEffect, useState, useRef, useMemo, useCallback } from 'react';

interface KeywordData {
  icon: string;
  color: string;
  weight?: string;
}

const kw: Record<string, KeywordData> = {
  success: { icon: '✅', color: '#4ade80', weight: 'bold' },
  hash: { icon: '🔑', color: '#60a5fa' },
  mnonce: { icon: '#️⃣', color: '#a78bfa' },
  data: { icon: '📄', color: '#fb923c' },
  done: { icon: '✅', color: '#4ade80', weight: 'bold' },
  verify: { icon: '🔍', color: '#f59e0b', weight: 'bold' },
  signature: { icon: '✍️', color: '#8b5cf6', weight: 'bold' },
  cert: { icon: '📜', color: '#06b6d4', weight: 'bold' },
  valid: { icon: '✓', color: '#10b981', weight: 'bold' },
  load: { icon: '📥', color: '#3b82f6', weight: 'bold' },
  get: { icon: '📤', color: '#06b6d4', weight: 'bold' },
  curl: { icon: '🌐', color: '#6366f1' },
  userdata: { icon: '👤', color: '#f97316', weight: 'bold' },
  measure: { icon: '📏', color: '#ec4899', weight: 'bold' },
  sn: { icon: '🔢', color: '#84cc16', weight: 'bold' },
  nonce: { icon: '🎲', color: '#f59e0b', weight: 'bold' },
};

// 优化：限制最大行数，防止内存溢出
const MAX_LINES = 2000;
const VISIBLE_LINES = 20;
const LINE_HEIGHT = 24;
const MIN_LINE_HEIGHT = 24;


function highlightLine(line: string, idx: number, processLineCallback: (line: string, idx: number) => any) {
  const processed = processLineCallback(line, idx);
  
  if (processed.isEmpty) {
    return (
      <div key={idx} style={{ display: 'flex', alignItems: 'center', height: LINE_HEIGHT }}>
        <span style={{ userSelect: 'none', marginRight: 8, color: '#9ca3af', minWidth: 36 }}>
          {String(idx + 1).padStart(2, '0')}
        </span>
        <br />
      </div>
    );
  }
  
  return (
    <div key={idx} style={{ 
      display: 'flex', 
      alignItems: 'flex-start', 
      color: '#ffffff',
      minHeight: MIN_LINE_HEIGHT,
      padding: '2px 0'
    }}>
      <span style={{ userSelect: 'none', marginRight: 8, color: '#9ca3af', minWidth: 36, flexShrink: 0, lineHeight: '1.4' }}>
        {String(idx + 1).padStart(2, '0')}
      </span>
      <span style={{ marginRight: 6, flexShrink: 0, lineHeight: '1.4' }}>{processed.icon}</span>
      <span style={{ 
        ...processed.style,
        flex: 1,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: '1.4'
      }}>
        {processed.content}
      </span>
    </div>
  );
}

export default function LineByLinePre({ text, delay = 30 }: { text: string; delay?: number }) {
    const [visible, setVisible] = useState<string[]>([]);
    const [scrollTop, setScrollTop] = useState(0);
    const scrollBox = useRef<HTMLDivElement>(null);

    // 优化：使用useCallback缓存处理函数
    const processLineCallback = useCallback((line: string, idx: number) => {
        // 空或只有空白也算空行
        if (!line || line.trim() === '') {
            return {
                key: idx,
                content: '',
                isEmpty: true,
                style: {}
            };
        }
        
        // 简化关键词检测，减少复杂度
        const lowerLine = line.toLowerCase();
        let key = '';
        let icon = '';
        let color = '#ffffff';
        let weight = 'normal';

        // 优化：减少关键词检测复杂度
        if (lowerLine.includes('success')) {
            key = 'success';
        } else if (lowerLine.includes('verify')) {
            key = 'verify';
        } else if (lowerLine.includes('signature')) {
            key = 'signature';
        } else if (lowerLine.includes('cert')) {
            key = 'cert';
        } else if (lowerLine.includes('valid')) {
            key = 'valid';
        } else if (lowerLine.includes('hash') || lowerLine.includes('r=') || lowerLine.includes('s=')) {
            key = 'hash';
        }

        if (key && kw[key]) {
            const kwData = kw[key];
            icon = kwData.icon;
            color = kwData.color;
            weight = kwData.weight || 'normal';
        }

        // 移除行长度限制，允许完整显示
        const displayLine = line;

        return {
            key: idx,
            content: displayLine,
            isEmpty: false,
            style: { color, fontWeight: weight },
            icon
        };
    }, []);

    // 优化：使用useMemo缓存处理后的行数据，限制最大行数
    const processedLines = useMemo(() => {
        if (!text) return [];
        // 确保文本正确解码，处理可能的编码问题
        const cleanText = text.replace(/\uFFFD/g, ''); // 移除替换字符
        const lines = cleanText.split('\n');
        // 限制最大行数，防止内存溢出
        return lines.slice(0, MAX_LINES);
    }, [text]);

    // 优化：逐行渲染，保持动画效果
    const visibleLines = useMemo(() => {
        return visible.map((line, idx) => {
            return processLineCallback(line, idx);
        });
    }, [visible, processLineCallback]);

    // 优化：使用requestAnimationFrame优化动画
    useEffect(() => {
        if (!processedLines.length) return;

        // 重置可见行，开始新的动画
        setVisible([]);
        let currentIndex = 0;
        let timeoutId: NodeJS.Timeout;

        const animate = () => {
            if (currentIndex < processedLines.length) {
                setVisible(prev => [...prev, processedLines[currentIndex]]);
                currentIndex++;
                // 使用setTimeout控制延迟
                timeoutId = setTimeout(() => {
                    animate();
                }, delay);
            }
        };

        // 立即开始动画
        animate();

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [processedLines]);

    // 优化：使用防抖处理滚动
    const handleScroll = useCallback(() => {
        if (scrollBox.current) {
            setScrollTop(scrollBox.current.scrollTop);
        }
    }, []);

    // 优化：自动滚动到底部（只在添加新行时）
    useEffect(() => {
        if (scrollBox.current && visible.length > 0) {
            const isNearBottom = scrollBox.current.scrollTop + scrollBox.current.clientHeight >= 
                                scrollBox.current.scrollHeight - 100;
            if (isNearBottom) {
                scrollBox.current.scrollTop = scrollBox.current.scrollHeight;
            }
        }
    }, [visible.length]);

    return (
        <div
            style={{
                height: 400,
                overflow: 'hidden',
                background: 'rgba(15, 16, 34, 0.8)',
                border: '1px solid rgba(159, 44, 255, 0.3)',
                borderRadius: 8,
                position: 'relative'
            }}
        >
            <div
                ref={scrollBox}
                style={{
                    height: '100%',
                    overflow: 'auto',
                    padding: '14px 18px',
                    fontSize: 14,
                    lineHeight: `${LINE_HEIGHT}px`,
                    fontFamily: `'Consolas','Monaco','Courier New',monospace`,
                    color: '#ffffff',
                    backdropFilter: 'blur(8px)',
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap',
                }}
                onScroll={handleScroll}
            >
                {/* 简化渲染：直接渲染所有可见行 */}
                <div>
                    {visibleLines.map((line, idx) => (
                        <div 
                            key={line.key} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start',
                                minHeight: MIN_LINE_HEIGHT,
                                padding: '2px 0'
                            }}
                        >
                            {!line.isEmpty && (
                                <>
                                    <span style={{ 
                                        userSelect: 'none', 
                                        marginRight: 8, 
                                        color: '#9ca3af', 
                                        minWidth: 36, 
                                        flexShrink: 0,
                                        lineHeight: '1.4'
                                    }}>
                                        {String(line.key + 1).padStart(2, '0')}
                                    </span>
                                    <span style={{ marginRight: 6, flexShrink: 0, lineHeight: '1.4' }}>{line.icon}</span>
                                    <span style={{ 
                                        ...line.style,
                                        flex: 1,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        lineHeight: '1.4'
                                    }}>
                                        {line.content}
                                    </span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}