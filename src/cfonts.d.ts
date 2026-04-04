declare module 'cfonts' {
  export interface CFontsOptions {
    font?: string;
    align?: 'left' | 'center' | 'right';
    colors?: string[];
    background?: string;
    letterSpacing?: number;
    lineHeight?: number;
    space?: boolean;
    maxLength?: string | number;
    gradient?: string[];
    independentGradient?: boolean;
    transitionGradient?: boolean;
    env?: 'node' | 'browser';
  }

  export function render(text: string, options?: CFontsOptions): { string: string; array: string[]; lines: number; options: CFontsOptions };
  export function say(text: string, options?: CFontsOptions): void;
}
