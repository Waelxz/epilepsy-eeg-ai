import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay-backdrop" (click)="cancel()"></div>
    <div class="dialog-container" (click)="$event.stopPropagation()">
      <div class="dialog-content">
        <div class="dialog-header">
          <h2>{{ title }}</h2>
        </div>
        <div class="dialog-body">
          <p>{{ message }}</p>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" (click)="cancel()">Cancel</button>
          <button class="btn-confirm" [ngClass]="{'btn-danger': type === 'delete'}" (click)="confirm()">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
  @Input() title: string = 'Confirm';
  @Input() message: string = 'Are you sure?';
  @Input() confirmText: string = 'Confirm';
  @Input() type: 'delete' | 'confirm' = 'confirm';
  
  @Output() onCancel = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();
  
  cancel(): void {
    this.onCancel.emit();
  }
  
  confirm(): void {
    this.onConfirm.emit();
  }
} 