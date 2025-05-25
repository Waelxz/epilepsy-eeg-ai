import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { AnalysisNewComponent } from '../analysis-new/analysis-new.component';

@Component({
  selector: 'app-analysis-overlay',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AnalysisNewComponent
  ],
  templateUrl: './analysis-overlay.component.html',
  styleUrl: './analysis-overlay.component.css'
})
export class AnalysisOverlayComponent {
  @Input() patientId: string | null = null;
  @Output() closeOverlay = new EventEmitter<void>();
  @Output() analysisCreated = new EventEmitter<string>();
  
  // Close overlay when Escape key is pressed
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent) {
    this.close();
  }
  
  // Close the overlay
  close(): void {
    this.closeOverlay.emit();
  }
  
  // Handle analysis creation success
  onAnalysisCreated(analysisId: string): void {
    this.analysisCreated.emit(analysisId);
    // Close the overlay after emitting the event
    this.close();
  }
}
