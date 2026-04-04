import React, { useMemo } from 'react';
import { Text } from 'ink';
import cfonts from 'cfonts';
import { colors } from '../theme.js';

export function HeaderLogo({ themeName }: { themeName?: string }) {
  // Use themeName as a key to force Ink to unmount and remount this component,
  // bypassing any text-equality caching mechanisms Ink might use for ANSI-heavy identical characters.
  const logoStr = useMemo(() => {
    return cfonts.render('Codex-Start', {
      font: 'tiny',              
      align: 'left',              
      colors: [colors.primary, colors.accent], // 使用纯粹的高亮主题主色和辅色，放弃渐变以获得巨大的切换反差
      background: 'transparent',  
      letterSpacing: 1,           
      lineHeight: 1,              
      space: false,               
      maxLength: '0',             
      env: 'node'                 
    }).string;
  }, [colors.primary, colors.accent, themeName]);

  return <Text key={themeName || 'default'}>{logoStr}</Text>;
}
