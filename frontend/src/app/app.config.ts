import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors, HttpInterceptorFn } from '@angular/common/http';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { AppSettingsService } from './shared/services/app-settings.service';
import { AuthService } from './auth/auth.service';
import { inject } from '@angular/core';

// Function that will load theme settings before the app is fully initialized
export function initializeAppSettings(appSettingsService: AppSettingsService) {
  return () => {
    return new Promise<void>((resolve) => {
      // Small timeout to ensure DOM is ready
      setTimeout(() => {
        appSettingsService.loadAndApplySettings();
        resolve();
      }, 0);
    });
  };
}

// Auth interceptor function
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  
  return next(req);
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes), 
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor])
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAppSettings,
      deps: [AppSettingsService],
      multi: true
    }
  ]
};
