import React, { useState, useEffect, useRef } from 'react';
import { Text } from 'ink';

// 史诗金 (Epic Gold) 色彩库：包含明暗交替的黄金、暗金、亮白高光等，实现史诗级流光溢彩
const EPIC_GOLD_COLORS = [
  '#FFDF00', // 金黄
  '#D4AF37', // 金属金
  '#CFB53B', // 老金
  '#C5B358', // 维加斯金
  '#E6C200', // 亮金
  '#DAA520', // 秋麒麟色
  '#B8860B', // 暗金
  '#F4A460', // 沙褐色
  '#FFD700', // 纯金
  '#FFF8DC', // 极亮高光 (玉米丝)
  '#FDF5E6', // 高光 (老花边)
  '#EEE8AA', // 淡金
  '#F0E68C', // 柔和金
];

const getRandomColor = () => EPIC_GOLD_COLORS[Math.floor(Math.random() * EPIC_GOLD_COLORS.length)];

interface Props {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export function RainbowText({ text, bold, italic }: Props) {
  // 快速切换 profile 时组件存活 < 150ms，保持纯色避免创建 N 个 Text 节点
  const [activated, setActivated] = useState(false);

  const [animColors, setAnimColors] = useState<string[]>(() =>
    Array.from({ length: text.length }, () => getRandomColor())
  );

  useEffect(() => {
    if (animColors.length !== text.length) {
      setAnimColors(Array.from({ length: text.length }, () => getRandomColor()));
    }
  }, [text]);

  // 150ms 延迟激活：快速滑过时不启动逐字渲染
  useEffect(() => {
    const timer = setTimeout(() => setActivated(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // 动画定时器：激活后才启动
  useEffect(() => {
    if (!activated) return;
    const timer = setInterval(() => {
      setAnimColors((prev) => {
        if (prev.length === 0) return prev;
        // 随机颜色从左往右滚动（最左端生成新颜色，右端颜色被挤出）
        return [getRandomColor(), ...prev.slice(0, prev.length - 1)];
      });
    }, 100);
    return () => clearInterval(timer);
  }, [activated]);

  // 未激活时用纯色，一个 Text 节点
  if (!activated) {
    return <Text bold={bold} italic={italic} color="#FFD700">{text}</Text>;
  }

  return (
    <Text bold={bold} italic={italic}>
      {text.split('').map((char, i) => (
        <Text key={`${i}-${char}`} color={animColors[i] || '#ffffff'}>
          {char}
        </Text>
      ))}
    </Text>
  );
}
