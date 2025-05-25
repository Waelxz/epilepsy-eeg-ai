import { ApplicationRef, ComponentRef, createComponent, EnvironmentInjector, Injectable, Type } from '@angular/core';
import { ToastNotificationComponent } from '../components/toast-notification/toast-notification.component';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts: ComponentRef<ToastNotificationComponent>[] = [];

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {}

  /**
   * Show a success toast notification
   * @param message - Message to display
   * @param duration - Duration in ms (default: 4000ms)
   */
  success(message: string, duration: number = 4000): void {
    this.show(message, 'success', duration);
  }

  /**
   * Show a special success notification for sharing reports
   * @param message - Message to display
   * @param duration - Duration in ms (default: 6000ms for share success)
   */
  shareSuccess(message: string, duration: number = 6000): void {
    // Clear any existing toasts first to make this more prominent
    this.clearAll();
    
    // Show in a more prominent position (top center)
    this.show(message, 'success', duration, true, 'top');
  }

  /**
   * Show an error toast notification
   * @param message - Message to display
   * @param duration - Duration in ms (default: 5000ms for errors)
   */
  error(message: string, duration: number = 5000): void {
    this.show(message, 'error', duration);
  }

  /**
   * Show an info toast notification
   * @param message - Message to display
   * @param duration - Duration in ms (default: 4000ms)
   */
  info(message: string, duration: number = 4000): void {
    this.show(message, 'info', duration);
  }

  /**
   * Clear all active toast notifications
   */
  clearAll(): void {
    // Clone the array before iterating to avoid issues when items are removed
    const toastsToRemove = [...this.toasts];
    toastsToRemove.forEach(toast => {
      this.removeToast(toast);
    });
  }

  /**
   * Show a toast notification
   * @param message - Message to display
   * @param type - Type of toast ('success', 'error', 'info')
   * @param duration - Duration in ms
   * @param showCloseButton - Whether to show the close button
   * @param position - Position of the toast ('bottom' or 'top')
   */
  private show(
    message: string,
    type: 'success' | 'error' | 'info',
    duration: number = 4000,
    showCloseButton: boolean = true,
    position: 'bottom' | 'top' = 'bottom'
  ): void {
    // Create the component
    const toastComponentRef = createComponent(ToastNotificationComponent, {
      environmentInjector: this.injector
    });

    // Set the component inputs
    const instance = toastComponentRef.instance;
    instance.message = message;
    instance.type = type;
    instance.duration = duration;
    instance.showCloseButton = showCloseButton;
    
    // Set position if top is specified
    if (position === 'top') {
      const element = toastComponentRef.location.nativeElement;
      element.style.setProperty('--toast-position', 'top: 30px; bottom: auto;');
    }

    // Handle component closing
    instance.closed.subscribe(() => {
      this.removeToast(toastComponentRef);
    });

    // Add the component to the DOM
    document.body.appendChild(toastComponentRef.location.nativeElement);
    this.appRef.attachView(toastComponentRef.hostView);

    // Manage the toast stack
    this.adjustToastPositions(position);
    this.toasts.push(toastComponentRef);
  }

  /**
   * Remove a toast component
   * @param toastRef - Component reference to remove
   */
  private removeToast(toastRef: ComponentRef<ToastNotificationComponent>): void {
    // Find the index of the toast
    const index = this.toasts.indexOf(toastRef);
    if (index !== -1) {
      // Remove from our array
      this.toasts.splice(index, 1);
      
      // Destroy the component
      toastRef.destroy();
      
      // Adjust positions of remaining toasts
      this.adjustToastPositions();
    }
  }

  /**
   * Adjust positions of all toasts so they don't overlap
   * @param position - Default position to use ('bottom' or 'top')
   */
  private adjustToastPositions(position: 'bottom' | 'top' = 'bottom'): void {
    // Position toasts from bottom to top with some spacing
    const toastHeight = 70; // Approximate toast height with margin
    
    this.toasts.forEach((toastRef, index) => {
      const element = toastRef.location.nativeElement.querySelector('.toast-container');
      if (element) {
        if (position === 'top') {
          // Calculate top position based on index
          const top = 30 + (index * toastHeight);
          element.style.top = `${top}px`;
          element.style.bottom = 'auto';
        } else {
          // Calculate bottom position based on index
          const bottom = 30 + (index * toastHeight);
          element.style.bottom = `${bottom}px`;
          element.style.top = 'auto';
        }
      }
    });
  }
} 