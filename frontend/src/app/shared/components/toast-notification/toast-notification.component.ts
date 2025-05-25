import { Component, Input, OnInit, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-toast-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" [@toastAnimation]="visible ? 'visible' : 'hidden'" 
         [ngClass]="{
           'success': type === 'success', 
           'error': type === 'error', 
           'info': type === 'info',
           'share-success': type === 'success' && message.includes('sent successfully')
         }">
      <div class="toast-icon">
        <i class="fas" [ngClass]="{
          'fa-check-circle': type === 'success' && !message.includes('sent successfully'),
          'fa-paper-plane': type === 'success' && message.includes('sent successfully'),
          'fa-exclamation-circle': type === 'error',
          'fa-info-circle': type === 'info'
        }"></i>
      </div>
      <div class="toast-content">
        <div class="toast-message">{{ message }}</div>
      </div>
      <button class="toast-close" (click)="closeToast()" *ngIf="showCloseButton">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 30px;
      right: 30px;
      display: flex;
      align-items: center;
      min-width: 300px;
      max-width: 450px;
      padding: 12px 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      overflow: hidden;
      var(--toast-position);
    }
    
    .toast-container.success {
      background-color: #ecfdf5;
      border-left: 4px solid #10b981;
    }
    
    .toast-container.error {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
    }
    
    .toast-container.info {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
    }
    
    .toast-container.share-success {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-left: 4px solid #4f46e5;
      color: white;
      right: 50%;
      transform: translateX(50%);
      min-width: 350px;
    }
    
    .toast-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      font-size: 1.2rem;
    }
    
    .success .toast-icon {
      color: #10b981;
    }
    
    .error .toast-icon {
      color: #ef4444;
    }
    
    .info .toast-icon {
      color: #3b82f6;
    }
    
    .share-success .toast-icon {
      color: white;
    }
    
    .toast-content {
      flex: 1;
    }
    
    .toast-message {
      font-size: 0.95rem;
      color: #1f2937;
      line-height: 1.4;
    }
    
    .share-success .toast-message {
      color: white;
      font-weight: 500;
    }
    
    .toast-close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.85rem;
      color: #9ca3af;
      padding: 5px;
      margin-left: 10px;
      transition: color 0.2s;
    }
    
    .toast-close:hover {
      color: #4b5563;
    }
    
    .share-success .toast-close {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .share-success .toast-close:hover {
      color: white;
    }
  `],
  animations: [
    trigger('toastAnimation', [
      state('hidden', style({
        opacity: 0,
        transform: 'translateY(100%)'
      })),
      state('visible', style({
        opacity: 1,
        transform: 'translateY(0)'
      })),
      transition('hidden => visible', animate('300ms ease-out')),
      transition('visible => hidden', animate('300ms ease-in'))
    ])
  ]
})
export class ToastNotificationComponent implements OnInit, OnDestroy {
  @Input() message: string = '';
  @Input() type: 'success' | 'error' | 'info' = 'info';
  @Input() duration: number = 4000; // Duration in ms, default 4 seconds
  @Input() showCloseButton: boolean = true;
  
  @Output() closed = new EventEmitter<void>();
  
  visible: boolean = false;
  private timeout: any;
  
  ngOnInit(): void {
    this.show();
  }
  
  ngOnDestroy(): void {
    this.clearTimeout();
  }
  
  show(): void {
    // Increase duration for share success messages
    if (this.type === 'success' && this.message.includes('sent successfully')) {
      this.duration = 6000; // Show for longer (6 seconds)
    }
    
    this.visible = true;
    if (this.duration > 0) {
      this.timeout = setTimeout(() => {
        this.close();
      }, this.duration);
    }
  }
  
  close(): void {
    this.visible = false;
    this.clearTimeout();
    
    // Allow animation to finish before removing component
    setTimeout(() => {
      this.closed.emit();
    }, 300);
  }
  
  closeToast(): void {
    this.close();
  }
  
  private clearTimeout(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
} 