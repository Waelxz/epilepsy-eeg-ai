import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AnalysisService, Analysis } from '../../../shared/services/analysis.service';
import { PatientService, Patient } from '../../../shared/services/patient.service';
import { ReportService } from '../../../shared/services/report.service';
import { Chart, registerables, ChartConfiguration, ChartType } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

// Type for chart configuration
type ChartConfigType = ChartConfiguration<'line', number[], string>;

@Component({
  selector: 'app-analysis-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './analysis-details.component.html',
  styleUrl: './analysis-details.component.css'
})
export class AnalysisDetailsComponent implements OnInit, OnDestroy, AfterViewInit {
  // Analysis ID from route params
  analysisId: string = '';
  
  // Analysis data
  analysis: Analysis | null = null;
  
  // Patient data
  patient: Patient | null = null;
  
  // Loading state
  isLoading: boolean = true;
  
  // Error message
  errorMessage: string = '';
  
  // UI States
  isGeneratingReport: boolean = false;
  
  // Existing report for this analysis
  existingReport: any = null;
  
  // Notes editing
  isEditingNotes: boolean = false;
  notesContent: string = '';
  
  // EEG Chart
  @ViewChild('eegCanvas') eegCanvas!: ElementRef<HTMLCanvasElement>;
  eegChart: Chart | null = null;
  eegData: number[][] = [];
  isLoadingEEG: boolean = false;
  eegLoadError: string = '';
  eegDataLoaded: boolean = false;
  canvasReady: boolean = false;
  
  // Channel selection for EEG display
  selectedChannel: number = 0;
  channelNames: string[] = ['X-Signal', 'Y-Signal'];
  
  // Flag to check if we're in a browser environment
  isBrowser: boolean = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private analysisService: AnalysisService,
    private patientService: PatientService,
    private reportService: ReportService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    // Check if we're in the browser
    this.isBrowser = isPlatformBrowser(platformId);
  }
  
  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.analysisId = params['id'];
      this.loadAnalysis();
    });
    
    // Conditionally import zoom plugin only in browser environment
    if (this.isBrowser) {
      import('chartjs-plugin-zoom').then(module => {
        const zoomPlugin = module.default;
        Chart.register(zoomPlugin);
      }).catch(err => {
        console.error('Failed to load zoom plugin:', err);
      });
    }
  }
  
  ngAfterViewInit(): void {
    console.log('View initialized, canvas ready:', !!this.eegCanvas);
    this.canvasReady = true;
    this.attemptEEGVisualization();
    
    // Adding a failsafe with longer timeout to ensure visualization loads
    setTimeout(() => {
      if (!this.eegChart && this.analysisId) {
        console.log('Failsafe: Loading EEG data after timeout');
        this.loadEEGData();
      }
    }, 500);
  }
  
  ngOnDestroy(): void {
    // Clean up chart to prevent memory leaks
    if (this.eegChart) {
      this.eegChart.destroy();
      this.eegChart = null;
    }
  }
  
  // Check if we have everything needed to create the visualization
  attemptEEGVisualization(): void {
    console.log('Attempting visualization:', {
      canvasReady: this.canvasReady,
      dataLoaded: this.eegDataLoaded,
      isLoading: this.isLoading,
      eegDataLength: this.eegData.length
    });
    
    if (this.canvasReady && !this.isLoading && this.analysisId && !this.eegChart) {
      if (this.eegDataLoaded) {
        // We already have the data, just create the chart
        console.log('Data already loaded, creating chart');
        this.createEEGChart();
      } else {
        // Need to load the data first
        console.log('Canvas ready but need to load data');
        this.loadEEGData();
      }
    }
  }
  
  loadAnalysis(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.analysisService.getAnalysisById(this.analysisId).subscribe({
      next: (analysis) => {
        console.log('Analysis loaded');
        this.analysis = analysis;
        this.loadPatient(analysis.patientId);
        this.loadEEGData(); // Always try to load EEG data as soon as we have the analysis ID
        this.checkExistingReport(); // Check if a report already exists
      },
      error: (error) => {
        console.error('Error loading analysis:', error);
        this.errorMessage = 'Failed to load analysis data. Please try again.';
        this.isLoading = false;
      }
    });
  }
  
  loadPatient(patientId: string): void {
    this.patientService.getPatientById(patientId).subscribe({
      next: (patient) => {
        console.log('Patient loaded');
        this.patient = patient;
        this.isLoading = false;
        this.attemptEEGVisualization();
      },
      error: (error) => {
        console.error('Error loading patient:', error);
        this.errorMessage = 'Failed to load patient data.';
        this.isLoading = false;
      }
    });
  }
  
  // Improve the report generation function
  generateReport(reportType: 'patient' | 'analysis'): void {
    if (!this.analysisId) {
      console.error('No analysis ID available');
      return;
    }
    
    // Add detailed debugging
    console.log(`DEBUG: About to generate report with analysisId="${this.analysisId}" and reportType="${reportType}"`);
    console.log(`DEBUG: Analysis ID type: ${typeof this.analysisId}`);
    console.log(`DEBUG: Report type type: ${typeof reportType}`);
    console.log(`DEBUG: First 4 chars of ID: ${this.analysisId.substring(0, 4)}, Last 4 chars: ${this.analysisId.substring(this.analysisId.length - 4)}`);
    
    // Check if the ID is in the expected format for MongoDB ObjectId
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(this.analysisId);
    console.log(`DEBUG: Is valid MongoDB ObjectId format: ${isValidObjectId}`);
    
    this.isGeneratingReport = true;
    
    // Use the reportType parameter that was passed to the function
    console.log(`Generating report of type: ${reportType}`);
    
    // Try both approaches
    this.reportService.generateReport(this.analysisId, reportType)
      .subscribe({
      next: (report) => {
        console.log(`Report generated successfully: ${report.id}`);
        this.isGeneratingReport = false;
        
        // Update the existingReport property
        this.existingReport = report;
        
        // Show a toast or notification
        alert(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully!`);
        
        // Automatically download the report
        this.downloadReport(report.id || '');
      },
      error: (error) => {
        console.error('Error generating report:', error);
        this.isGeneratingReport = false;
        
        // Show error message with more details
        const errorMsg = error.message || 'Unknown error';
        alert(`Failed to generate ${reportType} report: ${errorMsg}`);
      }
    });
  }
  
  // Improve the download report function
  downloadReport(reportId: string): void {
    if (!reportId) {
      console.error('No report ID provided');
      return;
    }
    
    console.log(`Downloading report: ${reportId}`);
    
    this.reportService.downloadReport(reportId).subscribe({
      next: (blob) => {
        // Create file name with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `report-${timestamp}.pdf`;
        
        // Create and trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('Report downloaded successfully');
      },
      error: (error) => {
        console.error('Error downloading report:', error);
        alert('Failed to download report. Please try again later.');
      }
    });
  }
  
  // Return to patient details
  returnToPatient(): void {
    if (this.analysis?.patientId) {
      this.router.navigate(['/doctor/patients', this.analysis.patientId]);
    } else {
      this.router.navigate(['/doctor/patients']);
    }
  }
  
  // Format date helper
  formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Format upload date helper
  formatUploadDate(): string {
    if (!this.analysis || !this.analysis.uploadDate) return 'N/A';
    return this.formatDate(this.analysis.uploadDate);
  }
  
  // Format time helper
  formatTime(date: Date | string | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Get class for analysis result
  getAnalysisStatusClass(result?: any): string {
    if (!result) return '';
    return this.analysisService.getClassificationClass(result);
  }
  
  // Get label for analysis status
  getAnalysisStatusLabel(result?: any): string {
    if (!result) return 'Unknown';
    return this.analysisService.getClassificationLabel(result);
  }
  
  // Get technical classification label (for model-specific output)
  getTechnicalClassification(result?: any): string {
    if (!result) return 'Unknown';
    
    // Make sure model information is included in the result
    if (this.analysis && this.analysis.modelUsed) {
      // Create a copy of the result with model information
      const resultWithModel = {
        ...result,
        modelId: this.analysis.modelUsed
      };
      return this.analysisService.getClassificationLabel(resultWithModel, 'specific');
    }
    
    return this.analysisService.getClassificationLabel(result, 'specific');
  }
  
  // Format file size helper
  formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown';
    return this.analysisService.formatFileSize(bytes);
  }
  
  // Calculate processing time
  getProcessingTime(): string {
    if (!this.analysis || !this.analysis.processingStartTime || !this.analysis.processingEndTime) {
      return 'N/A';
    }
    
    const startTime = new Date(this.analysis.processingStartTime).getTime();
    const endTime = new Date(this.analysis.processingEndTime).getTime();
    const seconds = (endTime - startTime) / 1000;
    
    return `${seconds.toFixed(1)} seconds`;
  }
  
  // Calculate age from date of birth
  calculateAge(dateOfBirth: string | Date | undefined): string {
    if (!dateOfBirth) return 'N/A';
    
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    
    // Adjust age if birthday hasn't occurred yet this year
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age.toString();
  }
  
  // Helper method to get metric value with proper formatting
  getMetricValue(value?: number): string {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  }
  
  // Toggle fullscreen mode for the EEG visualization
  toggleFullscreen(): void {
    // Skip if not in browser
    if (!this.isBrowser) return;
    
    const eegContainer = this.eegCanvas.nativeElement.closest('.eeg-chart-container');
    
    if (!eegContainer) return;
    
    if (!document.fullscreenElement) {
      // Enter fullscreen using the standard Fullscreen API
      eegContainer.requestFullscreen()
        .catch(err => {
          console.error('Error attempting to enable fullscreen:', err);
        });
    } else {
      // Exit fullscreen
      document.exitFullscreen()
        .catch(err => {
          console.error('Error attempting to exit fullscreen:', err);
        });
    }
  }
  
  // Add a method to handle zoom reset
  resetZoom(): void {
    if (!this.isBrowser) return;
    
    if (this.eegChart) {
      try {
        // Access the resetZoom method if available
        // @ts-ignore
        if (typeof this.eegChart.resetZoom === 'function') {
          // @ts-ignore
          this.eegChart.resetZoom();
        }
      } catch (err) {
        console.error('Failed to reset zoom:', err);
      }
    }
  }
  
  // Load EEG data and create visualization
  loadEEGData(): void {
    if (!this.analysisId || this.isLoadingEEG) return;
    
    console.log('Starting EEG data load');
    this.isLoadingEEG = true;
    this.eegLoadError = '';
    
    this.analysisService.getEEGData(this.analysisId).subscribe({
      next: (data) => {
        console.log('EEG data loaded successfully, length:', data.length);
        this.eegData = data;
        this.isLoadingEEG = false;
        this.eegDataLoaded = true;
        
        // Create chart if canvas is ready
        if (this.canvasReady) {
          console.log('Canvas ready, creating chart');
          this.createEEGChart();
        } else {
          console.log('Canvas not ready yet, will create chart later');
        }
      },
      error: (error) => {
        console.error('Error loading EEG data:', error);
        this.eegLoadError = 'Failed to load EEG data. Please try again.';
        this.isLoadingEEG = false;
      }
    });
  }
  
  // Create/update the EEG chart
  createEEGChart(): void {
    console.log('Creating EEG chart');
    if (!this.isBrowser || !this.eegCanvas || !this.eegData || this.eegData.length === 0) {
      console.log('Cannot create chart, missing:', {
        browser: !this.isBrowser,
        canvas: !this.eegCanvas,
        data: !this.eegData,
        emptyData: this.eegData && this.eegData.length === 0
      });
      return;
    }
    
    // Destroy existing chart if it exists
    if (this.eegChart) {
      console.log('Destroying existing chart');
      this.eegChart.destroy();
    }
    
    const ctx = this.eegCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }
    
    // Determine which channel to display (default to first channel if selected isn't available)
    const channelIndex = this.selectedChannel < this.eegData.length ? this.selectedChannel : 0;
    const channelData = this.eegData[channelIndex];
    
    console.log(`Using channel ${channelIndex}, data points: ${channelData.length}`);
    
    // For Bern-Barcelona dataset, the sample rate is 512Hz
    const sampleRate = 512;
    
    // Only use a subset of points for better visualization - ensure we retain all critical data points
    // Use a dynamic downsample factor based on data length to ensure we don't overwhelm the browser
    // but still display all the important features
    const downsampleFactor = Math.max(1, Math.floor(channelData.length / 5000));
    
    // Visible initial dataset (downsampled for better performance)
    const downsampledData: number[] = [];
    const downsampledLabels: string[] = [];
    
    // Add a point every 'downsampleFactor' samples
    for (let i = 0; i < channelData.length; i += downsampleFactor) {
      downsampledData.push(channelData[i]);
      // Convert to seconds (divide by sample rate)
      downsampledLabels.push((i / sampleRate).toFixed(2));
    }
    
    console.log(`Downsampled to ${downsampledData.length} points with factor ${downsampleFactor}`);
    
    // Create Chart.js configuration with optional zoom support
    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: downsampledLabels,
        datasets: [{
          label: this.channelNames[channelIndex],
          data: downsampledData,
          borderColor: '#8b5cf6',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.2,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0 // Disable animation for better performance with large datasets
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time (seconds)',
              font: {
                weight: 'bold'
              }
            },
            ticks: {
              maxTicksLimit: 20,
              autoSkip: false,
              callback: function(value: any, index: number, values: any[]): string {
                // Show more time points with clear intervals
                return index % Math.ceil(values.length / 20) === 0 ? value + 's' : '';
              }
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Amplitude (µV)',
              font: {
                weight: 'bold'
              }
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
            callbacks: {
              title: function(tooltipItems: any[]): string {
                return `Time: ${tooltipItems[0].label}s`;
              },
              label: function(context: any): string {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} µV`;
              }
            }
          }
        }
      }
    };
    
    // Add zoom plugin configuration if available
    if (this.isBrowser) {
      try {
        // Need to use any type since zoom plugin is not in the Chart.js type definitions
        const configAny = config as any;
        if (!configAny.options.plugins) {
          configAny.options.plugins = {};
        }
        configAny.options.plugins.zoom = {
          limits: {
            x: {min: 'original', max: 'original', minRange: 1},
            y: {min: 'original', max: 'original', minRange: 1}
          },
          pan: {
            enabled: true,
            mode: 'x'
          },
          zoom: {
            wheel: {
              enabled: true
            },
            pinch: {
              enabled: true
            },
            mode: 'x'
          }
        };
      } catch (err) {
        console.error('Failed to configure zoom plugin:', err);
      }
    }
    
    console.log('Creating new chart with configuration');
    
    // Create the chart
    try {
      this.eegChart = new Chart(ctx, config);
      console.log('Chart created successfully');
    } catch (err) {
      console.error('Error creating chart:', err);
    }
  }
  
  // Change the displayed EEG channel
  changeChannel(channelIndex: number): void {
    if (channelIndex >= 0 && channelIndex < this.eegData.length) {
      this.selectedChannel = channelIndex;
      this.createEEGChart();
    }
  }
  
  // Get patient full name helper
  getPatientFullName(): string {
    if (!this.patient) return '';
    return `${this.patient.firstName} ${this.patient.lastName}`;
  }
  
  // Check if model is CNN-BERN type
  getModelIncludesCnnBern(): boolean {
    if (!this.analysis || !this.analysis.modelUsed) {
      return false;
    }
    
    const modelName = this.analysis.modelUsed.toUpperCase();
    return modelName.includes('CNN-BERN');
  }
  
  // Notes management methods
  startEditingNotes(): void {
    this.isEditingNotes = true;
    this.notesContent = this.analysis?.notes || '';
  }
  
  cancelEditNotes(): void {
    this.isEditingNotes = false;
    this.notesContent = '';
  }
  
  saveNotes(): void {
    if (!this.analysis || !this.analysisId) return;
    
    this.analysisService.updateAnalysisNotes(this.analysisId, this.notesContent).subscribe({
      next: (updatedAnalysis) => {
        if (this.analysis) {
          this.analysis.notes = this.notesContent;
        }
        this.isEditingNotes = false;
      },
      error: (error) => {
        console.error('Error saving notes:', error);
        // For demo purposes, update locally even if API fails
        if (this.analysis) {
          this.analysis.notes = this.notesContent;
        }
        this.isEditingNotes = false;
      }
    });
  }
  
  // Check if a report already exists for this analysis
  checkExistingReport(): void {
    if (!this.analysisId) return;
    
    const params = {
      analysisId: this.analysisId,
      reportType: 'analysis',
      page: 1,
      limit: 1
    };
    
    this.reportService.getReports(params).subscribe({
      next: (response) => {
        if (response.items.length > 0) {
          this.existingReport = response.items[0];
          console.log('Found existing report:', this.existingReport);
        } else {
          this.existingReport = null;
        }
      },
      error: (error) => {
        console.error('Error checking for existing report:', error);
        this.existingReport = null;
      }
    });
  }
  
  // Download existing report
  downloadExistingReport(): void {
    if (!this.existingReport || !this.existingReport.id) {
      console.error('No report ID available');
      return;
    }
    
    this.downloadReport(this.existingReport.id);
  }
  
  // Regenerate report
  regenerateReport(): void {
    if (!this.analysisId) {
      console.error('No analysis ID available');
      return;
    }
    
    // Reset existing report so UI shows generating state
    this.existingReport = null;
    // Generate new report
    this.generateReport('analysis');
  }
}
