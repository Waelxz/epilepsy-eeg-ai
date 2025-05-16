import { Injectable, Renderer2, RendererFactory2, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getDarkThemeStyles } from './dark-theme-styles';


export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  accessibility: {
    reduceAnimations: boolean;
    highContrast: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AppSettingsService {
  private renderer: Renderer2;
  private isBrowser: boolean;
  
  // Default settings
  private defaultSettings: AppSettings = {
    theme: 'light',
    fontSize: 14,
    accessibility: {
      reduceAnimations: false,
      highContrast: false
    }
  };
  
  // Flag to track if temporary settings are applied
  private hasTemporarySettings = false;
  
  constructor(
    rendererFactory: RendererFactory2,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Apply settings on service initialization only in browser
    if (this.isBrowser) {
      // Use setTimeout to ensure this runs after the DOM is ready
      setTimeout(() => {
      this.loadAndApplySettings();
        this.listenForSystemThemeChanges();
      }, 0);
    }
  }
  
  // Check if there are unsaved temporary settings
  hasUnsavedChanges(): boolean {
    return this.hasTemporarySettings;
  }

  // Revert to saved settings (discard temporary changes)
  revertToSavedSettings(): void {
    if (!this.isBrowser || !this.hasTemporarySettings) return;
    
    this.hasTemporarySettings = false;
    this.loadAndApplySettings();
  }
  
  // Listen for system color scheme preference changes
  private listenForSystemThemeChanges(): void {
    if (!this.isBrowser) return;
    
    const colorSchemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Add event listener for system theme changes
    colorSchemeMediaQuery.addEventListener('change', (e) => {
      const settings = this.getSettings();
      
      // Only respond to system theme changes if user preference is 'system'
      if (settings.theme === 'system') {
        this.applyTheme('system');
      }
    });
  }
  
  // Load settings from localStorage and apply them
  loadAndApplySettings(): void {
    if (!this.isBrowser) return;
    
    // Check for previously applied theme in sessionStorage for immediate application
    const previousTheme = sessionStorage.getItem('current_theme');
    if (previousTheme && (previousTheme === 'light' || previousTheme === 'dark')) {
      // Apply previous theme immediately while loading saved settings
      document.documentElement.classList.add(`theme-${previousTheme}`);
      document.body.classList.add(`${previousTheme}-theme`);
      
      // If dark theme, make sure high contrast is disabled
      if (previousTheme === 'dark') {
        document.documentElement.classList.remove('high-contrast');
      }
    }
    
    let settings = this.defaultSettings;
    const savedSettings = localStorage.getItem('app_settings');
    
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        
        // Ensure we have all required properties with defaults
        settings = {
          theme: parsedSettings.theme || this.defaultSettings.theme,
          fontSize: parsedSettings.fontSize || this.defaultSettings.fontSize,
          accessibility: {
            reduceAnimations: parsedSettings.accessibility?.reduceAnimations || this.defaultSettings.accessibility.reduceAnimations,
            highContrast: parsedSettings.accessibility?.highContrast || this.defaultSettings.accessibility.highContrast
          }
        };
      } catch (error) {
        console.error('Error parsing saved settings', error);
      }
    }
    
    // Apply all settings in proper order:
    // 1. First apply theme (which may disable high contrast if dark)
    this.applyTheme(settings.theme);
    // 2. Then apply font size
    this.applyFontSize(settings.fontSize);
    // 3. Finally apply accessibility settings (which checks theme state)
    this.applyAccessibilitySettings(settings.accessibility);
  }
  
  // Get current settings
  getSettings(): AppSettings {
    if (!this.isBrowser) return this.defaultSettings;
    
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (error) {
        console.error('Error parsing saved settings', error);
      }
    }
    return this.defaultSettings;
  }
  
  // Save settings
  saveSettings(settings: AppSettings): void {
    if (!this.isBrowser) return;
    
    localStorage.setItem('app_settings', JSON.stringify(settings));
    
    // Apply settings in proper order:
    // 1. First apply theme (which may disable high contrast if dark)
    this.applyTheme(settings.theme);
    // 2. Then apply font size
    this.applyFontSize(settings.fontSize);
    // 3. Finally apply accessibility settings (which checks theme state)
    this.applyAccessibilitySettings(settings.accessibility);

    // Reset temporary settings flag since we've saved
    this.hasTemporarySettings = false;
  }
  
  // Apply settings temporarily (for preview)
  applySettingsTemporarily(settings: AppSettings): void {
    // Apply settings without saving to localStorage, in proper order
    // 1. First apply theme (which may disable high contrast if dark)
    this.applyTheme(settings.theme);
    // 2. Then apply font size
    this.applyFontSize(settings.fontSize);
    // 3. Finally apply accessibility settings (which checks theme state)
    this.applyAccessibilitySettings(settings.accessibility);

    // Set flag to indicate we have unsaved temporary settings
    this.hasTemporarySettings = true;
  }
  
  // Apply theme
  private applyTheme(theme: 'light' | 'dark' | 'system'): void {
    if (!this.isBrowser) return;
    
    const html = document.documentElement;
    
    // Remove existing theme classes
    html.classList.remove('theme-light', 'theme-dark');
    
    // Determine theme to apply
    let themeToApply = theme;
    if (themeToApply === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeToApply = prefersDark ? 'dark' : 'light';
    }
    
    // Apply theme
    if (themeToApply === 'dark') {
      html.classList.add('theme-dark');
      this.renderer.addClass(document.body, 'dark-theme');
      this.renderer.removeClass(document.body, 'light-theme');
      this.ensureDarkThemeStyles();
      
      // Remove high contrast when dark theme is applied
      html.classList.remove('high-contrast');
    } else {
      html.classList.add('theme-light');
      this.renderer.addClass(document.body, 'light-theme');
      this.renderer.removeClass(document.body, 'dark-theme');
    }

    // Save the current theme to sessionStorage for persistence across page refreshes
    sessionStorage.setItem('current_theme', themeToApply);
    
    // Reapply accessibility settings to ensure high contrast is properly toggled
    const settings = this.getSettings();
    this.applyAccessibilitySettings(settings.accessibility);
  }
  
  // Ensure dark theme styles
  private ensureDarkThemeStyles(): void {
    if (!this.isBrowser) return;
    
    if (!document.getElementById('dark-theme-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'dark-theme-styles';
      document.head.appendChild(styleEl);
      
      // Use the styles from the external files
      styleEl.textContent = getDarkThemeStyles() 
    }
  }
  
  // Apply font size
  private applyFontSize(fontSize: number): void {
    if (!this.isBrowser) return;
    
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    
    // Add these styles dynamically if they don't exist
    this.ensureFontSizeStyles();
  }
  
  // Apply accessibility settings
  private applyAccessibilitySettings(settings: { reduceAnimations: boolean, highContrast: boolean }): void {
    if (!this.isBrowser) return;
    
    const html = document.documentElement;
    
    // High contrast - only apply if not in dark mode
    const isDarkMode = html.classList.contains('theme-dark') || document.body.classList.contains('dark-theme');
    
    if (settings.highContrast && !isDarkMode) {
      html.classList.add('high-contrast');
      this.ensureHighContrastStyles();
    } else {
      html.classList.remove('high-contrast');
    }
    
    // Reduced animations
    if (settings.reduceAnimations) {
      html.classList.add('reduce-motion');
      this.ensureReduceMotionStyles();
    } else {
      html.classList.remove('reduce-motion');
    }
  }
  
  // Ensure font size styles
  private ensureFontSizeStyles(): void {
    if (!this.isBrowser) return;
    
    if (!document.getElementById('app-font-size-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'app-font-size-styles';
      document.head.appendChild(styleEl);
      
      styleEl.textContent = `
        :root {
          --base-font-size: 14px;
        }
        body {
          font-size: var(--base-font-size);
        }
        .small-text {
          font-size: calc(var(--base-font-size) - 2px);
        }
        .large-text {
          font-size: calc(var(--base-font-size) + 2px);
        }
        h1, h2, h3, h4, h5, h6 {
          line-height: 1.2;
        }
      `;
    }
  }
  
  // Ensure high contrast styles
  private ensureHighContrastStyles(): void {
    if (!this.isBrowser) return;
    
    if (!document.getElementById('high-contrast-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'high-contrast-styles';
      document.head.appendChild(styleEl);
      
      styleEl.textContent = `
        /* High contrast mode is only available with light theme */
        .high-contrast {
          --text-color: #000000;
          --bg-color: #ffffff;
          --accent-color: #fd7e14;
          --border-color: #cccccc;
          --component-bg: #f8f9fa;
          --hover-color: #fff3e0;
        }
        
        /* Note message for high contrast settings UI */
        .high-contrast-note {
          background-color: #fff3e0;
          border-left: 3px solid #fd7e14;
          padding: 10px 15px;
          margin-bottom: 15px;
          font-size: 13px;
          color: #333;
          border-radius: 4px;
        }
        
        /* Hide this note in regular mode */
        .high-contrast-note {
          display: none;
        }
        
        /* Show this note when dark theme is active */
        .theme-dark ~ * .high-contrast-note,
        body.dark-theme .high-contrast-note {
          display: block;
        }
        
        .high-contrast body,
        .high-contrast .settings-main,
        .high-contrast .settings-sidebar,
        .high-contrast .profile-section,
        .high-contrast .section-content {
          background-color: var(--bg-color) !important;
          color: var(--text-color) !important;
        }
        
        /* Force sidebar to keep white text in high contrast mode */
        .high-contrast .sidebar-container *,
        .high-contrast .sidebar a,
        .high-contrast .sidebar i,
        .high-contrast .sidebar-nav-item,
        .high-contrast .sidebar-nav-item span,
        .high-contrast .sidebar-nav-item i,
        .high-contrast .sidebar .nav-text,
        .high-contrast .sidebar .nav-icon,
        .high-contrast app-sidebar *,
        .high-contrast app-sidebar .sidebar * {
          color: #ffffff !important;
        }
        
        /* Make sure none of the other rules override this */
        .high-contrast p.nav-text,
        .high-contrast span.nav-text,
        .high-contrast div.sidebar *,
        .high-contrast .sidebar span,
        .high-contrast .sidebar div,
        .high-contrast .sidebar p {
          color: #ffffff !important;
        }
        
        .high-contrast .section-header,
        .high-contrast .settings-group {
          background-color: var(--component-bg) !important;
          color: var(--text-color) !important;
        }
        
        .high-contrast .nav-item {
          color: #000000 !important;
        }
        
        .high-contrast .nav-item:hover {
          color: var(--accent-color) !important;
        }
        
        .high-contrast .nav-item.active {
          color: var(--accent-color) !important;
          font-weight: 600 !important;
        }
        
        .high-contrast .settings-card {
          background-color: var(--bg-color) !important;
        }
        
        /* Improved styling for settings actions buttons */
        .high-contrast .settings-actions {
          background-color: #fff3e0 !important;
          border: 1px solid var(--accent-color) !important;
          border-left: 3px solid var(--accent-color) !important;
          border-radius: 8px !important;
          padding: 15px !important;
        }
        
        .high-contrast .btn-cancel {
          background-color: #f8f9fa !important;
          color: #000000 !important;
          border: 1px solid #cccccc !important;
          border-radius: 4px !important;
          padding: 8px 16px !important;
          font-weight: 500 !important;
        }
        
        .high-contrast .btn-save {
          background-color: var(--accent-color) !important;
          color: #000000 !important;
          border: 1px solid var(--accent-color) !important;
          border-radius: 4px !important;
          padding: 8px 16px !important;
          font-weight: 600 !important;
        }
        
        .high-contrast .btn-cancel:hover {
          background-color: #e9ecef !important;
        }
        
        .high-contrast .btn-save:hover {
          background-color: #e8760f !important;
        }
        
        /* Doctor management */
        .high-contrast table {
          border: 1px solid var(--border-color) !important;
        }
        
        .high-contrast tr, 
        .high-contrast td, 
        .high-contrast th {
          border-color: var(--border-color) !important;
          color: var(--text-color) !important;
        }
        
        .high-contrast .table-header {
          background-color: var(--component-bg) !important;
        }
        
        .high-contrast .status-badge {
          border: 1px solid var(--border-color) !important;
        }
        
        .high-contrast .status-badge.active {
          background-color: #d4edda !important;
          color: #155724 !important;
        }
        
        .high-contrast .status-badge.inactive {
          background-color: #f8d7da !important;
          color: #721c24 !important;
        }
        
        .high-contrast .action-btn {
          background-color: var(--bg-color) !important;
          border: 1px solid var(--border-color) !important;
          color: var(--text-color) !important;
        }
        
        .high-contrast .search-input {
          background-color: var(--bg-color) !important;
          border: 1px solid var(--border-color) !important;
          color: var(--text-color) !important;
        }
        
        .high-contrast h1, 
        .high-contrast h2, 
        .high-contrast h3, 
        .high-contrast h4,
        .high-contrast h5,
        .high-contrast h6 {
          color: #000000 !important;
          font-weight: 600 !important;
        }
        
        .high-contrast p, 
        .high-contrast span, 
        .high-contrast div {
          color: #000000 !important;
        }
        
        /* Override the general selector for sidebar specifically - using max specificity */
        .high-contrast .sidebar-container p, 
        .high-contrast .sidebar-container span, 
        .high-contrast .sidebar-container div,
        .high-contrast div.sidebar *,
        .high-contrast div.sidebar p,
        .high-contrast div.sidebar span,
        .high-contrast div.sidebar a,
        .high-contrast div.sidebar i {
          color: #ffffff !important;
        }
        
        .high-contrast button,
        .high-contrast .btn {
          background-color: var(--component-bg) !important;
          color: var(--text-color) !important;
          border: 1px solid var(--border-color) !important;
        }
        
        .high-contrast .btn-primary,
        .high-contrast .btn-save {
          background-color: var(--accent-color) !important;
          color: #000000 !important;
          font-weight: 600 !important;
          border: 1px solid var(--accent-color) !important;
        }
        
        .high-contrast input:checked + .toggle-slider {
          background-color: var(--accent-color) !important;
        }
        
        /* Final and most specific rules to enforce sidebar text color */
        html.high-contrast .sidebar * {
          color: #ffffff !important;
        }
        
        html.high-contrast body .sidebar * {
          color: #ffffff !important;
        }
      `;
    }
  }
  
  // Ensure reduce motion styles
  private ensureReduceMotionStyles(): void {
    if (!this.isBrowser) return;
    
    if (!document.getElementById('reduce-motion-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'reduce-motion-styles';
      document.head.appendChild(styleEl);
      
      styleEl.textContent = `
        .reduce-motion * {
          transition: none !important;
          animation: none !important;
          scroll-behavior: auto !important;
        }
        
        .reduce-motion .settings-card:hover {
          transform: none !important;
        }
        
        .reduce-motion .toggle-slider:before {
          transition: none !important;
        }
      `;
    }
  }
} 