import { performance_monitor } from '@/lib/performance';
import { env } from '@/lib/env';

/**
 * Image optimization utilities
 */
export class ImageOptimizer {
  private static readonly QUALITY_SETTINGS = {
    thumbnail: { width: 150, height: 150, quality: 70 },
    medium: { width: 600, height: 400, quality: 80 },
    large: { width: 1200, height: 800, quality: 85 },
  };

  /**
   * Create responsive image with lazy loading
   */
  static createResponsiveImage(src: string, alt: string, className?: string) {
    return {
      src,
      alt,
      loading: 'lazy' as const,
      decoding: 'async' as const,
      className: `transition-opacity duration-300 ${className || ''}`,
      onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => {
        e.currentTarget.style.opacity = '1';
      },
      onError: (e: React.SyntheticEvent<HTMLImageElement>) => {
        e.currentTarget.src = '/placeholder.svg';
        e.currentTarget.alt = 'Image failed to load';
      },
    };
  }

  /**
   * Preload critical images
   */
  static preloadImages(urls: string[]): void {
    if (env.VITE_APP_ENV === 'development') {
      console.log('🖼️ Preloading', urls.length, 'critical images');
    }
    
    urls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }

  /**
   * Optimize image based on device capabilities
   */
  static getOptimalImageProps(
    baseUrl: string, 
    alt: string, 
    size: keyof typeof ImageOptimizer.QUALITY_SETTINGS = 'medium'
  ) {
    const settings = this.QUALITY_SETTINGS[size];
    const isRetina = window.devicePixelRatio > 1;
    
    return {
      ...this.createResponsiveImage(baseUrl, alt),
      width: settings.width,
      height: settings.height,
      srcSet: isRetina ? `${baseUrl} 1x, ${baseUrl} 2x` : undefined,
    };
  }
}

/**
 * Code splitting utilities for dynamic imports
 */
export class CodeSplitter {
  private static readonly loadingComponents = new Set<string>();

  /**
   * Dynamically import component with loading state
   */
  static async loadComponent<T>(
    importFn: () => Promise<{ default: T }>,
    componentName: string
  ): Promise<T> {
    if (this.loadingComponents.has(componentName)) {
      // Prevent duplicate loading
      while (this.loadingComponents.has(componentName)) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    this.loadingComponents.add(componentName);
    
    try {
      const start = performance.now();
      const module = await importFn();
      const duration = performance.now() - start;
      
      if (env.VITE_APP_ENV === 'development') {
        console.log(`📦 Loaded ${componentName} in ${duration.toFixed(2)}ms`);
      }
      
      return module.default;
    } finally {
      this.loadingComponents.delete(componentName);
    }
  }

  /**
   * Preload components for better UX
   */
  static preloadComponent(importFn: () => Promise<any>, componentName: string): void {
    // Preload on idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.loadComponent(importFn, componentName).catch(console.warn);
      });
    } else {
      setTimeout(() => {
        this.loadComponent(importFn, componentName).catch(console.warn);
      }, 2000);
    }
  }
}

/**
 * Font loading optimization
 */
export class FontOptimizer {
  private static fontsLoaded = false;

  /**
   * Fonts are already loaded in index.html - skip duplicate loading
   */
  static preloadFonts(): void {
    if (this.fontsLoaded || typeof document === 'undefined') return;
    
    // Fonts are already preloaded in index.html, just mark as loaded
    this.fontsLoaded = true;
    
    if (env.VITE_APP_ENV === 'development') {
      console.log('✅ Fonts already loaded via index.html');
    }
  }

  /**
   * Add font display swap for better loading performance
   */
  static addFontDisplaySwap(): void {
    if (typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'Cinzel';
        font-display: swap;
      }
      @font-face {
        font-family: 'Inter';
        font-display: swap;
      }
      @font-face {
        font-family: 'Playfair Display';
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Resource prioritization for critical rendering path
 */
export class ResourcePrioritizer {
  /**
   * Resource hints already set in index.html - skip duplicates
   */
  static addResourceHints(): void {
    if (typeof document === 'undefined') return;
    
    // Resource hints already set in index.html, just add additional ones
    const prefetchDomains = [
      'https://api.openai.com',
    ];

    prefetchDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });
    
    if (env.VITE_APP_ENV === 'development') {
      console.log('✅ Resource hints configured');
    }
  }

  /**
   * Initialize all performance optimizations
   */
  static initializeOptimizations(): void {
    performance_monitor.start('performance_init');
    
    // Font optimization
    FontOptimizer.preloadFonts();
    FontOptimizer.addFontDisplaySwap();
    
    // Resource hints
    this.addResourceHints();
    
    // Critical images preload
    ImageOptimizer.preloadImages([
      '/placeholder.svg',
      // Add other critical images
    ]);

    performance_monitor.end('performance_init');
    
    if (env.VITE_APP_ENV === 'development') {
      console.log('🚀 Performance optimizations initialized');
    }
  }
}