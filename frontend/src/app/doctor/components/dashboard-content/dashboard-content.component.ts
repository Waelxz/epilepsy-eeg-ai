import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Chart, registerables, ChartType, ChartData, ChartConfiguration } from 'chart.js';
import { PatientService } from '../../../shared/services/patient.service';
import { AnalysisService } from '../../../shared/services/analysis.service';
import { AuthService } from '../../../auth/auth.service';
import { UserService } from '../../../shared/services/user.service';

// Register Chart.js components
Chart.register(...registerables);

// Define chart types for TypeScript
type ChartTypes = {
  doughnut: Chart<'doughnut', number[], string>;
  bar: Chart<'bar', number[], string>;
  gauge: Chart<'doughnut', number[], string>; // Using doughnut for gauge visualization
};

// Analysis item interface
interface RecentAnalysisItem {
  id: string;
  patientId: string;
  patientName: string;
  status: 'normal' | 'abnormal' | 'pending';
  uploadedAt: Date;
}

@Component({
  selector: 'app-dashboard-content',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard-content.component.html',
  styleUrls: ['./dashboard-content.component.css']
})
export class DashboardContentComponent implements OnInit, AfterViewInit {
  @ViewChild('resultsChart') private resultsChartRef!: ElementRef;
  @ViewChild('ageDistributionChart') private ageDistributionChartRef!: ElementRef;
  @ViewChild('trendGaugeChart') private trendGaugeChartRef!: ElementRef;
  @ViewChild('resultsByAgeChart') private resultsByAgeChartRef!: ElementRef;

  // Dashboard summary data
  totalPatients: number = 0;
  recentAnalyses: number = 0;
  pendingReviews: number = 0;
  abnormalResults: number = 0;
  normalResults: number = 0;
  
  // User info
  currentUserName: string = 'Dr. Smith';

  // Chart instances with proper typing
  resultsChart: ChartTypes['doughnut'] | null = null;
  ageDistributionChart: ChartTypes['bar'] | null = null;
  trendGaugeChart: ChartTypes['gauge'] | null = null;
  resultsByAgeChart: ChartTypes['bar'] | null = null;

  // Data loading states
  isLoading: boolean = true;
  dataError: boolean = false;

  // Age groups for visualization
  ageGroups: string[] = ['0-18', '19-35', '36-50', '51-65', '65+'];
  ageData: number[] = [0, 0, 0, 0, 0];
  
  // Results by age group
  ageNormalData: number[] = [0, 0, 0, 0, 0];
  ageAbnormalData: number[] = [0, 0, 0, 0, 0];

  // Recent analyses 
  recentAnalysesList: RecentAnalysisItem[] = [];
  
  // Track patient names
  patientNames: { [key: string]: string } = {};

  constructor(
    private patientService: PatientService,
    private analysisService: AnalysisService,
    private authService: AuthService,
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Load user info
    this.loadUserInfo();
    
    // Load summary data
    this.loadSummaryData();
  }

  ngAfterViewInit(): void {
    // Do not initialize charts here anymore
    // Charts will be initialized after data loads
    console.log('ngAfterViewInit - Charts will be initialized after data loads');
  }

  loadUserInfo(): void {
    // Get current user data from UserService
    this.userService.getCurrentUserProfile().subscribe({
      next: (userData) => {
        console.log('Dashboard - User data received:', userData);
        
        // Check all possible property name combinations
        const firstName = userData.first_name || userData.firstName || '';
        const lastName = userData.last_name || userData.lastName || '';
        
        // Format user name with both first and last name
        if (firstName && lastName) {
          this.currentUserName = `Dr. ${firstName} ${lastName}`;
        } else if (userData.name) {
          this.currentUserName = `Dr. ${userData.name}`;
        } else if (userData.username) {
          this.currentUserName = `Dr. ${userData.username}`;
        } else if (userData.email) {
          // Fallback to email if no name fields are available
          this.currentUserName = `Dr. ${userData.email.split('@')[0]}`;
        } else {
          this.currentUserName = 'Dr. Smith';
        }
      },
      error: (error) => {
        console.error('Error loading user info:', error);
        // Use default name on error
        this.currentUserName = 'Dr. Smith';
      }
    });
  }

  loadSummaryData(): void {
    this.isLoading = true;

    // Reset chart data
    this.ageData = [0, 0, 0, 0, 0];
    this.ageNormalData = [0, 0, 0, 0, 0];
    this.ageAbnormalData = [0, 0, 0, 0, 0];
    this.recentAnalysesList = [];

    // Load patient data - use the maximum allowed limit of 100
    this.patientService.getPatients({ limit: 100 }).subscribe({
      next: (response) => {
        this.totalPatients = response.metadata.total_count;
        
        // Count patients with analyses
        let patientsWithAnalyses = 0;
        let totalNormalResults = 0;
        let totalAbnormalResults = 0;
        let pendingCount = 0;

        // Process patient data for visualizations
        response.items.forEach(patient => {
          // Process age distribution
          this.updateAgeDistribution(patient);
          
          // Process results by age
          if (patient.analysisStatus?.hasAnalysis) {
            patientsWithAnalyses++;
            
            // Count results
            if (patient.analysisStatus.normalResultCount) {
              totalNormalResults += patient.analysisStatus.normalResultCount;
              
              // Add to age-normal data
              this.updateAgeResultsData(patient, patient.analysisStatus.normalResultCount, true);
            }
            
            if (patient.analysisStatus.abnormalResultCount) {
              totalAbnormalResults += patient.analysisStatus.abnormalResultCount;
              
              // Add to age-abnormal data
              this.updateAgeResultsData(patient, patient.analysisStatus.abnormalResultCount, false);
            }
            
            if (patient.analysisStatus.pendingAnalysisCount) {
              pendingCount += patient.analysisStatus.pendingAnalysisCount;
            }
          }
        });

        this.normalResults = totalNormalResults;
        this.abnormalResults = totalAbnormalResults;
        this.pendingReviews = pendingCount;

        // Load recent analyses - use max 5 items for the recent list
        this.analysisService.getAnalyses({ limit: 5, sort_by: 'uploadDate', sort_order: -1 }).subscribe({
          next: (analysesResponse) => {
            this.recentAnalyses = analysesResponse.metadata.total_count;
            
            // Process recent analyses for display
            if (analysesResponse.items && analysesResponse.items.length > 0) {
              this.recentAnalysesList = analysesResponse.items.map(analysis => {
                // Determine status
                let status: 'normal' | 'abnormal' | 'pending' = 'pending';
                
                // Check if analysis has result and it's completed
                if (analysis.result && analysis.result.class !== undefined) {
                  status = analysis.result.class === 1 ? 'normal' : 'abnormal';
                }
                
                return {
                  id: analysis._id || analysis.id || '',
                  patientId: analysis.patientId || '',
                  patientName: `Patient #${analysis.patientId || ''}`, // Temporary placeholder
                  status: status,
                  uploadedAt: new Date(analysis.uploadDate || new Date())
                };
              });
              
              // Fetch patient names after analyses are loaded
              this.fetchPatientNames();
            } else {
              // Use dummy data if no analyses are available
              this.createDummyAnalysesData();
            }
            
            this.isLoading = false;
            this.dataError = false;

            // Once data is loaded and isLoading is set to false, 
            // the DOM elements will be rendered, then we can initialize charts
            setTimeout(() => {
              console.log('Data loaded, now initializing charts');
              this.initializeCharts();
            }, 100);
          },
          error: (error) => {
            console.error('Error loading analyses data:', error);
            this.createDummyAnalysesData();
            this.isLoading = false;
            this.dataError = true;
            
            setTimeout(() => {
              this.initializeCharts();
            }, 100);
          }
        });
      },
      error: (error) => {
        console.error('Error loading patients data:', error);
        this.createDummyAnalysesData();
        this.isLoading = false;
        this.dataError = true;
        
        setTimeout(() => {
          this.initializeCharts();
        }, 100);
      }
    });
  }

  // Helper method to create dummy analyses data for testing
  createDummyAnalysesData(): void {
    this.recentAnalysesList = [];
    for (let i = 1; i <= 5; i++) {
      // Use the same logic for status as in the real data
      // For dummy data: 0 = abnormal, 1 = normal, 2 = pending
      const statusCode = i % 3;
      const status = statusCode === 1 ? 'normal' : (statusCode === 0 ? 'abnormal' : 'pending');
      
      this.recentAnalysesList.push({
        id: `dummy-${i}`,
        patientId: `${10000 + i}`,
        patientName: `Patient #${10000 + i}`,
        status: status as 'normal' | 'abnormal' | 'pending',
        uploadedAt: new Date(Date.now() - i * 3600000) // i hours ago
      });
    }
  }

  // Helper method to get time ago string
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) {
      return 'just now';
    }
    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    const diffHrs = Math.round(diffMins / 60);
    if (diffHrs < 24) {
      return `${diffHrs} ${diffHrs === 1 ? 'hour' : 'hours'} ago`;
    }
    
    const diffDays = Math.round(diffHrs / 24);
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }

  // Helper method to update age distribution data
  updateAgeDistribution(patient: any): void {
    if (patient.dateOfBirth) {
      const ageIndex = this.getAgeGroupIndex(patient.dateOfBirth);
      if (ageIndex >= 0) {
        this.ageData[ageIndex]++;
      }
    }
  }
  
  // Helper method to determine age group index
  getAgeGroupIndex(dateOfBirth: string): number {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    
    // Determine age group index
    if (age <= 18) return 0; // 0-18
    else if (age <= 35) return 1; // 19-35
    else if (age <= 50) return 2; // 36-50
    else if (age <= 65) return 3; // 51-65
    else return 4; // 65+
  }

  // Helper method to update age results data
  updateAgeResultsData(patient: any, count: number, isNormal: boolean): void {
    if (patient.dateOfBirth) {
      const ageIndex = this.getAgeGroupIndex(patient.dateOfBirth);
      if (ageIndex >= 0) {
        if (isNormal) {
          this.ageNormalData[ageIndex] += count;
        } else {
          this.ageAbnormalData[ageIndex] += count;
        }
      }
    }
  }

  initializeCharts(): void {
    // Check if elements are available
    console.log('Chart refs available:', {
      resultsChart: !!this.resultsChartRef?.nativeElement,
      ageDistributionChart: !!this.ageDistributionChartRef?.nativeElement,
      trendGaugeChart: !!this.trendGaugeChartRef?.nativeElement,
      resultsByAgeChart: !!this.resultsByAgeChartRef?.nativeElement
    });
    
    // Add a small delay to ensure DOM is ready
    setTimeout(() => {
    // Create charts with data
    this.createResultsDistributionChart();
    this.createAgeDistributionChart();
      if (this.resultsByAgeChartRef) {
    this.createResultsByAgeChart();
      }
    }, 200);
  }

  // Results Distribution Chart
  createResultsDistributionChart(): void {
    if (!this.resultsChartRef) {
      console.error('Results chart reference not available');
      return;
    }

    try {
      const ctx = this.resultsChartRef.nativeElement.getContext('2d');
      console.log('Creating results distribution chart');
      
      // Destroy existing chart if exists
      if (this.resultsChart) {
        this.resultsChart.destroy();
      }
      
      // Create gradient colors with more transparency
      const normalGradient = ctx.createLinearGradient(0, 0, 0, 400);
      normalGradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
      normalGradient.addColorStop(1, 'rgba(16, 185, 129, 0.5)');
      
      const abnormalGradient = ctx.createLinearGradient(0, 0, 0, 400);
      abnormalGradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
      abnormalGradient.addColorStop(1, 'rgba(239, 68, 68, 0.5)');
      
      const pendingGradient = ctx.createLinearGradient(0, 0, 0, 400);
      pendingGradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
      pendingGradient.addColorStop(1, 'rgba(245, 158, 11, 0.5)');
      
      this.resultsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Normal', 'Abnormal', 'Pending'],
          datasets: [{
            data: [
              this.normalResults || 1, 
              this.abnormalResults || 1, 
              this.pendingReviews || 1
            ],
            backgroundColor: [
              normalGradient,
              abnormalGradient,
              pendingGradient
            ],
            borderColor: 'rgba(255, 255, 255, 0.8)',
            borderWidth: 2,
            borderRadius: 5,
            spacing: 1,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.2,
          cutout: '65%',
          layout: {
            padding: 0
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: '#ffffff',
              titleColor: '#1f2937',
              bodyColor: '#4b5563',
              borderColor: '#e5e7eb',
              borderWidth: 1,
              padding: 10,
              boxPadding: 4,
              usePointStyle: true,
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.formattedValue;
                  const total = context.dataset.data.reduce((acc: number, data: number) => acc + data, 0);
                  const percentage = Math.round((context.raw as number) / total * 100);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
      
      console.log('Results distribution chart created successfully');
    } catch (error) {
      console.error('Error creating results distribution chart:', error);
    }
  }

  // Age Distribution Chart
  createAgeDistributionChart(): void {
    if (!this.ageDistributionChartRef) {
      console.error('Age distribution chart reference not available');
      return;
    }

    try {
      const ctx = this.ageDistributionChartRef.nativeElement.getContext('2d');
      console.log('Creating age distribution chart');
      
      // Destroy existing chart if exists
      if (this.ageDistributionChart) {
        this.ageDistributionChart.destroy();
      }
      
      // Create gradient with more transparency
      const barGradient = ctx.createLinearGradient(0, 0, 400, 0);
      barGradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
      barGradient.addColorStop(1, 'rgba(99, 102, 241, 0.8)');
      
      this.ageDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: this.ageGroups,
          datasets: [{
            label: 'Patients',
            data: this.ageData.map(value => value || 0),
            backgroundColor: barGradient,
            borderColor: 'rgba(139, 92, 246, 0.7)',
            borderWidth: 1,
            borderRadius: 8,
            maxBarThickness: 32
          }]
        },
        options: {
          indexAxis: 'y', // Horizontal bar chart
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.7,
          layout: {
            padding: { top: 8, right: 10, bottom: 8, left: 10 }
          },
          plugins: {
            legend: {
              display: false // Hide legend
            },
            tooltip: {
              backgroundColor: '#ffffff',
              titleColor: '#1f2937',
              bodyColor: '#4b5563',
              borderColor: '#e5e7eb',
              borderWidth: 1,
              callbacks: {
                title: function(tooltipItem) {
                  return 'Age Group: ' + tooltipItem[0].label;
                },
                label: function(context) {
                  return 'Patients: ' + context.raw;
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: {
                display: true,
                color: 'rgba(226, 232, 240, 0.7)'
              },
              ticks: {
                color: '#6b7280'
              }
            },
            y: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6b7280'
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error creating age distribution chart:', error);
    }
  }

  // Trend Gauge Chart
  createTrendGaugeChart(): void {
    if (!this.trendGaugeChartRef) {
      console.error('Trend gauge chart reference not available');
      return;
    }

    try {
      const ctx = this.trendGaugeChartRef.nativeElement.getContext('2d');
      console.log('Creating trend gauge chart');
      
      // Calculate abnormal percentage
      const total = this.normalResults + this.abnormalResults;
      const abnormalPercentage = total > 0 ? (this.abnormalResults / total) * 100 : 0;
      const remainingPercentage = 100 - abnormalPercentage;
      
      // Determine color based on percentage with more transparency
      let gaugeColor = 'rgba(16, 185, 129, 0.8)'; // Green for low abnormal rate
      if (abnormalPercentage > 50) {
        gaugeColor = 'rgba(239, 68, 68, 0.8)'; // Red for high abnormal rate
      } else if (abnormalPercentage > 30) {
        gaugeColor = 'rgba(245, 158, 11, 0.8)'; // Amber for medium abnormal rate
      }
      
      // Destroy existing chart if exists
      if (this.trendGaugeChart) {
        this.trendGaugeChart.destroy();
      }
      
      this.trendGaugeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [abnormalPercentage, remainingPercentage],
            backgroundColor: [
              gaugeColor,
              'rgba(229, 231, 235, 0.5)'
            ],
            borderColor: 'rgba(255, 255, 255, 0.7)',
            borderWidth: 2,
            borderRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          circumference: 180,
          rotation: -90,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              enabled: false
            }
          }
        }
      });
      
      console.log('Trend gauge chart created successfully');
    } catch (error) {
      console.error('Error creating trend gauge chart:', error);
    }
  }

  // Results by Age Chart
  createResultsByAgeChart(): void {
    if (!this.resultsByAgeChartRef) {
      console.error('Results by age chart reference not available');
      return;
    }

    try {
      const ctx = this.resultsByAgeChartRef.nativeElement.getContext('2d');
      console.log('Creating results by age chart');
      
      // Destroy existing chart if exists
      if (this.resultsByAgeChart) {
        this.resultsByAgeChart.destroy();
      }
      
      // Create gradients with more transparency
      const normalGradient = ctx.createLinearGradient(0, 0, 0, 250);
      normalGradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
      normalGradient.addColorStop(1, 'rgba(16, 185, 129, 0.4)');
      
      const abnormalGradient = ctx.createLinearGradient(0, 0, 0, 250);
      abnormalGradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
      abnormalGradient.addColorStop(1, 'rgba(239, 68, 68, 0.4)');
      
      this.resultsByAgeChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: this.ageGroups,
          datasets: [
            {
              label: 'Normal',
              data: this.ageNormalData,
              backgroundColor: normalGradient,
              borderColor: 'rgba(16, 185, 129, 0.7)',
              borderWidth: 1,
              borderRadius: 6,
              maxBarThickness: 16
            },
            {
              label: 'Abnormal',
              data: this.ageAbnormalData,
              backgroundColor: abnormalGradient,
              borderColor: 'rgba(239, 68, 68, 0.7)',
              borderWidth: 1,
              borderRadius: 6,
              maxBarThickness: 16
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.6,
          layout: {
            padding: 5
          },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 12,
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 18,
                color: '#6b7280'
              }
            },
            tooltip: {
              backgroundColor: '#ffffff',
              titleColor: '#1f2937',
              bodyColor: '#4b5563',
              borderColor: '#e5e7eb',
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6b7280'
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(226, 232, 240, 0.5)'
              },
              ticks: {
                precision: 0,
                color: '#6b7280'
              }
            }
          }
        }
      });
      
      console.log('Results by age chart created successfully');
    } catch (error) {
      console.error('Error creating results by age chart:', error);
    }
  }

  // Get current time for last updated display
  getCurrentTime(): string {
    return new Date().toLocaleTimeString();
  }

  // Helper method to get normal percentage for ratio visualization
  getNormalPercentage(): number {
    const total = this.normalResults + this.abnormalResults;
    if (total === 0) return 50; // Default to 50% if no data
    return Math.round((this.normalResults / total) * 100);
  }

  // Helper method to get abnormal percentage for ratio visualization
  getAbnormalPercentage(): number {
    const total = this.normalResults + this.abnormalResults;
    if (total === 0) return 50; // Default to 50% if no data
    return Math.round((this.abnormalResults / total) * 100);
  }

  // Add fetchPatientNames method
  fetchPatientNames(): void {
    // Get unique patient IDs
    const patientIds = [...new Set(this.recentAnalysesList.map(a => a.patientId))];
    
    // Fetch patient details for each unique ID
    patientIds.forEach(id => {
      if (!this.patientNames[id] && id) {
        this.patientService.getPatientById(id).subscribe({
          next: (patient) => {
            this.patientNames[id] = `${patient.firstName} ${patient.lastName}`;
            
            // Update the displayed name in the analyses list
            this.recentAnalysesList.forEach(analysis => {
              if (analysis.patientId === id) {
                analysis.patientName = this.patientNames[id];
              }
            });
          },
          error: (err) => {
            console.error(`Failed to load patient name for ID ${id}`, err);
            this.patientNames[id] = 'Unknown Patient';
          }
        });
      }
    });
  }

  // Navigation methods
  navigateTo(route: string): void {
    this.router.navigateByUrl(route);
  }

  navigateToPatient(patientId: string): void {
    if (patientId) {
      this.router.navigate(['/doctor/patients', patientId]);
    }
  }
}
