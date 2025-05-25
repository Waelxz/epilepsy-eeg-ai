import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Patient } from '../../../shared/services/patient.service';
import { Analysis } from '../../../shared/services/analysis.service';
import { Report } from '../../../shared/services/report.service';
import { AnalysisService } from '../../../shared/services/analysis.service';

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  date: string | Date;
  eventType: 'analysis' | 'report' | 'medication' | 'note';
  status?: string;
  icon: string;
  data?: any;
}

@Component({
  selector: 'app-patient-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './patient-timeline.component.html',
  styleUrl: './patient-timeline.component.css'
})
export class PatientTimelineComponent implements OnInit {
  @Input() patientId: string = '';
  @Input() patient: Patient | null = null;
  @Input() analyses: Analysis[] = [];
  @Input() reports: Report[] = [];
  
  timelineEvents: TimelineEvent[] = [];
  filteredEvents: TimelineEvent[] = [];
  
  // Filter options
  activeFilters: { [key: string]: boolean } = {
    analysis: true,
    report: true,
    medication: true,
    note: true
  };
  
  constructor(private analysisService: AnalysisService) {}
  
  ngOnInit(): void {
    this.processTimelineData();
  }
  
  processTimelineData(): void {
    this.timelineEvents = [];
    
    // Process analyses data
    if (this.analyses && this.analyses.length > 0) {
      this.analyses.forEach(analysis => {
        this.timelineEvents.push({
          id: analysis.id || `analysis-${Math.random()}`,
          title: 'EEG Analysis',
          description: analysis.fileName || 'EEG File Analysis',
          date: analysis.uploadDate || new Date(),
          eventType: 'analysis',
          status: analysis.status,
          icon: 'fa-chart-line',
          data: analysis
        });
      });
    }
    
    // Process reports data
    if (this.reports && this.reports.length > 0) {
      this.reports.forEach(report => {
        this.timelineEvents.push({
          id: report.id || `report-${Math.random()}`,
          title: `${report.reportType?.charAt(0).toUpperCase()}${report.reportType?.slice(1)} Report Generated`,
          description: `Report for analysis ${report.analysisId}`,
          date: report.generatedDate || new Date(),
          eventType: 'report',
          icon: 'fa-file-medical-alt',
          data: report
        });
      });
    }
    
    // Add medications changes as events
    if (this.patient?.medications && this.patient.medications.length > 0) {
      // Since we don't have actual medication change dates, use a placeholder date
      // In a real implementation, medication changes would have their own timestamps
      const placeholderDate = this.patient.createdAt || new Date();
      
      this.patient.medications.forEach((med, index) => {
        this.timelineEvents.push({
          id: `medication-${index}`,
          title: `Medication Added: ${med.name}`,
          description: `${med.dosage}, ${med.frequency}`,
          date: placeholderDate,
          eventType: 'medication',
          icon: 'fa-pills',
          data: med
        });
      });
    }
    
    // Add medical notes as events if available
    if (this.patient?.notes) {
      this.timelineEvents.push({
        id: 'medical-notes',
        title: 'Clinical Notes Updated',
        description: this.patient.notes.substring(0, 100) + (this.patient.notes.length > 100 ? '...' : ''),
        date: this.patient?.createdAt || new Date(),
        eventType: 'note',
        icon: 'fa-sticky-note',
        data: { notes: this.patient.notes }
      });
    }
    
    // Sort all events by date (most recent first)
    this.timelineEvents.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    this.applyFilters();
  }
  
  applyFilters(): void {
    this.filteredEvents = this.timelineEvents.filter(event => 
      this.activeFilters[event.eventType]
    );
  }
  
  toggleFilter(filterType: 'analysis' | 'report' | 'medication' | 'note'): void {
    this.activeFilters[filterType] = !this.activeFilters[filterType];
    this.applyFilters();
  }
  
  getEventStatusClass(event: TimelineEvent): string {
    if (event.eventType === 'analysis') {
      const analysis = event.data as Analysis;
      if (analysis.status === 'completed') {
        return this.analysisService.getClassificationClass(analysis.result);
      } else if (analysis.status === 'queued' || analysis.status === 'processing') {
        return 'status-pending';
      }
    } 
    return '';
  }
  
  // Get status label (Normal/Abnormal)
  getStatusLabel(analysis: Analysis): string {
    if (analysis.status === 'completed' && analysis.result) {
      return this.analysisService.getClassificationLabel(analysis.result);
    }
    return 'Unknown';
  }
  
  // Get technical classification (Focal/Non-Focal)
  getTechnicalClassification(analysis: Analysis): string {
    if (analysis.status === 'completed' && analysis.result) {
      // Create a result object with model information
      const resultWithModel = {
        ...analysis.result,
        modelId: analysis.modelUsed
      };
      return this.analysisService.getClassificationLabel(resultWithModel, 'specific');
    }
    return 'Unknown';
  }
  
  formatDate(date: Date | string): string {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
